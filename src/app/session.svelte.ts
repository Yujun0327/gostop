import {
  applyMove,
  breakdown,
  createGame,
  defaultConfig,
  legalMoves,
  publicHash,
  redact,
} from '../engine'
import type { GameConfig, GameState, Move, Seat, TurnEvent } from '../engine'
import {
  BeaconSession,
  brokersFromEnv,
  type Beacon,
  type GameAdapter,
  type Transport,
} from '@yujun/game-net'
import { MONEY_RULES, WalletSession, defaultLedger, loadIdentity, type Identity, type Ledger, type LockState, type Payout } from '@yujun/game-net/wallet'
import { APP } from './persist'

export type SfxEvent = 'slap' | 'sweep' | 'clink' | 'stamp1' | 'stamp2' | 'stamp3' | 'go' | 'stop' | 'nagari' | 'win' | 'lose'

export const RULES_VERSION = '1'
const CAP = MONEY_RULES.gostop?.table?.capPoints ?? 50

function seed32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** Stamp tier per event, for the celebration overlay. */
export function stampFor(ev: TurnEvent): { tier: 1 | 2 | 3; title: string; kicker?: string } | null {
  switch (ev.type) {
    case 'jjok':
      return { tier: 1, title: '쪽!' }
    case 'ppeok':
      return { tier: 1, title: '뻑' }
    case 'jappeok':
      return { tier: 2, title: '자뻑!', kicker: '내 뻑을 내가' }
    case 'ppeokCapture':
      return { tier: 2, title: '뻑 먹기!' }
    case 'ttadak':
      return { tier: 2, title: '따닥!' }
    case 'sseul':
      return { tier: 2, title: '싹쓸이!' }
    case 'shake':
      return { tier: 2, title: '흔들기!', kicker: '두 배' }
    case 'bomb':
      return { tier: 3, title: '폭탄!', kicker: '두 배 · 두 번 쉬기' }
    case 'go':
      return { tier: (ev.count ?? 1) >= 3 ? 3 : (ev.count ?? 1) === 2 ? 2 : 1, title: `${ev.count ?? 1}고!`, kicker: (ev.count ?? 1) >= 3 ? '이제부터 두 배씩' : undefined }
    case 'chongtong':
      return { tier: 3, title: '총통!' }
    case 'samyeonppeok':
      return { tier: 3, title: '삼연뻑!' }
    default:
      return null
  }
}

export abstract class BaseSession {
  state = $state<GameState>() as GameState
  events = $state<{ id: number; sfx: SfxEvent }[]>([])
  private eventId = 0

  constructor(initial: GameState) {
    this.state = initial
  }

  abstract readonly mode: 'hotseat' | 'online'
  /** The seat this client plays; null = plays every seat (hotseat) or none (spectator). */
  abstract get mySeat(): Seat | null
  /** Whose hand may be shown right now. */
  abstract get viewer(): Seat | null

  get cfg(): GameConfig {
    return this.state.cfg
  }

  get names(): string[] {
    return this.state.cfg.names
  }

  get visibleState(): GameState {
    return redact(this.state, this.viewer)
  }

  get actor(): Seat {
    return this.state.turn
  }

  get myTurn(): boolean {
    return !this.state.result && (this.mySeat === null || this.actor === this.mySeat)
  }

  myMoves(): Move[] {
    if (!this.myTurn) return []
    return legalMoves(this.state, this.actor).filter((m) => m.type !== 'concede')
  }

  /** Live score per seat. */
  get scores(): number[] {
    return this.state.players.map((p) => breakdown(p).total)
  }

  protected emit(sfx: SfxEvent) {
    this.events = [...this.events.slice(-5), { id: this.eventId++, sfx }]
  }

  protected applyLocal(actor: Seat, move: Move): void {
    const before = this.state
    const after = applyMove(before, actor, move)
    this.state = after
    this.emitFor(before, after, actor, move)
  }

