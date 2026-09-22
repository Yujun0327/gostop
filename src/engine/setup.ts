import { finish } from './apply'
import { ALL_IDS, month } from './cards'
import type { CardId } from './cards'
import { mulberry32, seededShuffle } from './rng'
import type { GameConfig, GameState, PlayerState, TurnScratch } from './types'

/** 10 + 8 for 맞고, 7 + 6 for 3P 고스탑. */
export function dealSizes(playerCount: 2 | 3): { hand: number; table: number } {
  return playerCount === 2 ? { hand: 10, table: 8 } : { hand: 7, table: 6 }
}

export function emptyScratch(): TurnScratch {
  return { playedCard: null, playedMatched: [], playedLaid: false, flipped: null, flipMatches: [], capturedThisTurn: [] }
}

export function emptyPlayer(hand: CardId[] = []): PlayerState {
  return {
    hand,
    captured: [],
    kukjinAsJunk: false,
    goCount: 0,
    scoreAtLastGo: 0,
    shakes: 0,
    bombs: 0,
    bombPasses: 0,
    shookMonths: [],
    ppeokStreak: 0,
  }
}

/** True when some month has all four cards in `cards`. */
export function hasFourOfMonth(cards: readonly CardId[]): number | null {
  const counts = new Map<number, number>()
  for (const id of cards) counts.set(month(id), (counts.get(month(id)) ?? 0) + 1)
  for (const [m, c] of counts) if (c === 4) return m
  return null
}

/**
 * Deterministic: one seeded rng drives the shuffle, the seat-order deal and
 * any redeal (a table showing four of a month is dealt again from the same
 * stream), so every client derives the identical state — which is what
 * makes hidden hands an honor system (README).
 */
export function createGame(cfg: GameConfig): GameState {
  const rng = mulberry32(cfg.seed)
  const { hand, table } = dealSizes(cfg.playerCount)

  let deck: CardId[]
  let hands: CardId[][]
  let tableCards: CardId[]
  do {
    deck = seededShuffle(ALL_IDS, rng)
    hands = Array.from({ length: cfg.playerCount }, () => deck.splice(deck.length - hand, hand))
    tableCards = deck.splice(deck.length - table, table)
  } while (hasFourOfMonth(tableCards) !== null)

  const state: GameState = {
    cfg,
    players: hands.map((h) => emptyPlayer(h)),
    table: tableCards,
    deck,
    turn: cfg.startingSeat,
    startingSeat: cfg.startingSeat,
    phase: 'play',
    scratch: emptyScratch(),
    ppeokMarks: [],
    carryMultiplier: cfg.carryMultiplier,
    events: [],
    result: null,
  }

  // 총통: four of a month in hand wins outright (선 first on the freak double).
  if (cfg.chongtongPoints > 0) {
    for (let i = 0; i < cfg.playerCount; i++) {
      const seat = (cfg.startingSeat + i) % cfg.playerCount
      const m = hasFourOfMonth(state.players[seat].hand)
      if (m !== null) {
        state.events.push({ type: 'chongtong', seat, month: m })
        finish(state, seat, { reason: 'chongtong', flat: cfg.chongtongPoints })
        break
      }
    }
  }

  return state
}
