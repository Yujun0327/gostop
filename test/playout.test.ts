import { describe, expect, it } from 'vitest'
import { ALL_IDS, HIDDEN_CARD, KUKJIN, applyMove, createGame, legalMoves, month, mulberry32, publicHash, redact, score, tokens } from '../src/engine'
import type { GameState, Move, TurnEventType } from '../src/engine'
import { allCards, makeConfig } from './helpers'

const EVENT_TYPES: TurnEventType[] = ['ppeok', 'ttadak', 'jjok', 'sseul', 'jappeok', 'ppeokCapture', 'bomb', 'shake', 'steal', 'go', 'stop', 'nagari', 'chongtong', 'samyeonppeok', 'concede']
const PHASES = ['play', 'chooseFlipMatch', 'kukjin', 'goStop']
const REASONS = ['stop', 'nagari', 'concede', 'chongtong', 'samyeonppeok']

function checkInvariants(state: GameState, initialDeck: string[], prev: GameState | null): void {
  const n = state.players.length
  // 1. 48-card conservation, no duplicates, no sentinels
  const cards = allCards(state)
  expect(cards).toHaveLength(48)
  expect(new Set(cards).size).toBe(48)
  expect(cards).not.toContain(HIDDEN_CARD)
  // 2. deck identity: flips come off the end of the initial deck
  expect(state.deck).toEqual(initialDeck.slice(0, state.deck.length))
  // 3. no month with four on the table
  for (let m = 1; m <= 12; m++) expect(state.table.filter((c) => month(c) === m).length).toBeLessThan(4)
  // 4. deck = Σ(hand + bombPasses) whenever a play is owed
  if (state.phase === 'play' && !state.result) {
    expect(state.deck.length).toBe(state.players.reduce((s, p) => s + tokens(p), 0))
  }
  // 5. phase, turn, events well-formed
  expect(PHASES).toContain(state.phase)
  expect(state.turn).toBeGreaterThanOrEqual(0)
  expect(state.turn).toBeLessThan(n)
  for (const e of state.events) {
    expect(EVENT_TYPES).toContain(e.type)
    expect(e.seat).toBeGreaterThanOrEqual(0)
    expect(e.seat).toBeLessThan(n)
  }
  // 6. go monotonicity and non-negative counters
  state.players.forEach((p, i) => {
    if (prev) {
      expect(p.goCount).toBeGreaterThanOrEqual(prev.players[i].goCount)
      expect(p.scoreAtLastGo).toBeGreaterThanOrEqual(prev.players[i].scoreAtLastGo)
    }
    expect(p.bombPasses).toBeGreaterThanOrEqual(0)
    expect(p.shakes).toBe(p.shookMonths.length)
    expect(score(p)).toBeGreaterThanOrEqual(0)
    if (p.goCount > 0) expect(p.scoreAtLastGo).toBeGreaterThanOrEqual(state.cfg.minStopScore)
  })
  // 7. 뻑 marks sit on real three-card stacks
  for (const mark of state.ppeokMarks) {
    expect(state.table.filter((c) => month(c) === mark.month)).toHaveLength(3)
  }
  // 8. phase-specific scratch consistency
  if (state.phase === 'chooseFlipMatch') {
    expect(state.scratch.flipMatches).toHaveLength(2)
    expect(state.table).toContain(state.scratch.flipped)
    for (const c of state.scratch.flipMatches) expect(state.table).toContain(c)
  }
  if (state.phase === 'kukjin') expect(state.scratch.capturedThisTurn).toContain(KUKJIN)
  if (state.phase === 'goStop') {
    expect(score(state.players[state.turn])).toBeGreaterThanOrEqual(state.cfg.minStopScore)
    expect(tokens(state.players[state.turn])).toBeGreaterThan(0)
  }
  if (state.scratch.playedLaid) expect(state.table).toContain(state.scratch.playedCard)
  // 9. the turn holder can always act while the game runs
  if (!state.result) {
    const mine = legalMoves(state, state.turn).filter((m) => m.type !== 'concede')
    expect(mine.length).toBeGreaterThan(0)
    if (state.phase === 'play') expect(tokens(state.players[state.turn])).toBeGreaterThan(0)
    for (let s = 0; s < n; s++) {
      if (s === state.turn) continue
      expect(legalMoves(state, s)).toEqual([{ type: 'concede' }])
    }
  } else {
    for (let s = 0; s < n; s++) expect(legalMoves(state, s)).toEqual([])
  }
}