  /** Sound for one transition: what the engine's public events say happened. */
  protected emitFor(before: GameState, after: GameState, actor: Seat, move: Move): void {
    void actor
    if (move.type === 'play' || move.type === 'pass') this.emit('slap')
    const fresh = after.turn === before.turn && after.phase !== 'play' ? after.events.slice(before.events.length) : after.events
    const prevPile = before.players.map((p) => p.captured.length)
    if (after.players.some((p, i) => p.captured.length > prevPile[i])) this.emit('sweep')
    for (const ev of fresh) {
      if (ev.type === 'steal') this.emit('clink')
      const s = stampFor(ev)
      if (s) this.emit(s.tier === 3 ? 'stamp3' : s.tier === 2 ? 'stamp2' : 'stamp1')
      if (ev.type === 'go') this.emit('go')
      if (ev.type === 'stop') this.emit('stop')
      if (ev.type === 'nagari') this.emit('nagari')
    }
    if (!before.result && after.result) {
      const r = after.result
      if (r.winner === null && r.reason === 'nagari') return
      const won = this.mySeat === null ? true : (r.payoutPoints[this.mySeat] ?? 0) > 0
      this.emit(won ? 'win' : 'lose')
    }
  }

  abstract submit(move: Move): void
  destroy(): void {}
}

/* ------------------------------------------------------------------ */

export class HotseatSession extends BaseSession {
  readonly mode = 'hotseat'
  /** Which seat last confirmed the hand-off shield. */
  acknowledged = $state<Seat>(0)

  constructor(playerCount: 2 | 3, names: string[], opts: { startingSeat?: Seat; carry?: number } = {}) {
    const cfg = defaultConfig(playerCount, seed32(), opts.startingSeat ?? Math.floor(Math.random() * playerCount), names.map((n, i) => n.trim() || `${i + 1}번`))
    cfg.pointValue = 0
    cfg.carryMultiplier = opts.carry ?? 1
    super(createGame(cfg))
    this.acknowledged = this.state.turn
  }

  get mySeat(): null {
    return null
  }

  /** On a shared screen only the acting seat's hand shows. */
  get viewer(): Seat {
    return this.actor
  }

  get handoffNeeded(): boolean {
    return !this.state.result && this.state.turn !== this.acknowledged
  }

  submit(move: Move): void {
    this.applyLocal(this.actor, move)
  }

  /** The next 판: 선 goes to the winner, 나가리 carries its multiplier. */
  nextRound(): HotseatSession {
    const r = this.state.result
    const n = this.cfg.playerCount
    const startingSeat = r?.winner ?? (this.cfg.startingSeat + 1) % n
    return new HotseatSession(n, this.cfg.names, { startingSeat, carry: r?.nextCarry ?? 1 })
  }
}

/* ------------------------------------------------------------------ */

export type OnlineStatus = 'connecting' | 'lobby' | 'playing' | 'desync' | 'room-full' | 'version-mismatch'

export interface LobbySeat {
  playerKey: string
  name: string
  ready: boolean
  connected: boolean
}

interface Pick {
  pointValue: number
  minStop: number
}

/** Cash per seat from the engine's zero-sum points: losses capped at the buy-in, winners share the rest. */
export function cashPayouts(state: GameState, cfg: GameConfig): number[] {
  const n = cfg.playerCount
  const pv = cfg.pointValue
  const stake = pv * cfg.capPoints
  const pts = state.result?.payoutPoints ?? Array(n).fill(0)
  if (!pv || !state.result) return Array(n).fill(0)
  const out = Array(n).fill(0)
  let pool = 0
  for (let i = 0; i < n; i++) {
    if (pts[i] < 0) {
      out[i] = -Math.min(-pts[i] * pv, stake)
      pool += -out[i]
    }
  }
  const winners = [...Array(n).keys()].filter((i) => pts[i] > 0)
  const totalWin = winners.reduce((s, i) => s + pts[i], 0)
  let given = 0
  for (const i of winners) {
    out[i] = Math.floor((pool * pts[i]) / totalWin)
    given += out[i]
  }
  if (winners.length) out[winners[0]] += pool - given
  return out
}

