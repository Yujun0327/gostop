// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import { Mesh } from '@yujun/game-net/mesh'
import { Ledger, identityFromSeed, verify, type Settlement } from '@yujun/game-net/wallet'
import { HotseatSession, OnlineSession, cashPayouts } from '../src/app/session.svelte'
import { mulberry32, publicHash } from '../src/engine'
import type { Move } from '../src/engine'
import GameScreen from '../src/ui/GameScreen.svelte'
import PlayingProbe from './support/PlayingProbe.svelte'

if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
if (!Element.prototype.animate) {
  Element.prototype.animate = function () {
    const anim = { cancel() {}, finish() {}, finished: Promise.resolve(), set onfinish(fn: (() => void) | null) { fn?.() } }
    return anim as unknown as Animation
  }
}

const ROOM = 'GSROOM'
let clock = 1_000_000
const now = () => clock
const ids = [1, 2, 3].map((n) => identityFromSeed(new Uint8Array(32).fill(n)))

class FakeLedger extends Ledger {
  posts: { action: string; player: string; msg: string; sig: string }[] = []
  constructor() {
    super({ url: 'http://fake', anonKey: 'x' }, async (_input, init) => {
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { action: string; player: string; msg: string; sig: string }
        this.posts.push(body)
        if (body.action === 'settle') {
          if (!verify(body.player, 'settle', body.msg, body.sig)) return json({ ok: false, error: 'bad sig' }, 401)
          const s = JSON.parse(body.msg) as Settlement
          const signed = new Set(this.posts.filter((p) => p.action === 'settle' && JSON.parse(p.msg).gameId === s.gameId).map((p) => p.player))
          return json({ ok: true, status: signed.size === s.seats.length ? 'settled' : 'pending' })
        }
        return json({ ok: true, status: body.action === 'lock' ? 'locked' : 'ok' })
      }
      return json([])
    })
  }
}

class World {
  mesh = new Mesh<never>()
  sessions: OnlineSession[] = []
  ledger = new FakeLedger()

  add(i: number, creator = false, money = false): OnlineSession {
    const s = new OnlineSession(ROOM, creator, { key: money ? ids[i].id : `key-${i}`, name: `P${i}` }, {
      transport: this.mesh.peer(`peer-${i}`),
      now,
      timers: false,
      ...(money ? { ledger: this.ledger, identity: ids[i] } : {}),
    })
    this.sessions.push(s)
    return s
  }

  second(times = 1): void {
    for (let i = 0; i < times; i++) {
      clock += 1000
      for (const s of this.sessions) s.net.tick()
      this.mesh.flush()
    }
  }

  flush(): void {
    this.mesh.flush()
  }

  start(n: number, setup?: (host: OnlineSession) => void, money = false): OnlineSession[] {
    const host = this.add(0, true, money)
    for (let i = 1; i < n; i++) this.add(i, false, money)
    this.second(2)
    setup?.(host)
    this.flush()
    for (const s of this.sessions) s.setReady(true)
    this.flush()
    host.startGame()
    this.flush()
    return this.sessions
  }

  acting(): OnlineSession | undefined {
    return this.sessions.find((s) => s.myTurn)
  }
}

beforeEach(() => {
  localStorage.clear()
  clock = 1_000_000
})

function playOut(w: World, seed: number, lossy = false) {
  const rng = mulberry32(seed)
  for (let step = 0; step < 400 && !w.sessions[0].state.result; step++) {
    const a = w.acting()
    if (a && !a.state.result) {
      const moves = a.myMoves()
      expect(moves.length).toBeGreaterThan(0)
      a.submit(moves[Math.floor(rng() * moves.length)] as Move)
    }
    if (lossy) w.mesh.filter = () => rng() > 0.4
    w.second()
  }
  w.mesh.filter = () => true
  w.second(4)
}

describe('hotseat', () => {
  it('plays a full 2P round with the shield between turns', () => {
    const s = new HotseatSession(2, ['가', '나'])
    expect(s.handoffNeeded).toBe(false)
    const rng = mulberry32(3)
    let guard = 0
    while (!s.state.result && guard++ < 200) {
      s.acknowledged = s.state.turn
      const moves = s.myMoves()
      s.submit(moves[Math.floor(rng() * moves.length)])
    }
    expect(s.state.result).not.toBeNull()
    const next = s.nextRound()
    expect(next.cfg.carryMultiplier).toBe(s.state.result!.nextCarry)
  })
})

