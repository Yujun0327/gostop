import { KUKJIN, card, month } from './cards'
import type { CardId } from './cards'
import { deepClone } from './clone'
import { junkTotal, score, settle } from './scoring'
import type { SettleOptions } from './scoring'
import type { GameState, Move, PlayerState, Seat, TurnEventType } from './types'

/** Turns a player can still take: hand cards plus bomb credits. */
export function tokens(p: PlayerState): number {
  return p.hand.length + p.bombPasses
}

function remove(arr: CardId[], id: CardId): void {
  const at = arr.indexOf(id)
  if (at < 0) throw new Error(`card ${id} not found`)
  arr.splice(at, 1)
}

function tableMatches(state: GameState, id: CardId): CardId[] {
  const m = month(id)
  return state.table.filter((t) => month(t) === m)
}

function emit(state: GameState, type: TurnEventType, seat: Seat, extra: Partial<GameState['events'][number]> = {}): void {
  state.events.push({ type, seat, ...extra })
}

/** Sets `state.result` (mutating). Shared with setup for 총통. */
export function finish(state: GameState, winner: Seat, opts: SettleOptions = {}): void {
  state.result = settle(state, winner, state.cfg, opts)
}

/**
 * The single pure reducer: throws on any illegal move, never mutates `prev`.
 * One `play` runs the whole turn (play → resolve → flip → resolve) and only
 * pauses on a decision (`chooseFlipMatch`, `kukjin`, `goStop`).
 */
export function applyMove(prev: GameState, actor: Seat, move: Move): GameState {
  if (prev.result) throw new Error('game is over')
  if (!prev.players[actor]) throw new Error('no such seat')

  const state = deepClone(prev)
  const cfg = state.cfg

  if (move.type === 'concede') {
    concede(state, actor)
    return state
  }

  if (actor !== state.turn) throw new Error('not your turn')
  const player = state.players[actor]

  switch (move.type) {
    case 'play': {
      if (state.phase !== 'play') throw new Error('not in play phase')
      if (!player.hand.includes(move.card)) throw new Error('card not in hand')
      if (move.shake && move.bomb) throw new Error('bomb already doubles')
      beginTurn(state)
      const m = month(move.card)
      const inHand = player.hand.filter((c) => month(c) === m)
      const onTable = tableMatches(state, move.card)

      if (move.bomb) {
        if (inHand.length < 3) throw new Error('bomb needs three of the month in hand')
        if (onTable.length !== 1) throw new Error('bomb needs exactly one of the month on the table')
        for (const c of inHand) remove(player.hand, c)
        for (const c of onTable) remove(state.table, c)
        capture(state, actor, [...inHand, ...onTable])
        state.scratch.playedCard = move.card
        player.bombs += 1
        player.bombPasses += 2
        emit(state, 'bomb', actor, { month: m, cards: [...inHand, ...onTable] })
        steal(state, actor, 1, 'bomb')
      } else {
        if (move.shake) {
          if (inHand.length < 3) throw new Error('shake needs three of the month in hand')
          if (onTable.length !== 0) throw new Error('cannot shake a month that is on the table')
          if (player.shookMonths.includes(m)) throw new Error('month already shaken')
          player.shakes += 1
          player.shookMonths.push(m)
          emit(state, 'shake', actor, { month: m, cards: inHand })
        }
        if (onTable.length === 2) {
          if (!move.target) throw new Error('target required')
          if (!onTable.includes(move.target)) throw new Error('target does not match')
        } else if (move.target !== undefined) {
          throw new Error('no target to choose')
        }

        remove(player.hand, move.card)
        state.scratch.playedCard = move.card
        if (onTable.length === 0) {
          state.table.push(move.card)
          state.scratch.playedLaid = true
        } else {
          const taken = onTable.length === 2 ? [move.target!] : onTable
          for (const c of taken) remove(state.table, c)
          state.scratch.playedMatched = taken
          capture(state, actor, [move.card, ...taken])
          if (onTable.length === 3) ppeokTaken(state, actor, m)
        }
      }

      flip(state, actor)
      return state
    }

    case 'pass': {
      if (state.phase !== 'play') throw new Error('not in play phase')
      if (player.bombPasses <= 0) throw new Error('no bomb credit')
      beginTurn(state)
      player.bombPasses -= 1
      flip(state, actor)
      return state
    }

    case 'choose': {
      if (state.phase !== 'chooseFlipMatch') throw new Error('no choice pending')
      if (!state.scratch.flipMatches.includes(move.card)) throw new Error('not a matching card')
      const f = state.scratch.flipped!
      remove(state.table, f)
      remove(state.table, move.card)
      state.scratch.flipMatches = []
      capture(state, actor, [f, move.card])
      finishTurn(state, actor)
      return state
    }

    case 'kukjin': {
      if (state.phase !== 'kukjin') throw new Error('no kukjin decision pending')
      player.kukjinAsJunk = move.asJunk
      afterTurn(state, actor)
      return state
    }

    case 'go': {
      if (state.phase !== 'goStop') throw new Error('not offered go')
      if (tokens(player) === 0) throw new Error('no cards left to go')
      player.goCount += 1
      player.scoreAtLastGo = score(player)
      emit(state, 'go', actor, { count: player.goCount })
      advanceTurn(state, actor)
      return state
    }

    case 'stop': {
      if (state.phase !== 'goStop') throw new Error('not offered stop')
      emit(state, 'stop', actor)
      finish(state, actor, { reason: 'stop' })
      return state
    }
  }
}