function makeAdapter(host: () => OnlineSession | null): GameAdapter<GameConfig, GameState, Move> {
  return {
    app: APP,
    protocol: 1,
    rulesVersion: RULES_VERSION,
    minSeats: 2,
    maxSeats: 3,
    makeConfig: (players, prev) => {
      const n = Math.max(2, Math.min(3, players.length)) as 2 | 3
      const h = host()
      const last = h?.lastResult ?? null
      const startingSeat = prev ? (last?.winner ?? (prev.startingSeat + 1) % n) : Math.floor(Math.random() * n)
      const cfg = defaultConfig(n, seed32(), startingSeat, players.map((p, i) => p.name.trim() || `${i + 1}번`))
      cfg.minStopScore = prev ? prev.minStopScore : (h?.hostMinStop ?? 3)
      cfg.pointValue = prev ? prev.pointValue : (h?.hostPointValue ?? 0)
      cfg.capPoints = CAP
      cfg.carryMultiplier = prev ? (last?.nextCarry ?? 1) : 1
      return cfg
    },
    // seats keep lobby order; the engine's startingSeat decides who leads
    create: (cfg) => ({ state: createGame(cfg) }),
    apply: applyMove,
    hash: publicHash,
    actor: (s) => s.turn,
    isOver: (s) => s.result !== null,
    actorFor: (s, seat, move) => (move.type === 'concede' || s.turn === seat ? seat : null),
    winners: (s) => (s.result ? cashPayouts(s, s.cfg).map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0) : []),
    payouts: (s, cfg) => cashPayouts(s, cfg),
    stake: (cfg) => cfg.pointValue * cfg.capPoints,
  }
}

type Core = BeaconSession<GameConfig, GameState, Move>

export interface OnlineTestHooks {
  transport?: Transport<Beacon<GameConfig, Move>>
  now?: () => number
  timers?: boolean
  ledger?: Ledger
  identity?: Identity
}

export class OnlineSession extends BaseSession {
  readonly mode = 'online'
  readonly room: string
  readonly myKey: string
  balances = $state<Record<string, number>>({})

  private readonly core: Core
  private wallet: WalletSession<GameConfig, GameState, Move, undefined> | null = null
  private rev = $state(0)
  private gameId = ''
  private seenLog = 0
  private prev: GameState
  private pick = $state<Pick>({ pointValue: 0, minStop: 3 })
  private balanceKeys = ''
  /** The last finished 판, kept for the rematch's 선 and carry. */
  lastResult: GameState['result'] = null

  constructor(room: string, creator: boolean, identity: { key: string; name: string }, test: OnlineTestHooks = {}) {
    const self: { s: OnlineSession | null } = { s: null }
    const core: Core = new BeaconSession(makeAdapter(() => self.s), {
      room,
      creator,
      identity,
      transport: test.transport,
      brokers: test.transport ? undefined : brokersFromEnv(import.meta.env as Record<string, string | undefined>),
      now: test.now,
      timers: test.timers,
      log: (t) => console.log(`[${APP}] ${t}`),
    })
    super(core.state)
    self.s = this
    this.core = core
    this.room = core.room
    this.myKey = core.myKey
    this.prev = core.state
    this.seenLog = core.logLength
    this.gameId = core.snapshot?.gameId ?? ''
    core.subscribe(() => this.sync())
    const ledger = test.ledger ?? (test.transport ? null : defaultLedger())
    if (ledger) {
      this.wallet = new WalletSession(core, APP, test.identity ?? loadIdentity(), ledger, test.now)
      this.wallet.subscribe(() => this.rev++)
    }
  }

  private get c(): Core {
    void this.rev
    return this.core
  }

  private sync(): void {
    const core = this.core
    if (core.snapshot && core.snapshot.gameId !== this.gameId) {
      this.gameId = core.snapshot.gameId
      this.seenLog = 0
      this.prev = createGame(core.snapshot.cfg)
    }
    this.state = core.state
    const log = core.snapshot?.log ?? []
    const fresh = log.length - this.seenLog
    if (fresh > 0 && fresh <= 2) {
      let st = this.prev
      for (const wire of log.slice(this.seenLog)) {
        const next = applyMove(st, wire.actor, wire.move)
        this.emitFor(st, next, wire.actor, wire.move)
        st = next
      }
    }
    this.seenLog = log.length
    this.prev = core.state
    if (core.state.result) this.lastResult = core.state.result
    if (!core.started) {
      if (!core.isHost) {
        const h = core.livePeers.find((p) => p.key === core.hostKey)
        const pick = (h?.extra as { pick?: Pick } | undefined)?.pick
        if (pick) this.pick = pick
      } else if (!core.extra) this.announcePick()
      this.refreshBalances()
    }
    this.rev++
  }