describe('lobby', () => {
  it("mirrors the host's 점당 and stop score to guests and gates start", () => {
    const w = new World()
    const [host, guest] = w.start(2, (h) => {
      h.hostPointValue = 500
      h.hostMinStop = 7
    })
    expect(guest.hostPointValue).toBe(500)
    expect(host.cfg.pointValue).toBe(500)
    expect(guest.cfg.minStopScore).toBe(7)
    expect(guest.playing && host.playing).toBe(true)
    expect(publicHash(guest.state)).toBe(publicHash(host.state))
  })

  it('renders lobby→game reactively', () => {
    const w = new World()
    const host = w.add(0, true)
    const guest = w.add(1)
    w.second()
    const targets = [host, guest].map((session) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      return { target, instance: mount(PlayingProbe, { target, props: { session } }) }
    })
    flushSync()
    expect(targets.map((t) => t.target.textContent)).toEqual(['LOBBY', 'LOBBY'])
    host.setReady(true)
    guest.setReady(true)
    w.flush()
    host.startGame()
    w.flush()
    flushSync()
    expect(targets.map((t) => t.target.textContent)).toEqual(['GAME', 'GAME'])
    for (const t of targets) {
      unmount(t.instance)
      t.target.remove()
    }
  })
})

describe('play across the mesh', () => {
  it('2P: a random 판 ends in lockstep', () => {
    const w = new World()
    const sessions = w.start(2)
    playOut(w, 11)
    const ref = publicHash(sessions[0].state)
    for (const s of sessions) {
      expect(s.state.result).not.toBeNull()
      expect(publicHash(s.state)).toBe(ref)
    }
  })

  it('3P: converges through 40% beacon loss', () => {
    const w = new World()
    const sessions = w.start(3)
    playOut(w, 12, true)
    const ref = publicHash(sessions[0].state)
    for (const s of sessions) expect(publicHash(s.state)).toBe(ref)
    expect(sessions[0].state.result).not.toBeNull()
  })

  it('rematch: 선 goes to the winner and 나가리 carries', () => {
    const w = new World()
    const sessions = w.start(2)
    playOut(w, 13)
    const r = sessions[0].state.result!
    sessions[1].requestRematch()
    w.second(2)
    for (const s of sessions) expect(s.state.result).toBeNull()
    if (r.winner !== null) expect(sessions[0].cfg.startingSeat).toBe(r.winner)
    expect(sessions[0].cfg.carryMultiplier).toBe(r.nextCarry)
  })

  it('a refreshed tab restores the 판 and catches up', () => {
    const w = new World()
    const sessions = w.start(2)
    for (let i = 0; i < 3; i++) {
      const a = w.acting()
      if (a) a.submit(a.myMoves()[0])
      w.second()
    }
    const gone = sessions[1]
    gone.destroy()
    w.sessions = [sessions[0]]
    const back = w.add(1)
    expect(back.playing).toBe(true)
    w.second(2)
    expect(publicHash(back.state)).toBe(publicHash(sessions[0].state))
  })
})

describe('money', () => {
  it('caps a loss at the buy-in and pays the winner the sum', () => {
    const w = new World()
    const sessions = w.start(2, (h) => (h.hostPointValue = 100), true)
    playOut(w, 21)
    const gs = sessions[0].state
    const cash = cashPayouts(gs, gs.cfg)
    expect(cash.reduce((a, b) => a + b, 0)).toBe(0)
    for (const c of cash) expect(c).toBeGreaterThanOrEqual(-gs.cfg.pointValue * gs.cfg.capPoints)
    const r = gs.result!
    if (r.winner !== null) {
      expect(cash[r.winner]).toBeGreaterThan(0)
      const losers = r.perLoser.map((l) => Math.min(l.points * 100, 5000))
      expect(cash[r.winner]).toBe(losers.reduce((a, b) => a + b, 0))
    }
    // both seats locked and signed identical settlements
    const locks = w.ledger.posts.filter((p) => p.action === 'lock')
    expect(new Set(locks.map((p) => p.player)).size).toBe(2)
    const settles = w.ledger.posts.filter((p) => p.action === 'settle')
    if (r.winner !== null) {
      expect(new Set(settles.map((p) => p.msg)).size).toBe(1)
      const s = JSON.parse(settles[0].msg) as Settlement
      expect(s.payouts).toEqual(cash)
      expect(s.stake).toBe(5000)
    }
  })
})

describe('rendered table', () => {
  it('lets the acting player play a card by clicking', () => {
    const w = new World()
    const sessions = w.start(2)
    const acting = w.acting()!
    const other = sessions.find((s) => s !== acting)!
    const target = document.createElement('div')
    document.body.appendChild(target)
    const instance = mount(GameScreen, { target, props: { session: acting, onExit: () => {}, onRematch: () => {} } })
    flushSync()
    const before = acting.state.deck.length
    const card = target.querySelector<HTMLButtonElement>('.hand button.card.playable')!
    expect(card).not.toBeNull()
    card.click()
    flushSync()
    // either the card went straight in, or a choice bar appeared
    if (acting.state.deck.length === before) {
      const go = [...target.querySelectorAll('button')].find((b) => /내기$/.test(b.textContent ?? ''))
      const tableTarget = target.querySelector<HTMLButtonElement>('.field button.card.playable')
      if (tableTarget) tableTarget.click()
      else go?.click()
      flushSync()
    }
    w.flush()
    expect(acting.state.deck.length).toBeLessThan(before)
    expect(publicHash(other.state)).toBe(publicHash(acting.state))
    unmount(instance)
    target.remove()
  })
})