function beginTurn(state: GameState): void {
  state.events = []
  state.scratch = { playedCard: null, playedMatched: [], playedLaid: false, flipped: null, flipMatches: [], capturedThisTurn: [] }
}

function capture(state: GameState, actor: Seat, cards: CardId[]): void {
  state.players[actor].captured.push(...cards)
  state.scratch.capturedThisTurn.push(...cards)
}

/** A three-card stack was just taken: 뻑 capture or 자뻑, with steals. */
function ppeokTaken(state: GameState, actor: Seat, m: number): void {
  const cfg = state.cfg
  const at = state.ppeokMarks.findIndex((p) => p.month === m)
  if (at < 0) return // three of a month from the deal: a plain capture
  const mark = state.ppeokMarks.splice(at, 1)[0]
  if (mark.by === actor) {
    emit(state, 'jappeok', actor, { month: m })
    steal(state, actor, cfg.jappeokSteal, 'jappeok')
  } else {
    emit(state, 'ppeokCapture', actor, { month: m, from: mark.by })
    steal(state, actor, cfg.ppeokSteal, 'ppeokCapture')
  }
}

/** Flip the top deck card and resolve it against the table and the played card. */
function flip(state: GameState, actor: Seat): void {
  const f = state.deck.pop()
  if (f === undefined) throw new Error('deck is empty')
  const s = state.scratch
  s.flipped = f
  const fm = month(f)
  const played = s.playedCard

  if (played !== null && month(played) === fm) {
    // the flip interacts with this turn's own play
    if (s.playedLaid) {
      // 쪽: the laid card comes straight back with the flip
      remove(state.table, played)
      s.playedLaid = false
      capture(state, actor, [played, f])
      emit(state, 'jjok', actor, { month: fm, cards: [played, f] })
      steal(state, actor, 1, 'jjok')
      finishTurn(state, actor)
      return
    }
    if (s.playedMatched.length === 1 && tableMatches(state, f).length === 0) {
      // 뻑: play, match and flip all stay on the table
      const back = [played, ...s.playedMatched]
      for (const c of back) {
        remove(state.players[actor].captured, c)
        remove(s.capturedThisTurn, c)
      }
      state.table.push(...back, f)
      s.playedMatched = []
      state.ppeokMarks.push({ month: fm, by: actor })
      state.players[actor].ppeokStreak += 1
      emit(state, 'ppeok', actor, { month: fm, cards: [...back, f] })
      finishTurn(state, actor)
      return
    }
    if (s.playedMatched.length === 1 && tableMatches(state, f).length === 1) {
      // 따닥: the flip completes the month after a two-way choice
      const last = tableMatches(state, f)[0]
      remove(state.table, last)
      capture(state, actor, [f, last])
      emit(state, 'ttadak', actor, { month: fm, cards: [played, ...s.playedMatched, f, last] })
      steal(state, actor, 1, 'ttadak')
      finishTurn(state, actor)
      return
    }
  }

  resolveFlip(state, actor, f)
}

/** The flip against the free table cards (0/1/2/3 matches). */
function resolveFlip(state: GameState, actor: Seat, f: CardId): void {
  const matches = tableMatches(state, f)
  const fm = month(f)
  if (matches.length === 0) {
    state.table.push(f)
  } else if (matches.length === 2) {
    state.table.push(f)
    state.scratch.flipMatches = matches
    state.phase = 'chooseFlipMatch'
    return
  } else {
    for (const c of matches) remove(state.table, c)
    capture(state, actor, [f, ...matches])
    if (matches.length === 3) ppeokTaken(state, actor, fm)
  }
  finishTurn(state, actor)
}

