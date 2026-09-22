import { createGame, defaultConfig, emptyPlayer, emptyScratch } from '../src/engine'
import type { CardId, GameConfig, GameState, PlayerState, Seat } from '../src/engine'

export function makeConfig(playerCount: 2 | 3, seed = 42, startingSeat = 0, over: Partial<GameConfig> = {}): GameConfig {
  return { ...defaultConfig(playerCount, seed, startingSeat), ...over }
}

export function newGame(playerCount: 2 | 3, seed = 42, over: Partial<GameConfig> = {}): GameState {
  return createGame(makeConfig(playerCount, seed, 0, over))
}

export interface Scenario {
  players?: number
  cfg?: Partial<GameConfig>
  hands?: CardId[][]
  table?: CardId[]
  /** Flip order is from the END (last element flips first). */
  deck?: CardId[]
  captured?: CardId[][]
  turn?: Seat
  patch?: (state: GameState) => void
}

/** A hand-built state for scenario tests; unmentioned cards simply do not exist. */
export function buildState(sc: Scenario = {}): GameState {
  const n = (sc.players ?? sc.hands?.length ?? 2) as 2 | 3
  const cfg = makeConfig(n, 1, 0, sc.cfg)
  const players: PlayerState[] = Array.from({ length: n }, (_, i) => {
    const p = emptyPlayer([...(sc.hands?.[i] ?? [])])
    p.captured = [...(sc.captured?.[i] ?? [])]
    return p
  })
  const state: GameState = {
    cfg,
    players,
    table: [...(sc.table ?? [])],
    deck: [...(sc.deck ?? [])],
    turn: sc.turn ?? 0,
    startingSeat: 0,
    phase: 'play',
    scratch: emptyScratch(),
    ppeokMarks: [],
    carryMultiplier: cfg.carryMultiplier,
    events: [],
    result: null,
  }
  sc.patch?.(state)
  return state
}

/** A player state with a given pile (for scoring tests). */
export function pile(captured: CardId[], over: Partial<PlayerState> = {}): PlayerState {
  return { ...emptyPlayer(), captured: [...captured], ...over }
}

export function allCards(state: GameState): CardId[] {
  return [...state.deck, ...state.table, ...state.players.flatMap((p) => [...p.hand, ...p.captured])]
}