  /* ---------------- base overrides ---------------- */

  get mySeat(): Seat | null {
    return this.c.seat
  }

  get viewer(): Seat | null {
    return this.c.seat
  }

  get myTurn(): boolean {
    const seat = this.c.seat
    return seat !== null && !this.state.result && this.actor === seat
  }

  submit(move: Move): void {
    this.core.submit(move)
  }

  /* ---------------- lobby ---------------- */

  get status(): OnlineStatus {
    return this.c.status
  }

  get playing(): boolean {
    return this.c.playing
  }

  get spectator(): boolean {
    return this.c.spectator
  }

  get isHost(): boolean {
    return this.c.isHost
  }

  get hostKey(): string {
    return this.c.hostKey
  }

  get seat(): Seat | null {
    return this.c.seat
  }

  get seats(): LobbySeat[] {
    return this.c.players.map((p) => ({ playerKey: p.key, name: p.name, ready: p.ready, connected: p.connected }))
  }

  get canStart(): boolean {
    return this.c.canStart
  }

  get hostPointValue(): number {
    void this.rev
    return this.pick.pointValue
  }

  set hostPointValue(v: number) {
    this.pick = { ...this.pick, pointValue: v }
    this.announcePick()
  }

  get hostMinStop(): number {
    void this.rev
    return this.pick.minStop
  }

  set hostMinStop(v: number) {
    this.pick = { ...this.pick, minStop: v }
    this.announcePick()
  }

  private announcePick(): void {
    if (this.core.isHost && !this.core.started) this.core.setExtra({ pick: $state.snapshot(this.pick) })
  }

  get buyIn(): number {
    return this.hostPointValue * CAP
  }

  get canAfford(): boolean {
    if (!this.buyIn || !this.wallet) return true
    const mine = this.balances[this.myKey]
    return mine === undefined ? true : mine >= this.buyIn
  }

  private refreshBalances(): void {
    const ledger = this.ledger
    if (!ledger) return
    const keys = this.core.players.map((p) => p.key)
    const sig = keys.join(',')
    if (sig === this.balanceKeys) return
    this.balanceKeys = sig
    for (const key of keys) {
      void ledger.readPlayer(key).then((p) => {
        if (p) this.balances = { ...this.balances, [key]: p.balance }
      })
    }
  }

  setReady(ready: boolean): void {
    if (ready && !this.canAfford) return
    this.core.setReady(ready)
  }

  rename(name: string): void {
    this.core.setName(name)
  }

  startGame(): void {
    this.core.startGame()
  }

  requestRematch(): void {
    this.core.requestRematch()
  }

  /** Name of the absent player the table is waiting on, if any. */
  get waitingOn(): string | null {
    const key = this.c.waitingOn
    if (!key || !this.core.snapshot) return null
    return this.cfg.names[this.core.snapshot.seats[key]] ?? this.core.nameOf(key)
  }

  relayCount(): number {
    return this.c.channelCount()
  }

  brokerCount(): number {
    return this.core.channels().length
  }

  rescan(): void {
    this.core.rescan()
  }

  get net(): Core {
    return this.core
  }

  get payout(): Payout | null {
    void this.rev
    return this.wallet?.payout ?? null
  }

  get lockState(): LockState | null {
    void this.rev
    return this.wallet?.lock ?? null
  }

  get ledger(): Ledger | null {
    return this.wallet ? (this.wallet as unknown as { ledger: Ledger }).ledger : null
  }

  leave(): void {
    this.wallet?.destroy()
    this.core.leave()
  }

  destroy(): void {
    this.wallet?.destroy()
    this.core.destroy()
  }
}