/**
 * Take `count` 피 per victim: a plain 피 first, else a 쌍피, never 국진,
 * never a debt. Victims are all opponents, or only the richest in 피.
 */
function steal(state: GameState, actor: Seat, count: number, reason: string): void {
  const cfg = state.cfg
  if (count <= 0) return
  const n = state.players.length
  let victims = Array.from({ length: n - 1 }, (_, i) => (actor + 1 + i) % n)
  if (!cfg.stealFromAll) {
    victims = [victims.reduce((best, s) => (junkTotal(state.players[s]) > junkTotal(state.players[best]) ? s : best))]
  }
  for (const v of victims) {
    const pile = state.players[v].captured
    const taken: CardId[] = []
    for (let i = 0; i < count; i++) {
      const pick =
        pile.find((id) => card(id).kind === 'junk' && !card(id).double) ??
        pile.find((id) => card(id).kind === 'junk' && card(id).double)
      if (pick === undefined) break
      remove(pile, pick)
      taken.push(pick)
    }
    if (taken.length) {
      capture(state, actor, taken)
      emit(state, 'steal', actor, { from: v, cards: taken, reason })
    }
  }
}

/** Captures are in; check 싹쓸이 and 국진, then hand over to the go/stop logic. */
function finishTurn(state: GameState, actor: Seat): void {
  const cfg = state.cfg
  const s = state.scratch
  if (s.capturedThisTurn.length > 0 && state.table.length === 0) {
    emit(state, 'sseul', actor)
    steal(state, actor, 1, 'sseul')
  }
  if (s.capturedThisTurn.includes(KUKJIN)) {
    if (cfg.kukjin === 'choice') {
      state.phase = 'kukjin'
      return
    }
    state.players[actor].kukjinAsJunk = cfg.kukjin === 'junk'
  }
  afterTurn(state, actor)
}

/** Offer 고/스톱, auto-stop when out of cards, or move on. */
function afterTurn(state: GameState, actor: Seat): void {
  const cfg = state.cfg
  const p = state.players[actor]
  if (!state.events.some((e) => e.type === 'ppeok')) {
    p.ppeokStreak = 0
  } else if (cfg.samyeonppeok === 'win' && p.ppeokStreak >= 3) {
    emit(state, 'samyeonppeok', actor)
    finish(state, actor, { reason: 'samyeonppeok', flat: cfg.minStopScore })
    return
  }

  const s = score(p)
  const eligible = s >= cfg.minStopScore && (p.goCount === 0 || s > p.scoreAtLastGo)
  if (eligible) {
    if (tokens(p) > 0) {
      state.phase = 'goStop'
      return
    }
    emit(state, 'stop', actor)
    finish(state, actor, { reason: 'stop' })
    return
  }
  advanceTurn(state, actor)
}

/** Next seat with a turn left; nobody → 나가리 (carry doubles). */
function advanceTurn(state: GameState, actor: Seat): void {
  const n = state.players.length
  for (let i = 1; i <= n; i++) {
    const seat = (actor + i) % n
    if (tokens(state.players[seat]) > 0) {
      state.turn = seat
      state.phase = 'play'
      return
    }
  }
  emit(state, 'nagari', actor)
  state.phase = 'play'
  state.result = {
    winner: null,
    score: 0,
    goAdj: 0,
    multiplier: state.carryMultiplier,
    breakdown: null,
    perLoser: [],
    payoutPoints: Array.from({ length: n }, () => 0),
    nextCarry: state.carryMultiplier * 2,
    reason: 'nagari',
  }
}

/** 2P: the other seat wins the minimum; 3P: the conceder pays two minimum shares. */
function concede(state: GameState, actor: Seat): void {
  const cfg = state.cfg
  const n = state.players.length
  const carry = state.carryMultiplier
  emit(state, 'concede', actor)
  if (n === 2) {
    finish(state, 1 - actor, { reason: 'concede', flat: cfg.minStopScore })
    return
  }
  const share = cfg.minStopScore * carry
  const payoutPoints = Array.from({ length: n }, (_, s) => (s === actor ? -2 * share : share))
  state.result = {
    winner: null,
    score: cfg.minStopScore,
    goAdj: cfg.minStopScore,
    multiplier: carry,
    breakdown: null,
    perLoser: [{ seat: actor, points: 2 * share, tags: ['concede'] }],
    payoutPoints,
    nextCarry: 1,
    reason: 'concede',
  }
}
