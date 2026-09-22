import type { CardId } from './cards'

/** Seat index, 0..playerCount-1. Turn order is seat order (mod n). */
export type Seat = number

export interface GameConfig {
  playerCount: 2 | 3
  seed: number
  /** 선 — the seat that plays first. */
  startingSeat: Seat
  names: string[]
  rulesVersion: string
  /** Minimum score to be offered 고/스톱 (3; lobbies may offer 7 for 3P). */
  minStopScore: number
  /** 총통 (four of a month dealt) wins this many points; 0 disables. */
  chongtongPoints: number
  /** 국진 (9월 열끗) as 열끗, as 쌍피, or the captor's choice. */
  kukjin: 'choice' | 'animal' | 'junk'
  pibak: boolean
  /** 피박 applies when the loser's junk value is below this (7). */
  pibakThreshold: number
  gwangbak: boolean
  mongbak: boolean
  gobak: boolean
  /** 3P only: a lone go-loser pays both shares. */
  dokbak: boolean
  /** 피 stolen per opponent when taking another's 뻑. */
  ppeokSteal: number
  /** 피 stolen per opponent when taking your own 뻑 (자뻑). */
  jappeokSteal: number
  /** Three consecutive 뻑 by one player: ignored, or an instant win. */
  samyeonppeok: 'off' | 'win'
  /** Steals take from every opponent (true) or only the richest in 피 (false). */
  stealFromAll: boolean
  /** Carried in from a 나가리; multiplies the settlement. */
  carryMultiplier: number
  /** Money only: cash per point and the per-판 point ceiling. */
  pointValue: number
  capPoints: number
}

export function defaultConfig(
  playerCount: 2 | 3,
  seed: number,
  startingSeat: Seat = 0,
  names?: string[],
): GameConfig {
  return {
    playerCount,
    seed,
    startingSeat,
    names: names ?? Array.from({ length: playerCount }, (_, i) => `P${i}`),
    rulesVersion: '1',
    minStopScore: 3,
    chongtongPoints: 10,
    kukjin: 'choice',
    pibak: true,
    pibakThreshold: 7,
    gwangbak: true,
    mongbak: false,
    gobak: true,
    dokbak: true,
    ppeokSteal: 1,
    jappeokSteal: 1,
    samyeonppeok: 'off',
    stealFromAll: true,
    carryMultiplier: 1,
    pointValue: 100,
    capPoints: 50,
  }
}

export interface PlayerState {
  hand: CardId[]
  captured: CardId[]
  /** 국진 counted as 쌍피 (true) or 열끗 (false). Only meaningful once captured. */
  kukjinAsJunk: boolean
  goCount: number
  scoreAtLastGo: number
  shakes: number
  bombs: number
  /** Turns owed after a 폭탄: a `pass` flips a deck card without playing. */
  bombPasses: number
  shookMonths: number[]
  /** Consecutive own turns ending in a 뻑 (삼연뻑). */
  ppeokStreak: number
}

/**
 * The current turn's bookkeeping. Cards are never *owned* by the scratch:
 * every card is always in exactly one hand, the table, the deck or a
 * captured pile, so conservation is a plain sum over those four.
 */
export interface TurnScratch {
  /** The hand card played this turn (null on a `pass`). */
  playedCard: CardId | null
  /** Table cards the played card matched (already captured, may return on a 뻑). */
  playedMatched: CardId[]
  /** The played card found no match and sits on the table. */
  playedLaid: boolean
  /** The deck card flipped this turn. */
  flipped: CardId | null
  /** Two table cards the flip could take: the actor must `choose`. */
  flipMatches: CardId[]
  /** Everything that entered the actor's pile this turn (captures and steals). */
  capturedThisTurn: CardId[]
}

export type TurnEventType =
  | 'ppeok'
  | 'ttadak'
  | 'jjok'
  | 'sseul'
  | 'jappeok'
  | 'ppeokCapture'
  | 'bomb'
  | 'shake'
  | 'steal'
  | 'go'
  | 'stop'
  | 'nagari'
  | 'chongtong'
  | 'samyeonppeok'
  | 'concede'

export interface TurnEvent {
  type: TurnEventType
  seat: Seat
  month?: number
  cards?: CardId[]
  /** `steal`: the victim. */
  from?: Seat
  /** `steal`: what triggered it; `go`: the new go count. */
  reason?: string
  count?: number
}

/** A 뻑 stack on the table: three cards of `month`, made by `by`. */
export interface PpeokMark {
  month: number
  by: Seat
}

export interface ScoreBreakdown {
  gwangCount: number
  biGwang: boolean
  gwangPoints: number
  animalCount: number
  godori: boolean
  animalPoints: number
  ribbonCount: number
  hongdan: boolean
  cheongdan: boolean
  chodan: boolean
  ribbonPoints: number
  junkValue: number
  junkPoints: number
  total: number
}

export type ResultReason = 'stop' | 'nagari' | 'concede' | 'chongtong' | 'samyeonppeok'

export interface LoserShare {
  seat: Seat
  /** Points owed to the winner (before the money cap). */
  points: number
  /** 'pibak' | 'gwangbak' | 'mongbak' | 'gobak' | 'dokbak' | 'concede' | … */
  tags: string[]
}

export interface GoStopResult {
  winner: Seat | null
  /** The winner's raw score (or the flat award for 총통/양보). */
  score: number
  /** Score after the go adjustment, before multipliers. */
  goAdj: number
  /** 2^(shakes+bombs) × carry. */
  multiplier: number
  breakdown: ScoreBreakdown | null
  perLoser: LoserShare[]
  /** Net points per seat, zero-sum, uncapped (the money adapter caps). */
  payoutPoints: number[]
  /** Carry multiplier for the next 판 (1 after a decision, doubled after 나가리). */
  nextCarry: number
  reason: ResultReason
}

/**
 * - `play`: the turn holder plays a hand card (or a bomb `pass`).
 * - `chooseFlipMatch`: the flipped card matched two table cards; pick one.
 * - `kukjin`: 국진 was just captured; decide how it counts.
 * - `goStop`: the score allows stopping; declare 고 or 스톱.
 */
export type Phase = 'play' | 'chooseFlipMatch' | 'kukjin' | 'goStop'

export interface GameState {
  /** The rules this 판 was created with; part of the hashed state so every client agrees. */
  cfg: GameConfig
  players: PlayerState[]
  table: CardId[]
  /** Face-down; a flip takes the last element. */
  deck: CardId[]
  turn: Seat
  startingSeat: Seat
  phase: Phase
  scratch: TurnScratch
  ppeokMarks: PpeokMark[]
  carryMultiplier: number
  /** Public toasts for the current turn; cleared when the next turn starts. */
  events: TurnEvent[]
  result: GoStopResult | null
}

export type Move =
  /** Play `card`; `target` picks one of two matches; `shake` declares 흔들기; `bomb` plays all three of the month. */
  | { type: 'play'; card: CardId; target?: CardId; shake?: boolean; bomb?: boolean }
  /** Spend a bomb credit: flip a deck card without playing. */
  | { type: 'pass' }
  | { type: 'choose'; card: CardId }
  | { type: 'kukjin'; asJunk: boolean }
  | { type: 'go' }
  | { type: 'stop' }
  /** Any seat, any time: forfeit at the minimum score. */
  | { type: 'concede' }