function checkResult(state: GameState): void {
  const r = state.result!
  const n = state.players.length
  expect(REASONS).toContain(r.reason)
  expect(r.nextCarry).toBeGreaterThanOrEqual(1)
  expect(r.payoutPoints).toHaveLength(n)
  expect(r.payoutPoints.reduce((a, b) => a + b, 0)).toBe(0)
  for (const l of r.perLoser) {
    expect(l.seat).not.toBe(r.winner)
    expect(l.points).toBeGreaterThanOrEqual(0)
  }
  if (r.reason === 'nagari') {
    expect(r.winner).toBeNull()
    expect(r.nextCarry).toBe(state.carryMultiplier * 2)
    expect(r.payoutPoints.every((p) => p === 0)).toBe(true)
  } else if (r.reason === 'chongtong') {
    expect(r.winner).not.toBeNull()
    expect(r.score).toBe(state.cfg.chongtongPoints)
    expect(r.breakdown).toBeNull()
    expect(state.events[0]).toMatchObject({ type: 'chongtong', seat: r.winner })
    for (const l of r.perLoser) expect(l.points).toBe(state.cfg.chongtongPoints * state.carryMultiplier)
  } else {
    expect(r.reason).toBe('stop')
    expect(r.nextCarry).toBe(1)
    expect(r.winner).not.toBeNull()
    expect(r.perLoser).toHaveLength(n - 1)
    expect(score(state.players[r.winner!])).toBeGreaterThanOrEqual(state.cfg.minStopScore)
    expect(r.breakdown!.total).toBe(r.score)
    expect(r.payoutPoints[r.winner!]).toBe(r.perLoser.reduce((s, l) => s + l.points, 0))
    expect(state.events.at(-1)).toMatchObject({ type: 'stop', seat: r.winner })
  }
}

/** A move that must be rejected in this state. */
function illegalMove(state: GameState, rng: () => number): { actor: number; move: Move } {
  const n = state.players.length
  const p = state.players[state.turn]
  const notMine = ALL_IDS.filter((c) => !p.hand.includes(c))
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
  const options: { actor: number; move: Move }[] = [
    { actor: state.turn, move: { type: 'play', card: pick(notMine) } },
    { actor: state.turn, move: { type: 'play', card: 'zz' } },
    { actor: (state.turn + 1) % n, move: { type: 'play', card: state.players[(state.turn + 1) % n].hand[0] ?? 'm01a' } },
    { actor: (state.turn + 1) % n, move: { type: 'go' } },
    { actor: state.turn, move: { type: 'choose', card: 'zz' } },
    { actor: n + 3, move: { type: 'concede' } },
  ]
  if (state.phase !== 'goStop') options.push({ actor: state.turn, move: { type: 'go' } }, { actor: state.turn, move: { type: 'stop' } })
  if (state.phase !== 'play') options.push({ actor: state.turn, move: { type: 'pass' } })
  if (state.phase !== 'kukjin') options.push({ actor: state.turn, move: { type: 'kukjin', asJunk: true } })
  if (state.phase === 'play' && p.hand.length) {
    const card = pick(p.hand)
    const m = month(card)
    const onTable = state.table.filter((c) => month(c) === m).length
    const inHand = p.hand.filter((c) => month(c) === m).length
    if (onTable !== 2) options.push({ actor: state.turn, move: { type: 'play', card, target: state.table[0] ?? 'm01a' } })
    if (inHand < 3) options.push({ actor: state.turn, move: { type: 'play', card, shake: true } }, { actor: state.turn, move: { type: 'play', card, bomb: true } })
    if (p.bombPasses === 0) options.push({ actor: state.turn, move: { type: 'pass' } })
  }
  return pick(options)
}

describe('random playouts', () => {
  for (const playerCount of [2, 3] as const) {
    for (let seed = 1; seed <= 40; seed++) {
      it(`${playerCount}P seed ${seed}: invariants hold, legal moves apply, illegal moves throw, log replays`, () => {
        const cfg = makeConfig(playerCount, seed * 1000 + playerCount, seed % playerCount)
        const rng = mulberry32(seed)
        let state = createGame(cfg)
        const initialDeck = [...state.deck]
        const log: { actor: number; move: Move }[] = []

        // setup validity
        const sizes = playerCount === 2 ? { hand: 10, table: 8, deck: 20 } : { hand: 7, table: 6, deck: 21 }
        for (const p of state.players) expect(p.hand).toHaveLength(sizes.hand)
        expect(state.table).toHaveLength(sizes.table)
        expect(state.deck).toHaveLength(sizes.deck)
        expect(state.turn).toBe(cfg.startingSeat)
        expect(state.cfg).toEqual(cfg)
        checkInvariants(state, initialDeck, null)

        let steps = 0
        while (!state.result) {
          expect(steps++).toBeLessThan(100)
          const before = publicHash(state)
          const moves = legalMoves(state, state.turn)
          // every legal move applies cleanly (on a clone) …
          for (const m of moves) expect(() => applyMove(state, state.turn, m)).not.toThrow()
          // … and a random illegal one throws
          const bad = illegalMove(state, rng)
          expect(() => applyMove(state, bad.actor, bad.move)).toThrow()

          const playable = moves.filter((m) => m.type !== 'concede')
          const move = playable[Math.floor(rng() * playable.length)]
          const actor = state.turn
          const next = applyMove(state, actor, move)
          expect(publicHash(state)).toBe(before) // never mutates
          log.push({ actor, move })

          // events belong to the acting seat (turn-scoped)
          if (move.type === 'play' || move.type === 'pass') for (const e of next.events) expect(e.seat).toBe(actor)
          if (move.type === 'go') expect(next.players[actor].goCount).toBe(state.players[actor].goCount + 1)

          checkInvariants(next, initialDeck, state)
          state = next
        }
        checkResult(state)

        // replay-hash contract
        let replayed = createGame(cfg)
        for (const { actor, move } of log) replayed = applyMove(replayed, actor, move)
        expect(publicHash(replayed)).toBe(publicHash(state))

        // redaction: hides other hands and the deck, keeps lengths, idempotent, own hand visible
        const mid = log.length > 3 ? log.slice(0, 3).reduce((s, { actor, move }) => applyMove(s, actor, move), createGame(cfg)) : state
        for (let viewer = 0; viewer < playerCount; viewer++) {
          const v = redact(mid, viewer)
          expect(v.players[viewer].hand).toEqual(mid.players[viewer].hand)
          v.players.forEach((p, s) => {
            expect(p.hand).toHaveLength(mid.players[s].hand.length)
            if (s !== viewer) expect(p.hand.every((c) => c === HIDDEN_CARD)).toBe(true)
            expect(p.captured).toEqual(mid.players[s].captured)
          })
          expect(v.deck).toHaveLength(mid.deck.length)
          expect(v.deck.every((c) => c === HIDDEN_CARD)).toBe(true)
          expect(v.table).toEqual(mid.table)
          expect(publicHash(redact(v, viewer))).toBe(publicHash(v))
          expect(publicHash(v)).not.toBe(publicHash(mid))
        }
        const spectator = redact(mid, null)
        expect(spectator.players.every((p) => p.hand.every((c) => c === HIDDEN_CARD))).toBe(true)
      })
    }
  }
})
