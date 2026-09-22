import { month } from './cards'
import { tokens } from './apply'
import type { GameState, Move, Seat } from './types'

/**
 * Every legal move for `seat` — drives playout tests and UI affordances.
 * `concede` is always available to any seat of an unfinished game; the
 * rest belong to the turn holder in the current phase.
 */
export function legalMoves(state: GameState, seat: Seat): Move[] {
  if (state.result || !state.players[seat]) return []
  const moves: Move[] = [{ type: 'concede' }]
  if (seat !== state.turn) return moves
  const player = state.players[seat]

  switch (state.phase) {
    case 'play': {
      for (const card of player.hand) {
        const m = month(card)
        const inHand = player.hand.filter((c) => month(c) === m).length
        const onTable = state.table.filter((c) => month(c) === m)
        if (onTable.length === 2) {
          for (const target of onTable) moves.push({ type: 'play', card, target })
        } else {
          moves.push({ type: 'play', card })
        }
        if (inHand >= 3 && onTable.length === 0 && !player.shookMonths.includes(m)) {
          moves.push({ type: 'play', card, shake: true })
        }
        if (inHand >= 3 && onTable.length === 1) {
          moves.push({ type: 'play', card, bomb: true })
        }
      }
      if (player.bombPasses > 0) moves.push({ type: 'pass' })
      return moves
    }
    case 'chooseFlipMatch':
      for (const card of state.scratch.flipMatches) moves.push({ type: 'choose', card })
      return moves
    case 'kukjin':
      moves.push({ type: 'kukjin', asJunk: true }, { type: 'kukjin', asJunk: false })
      return moves
    case 'goStop':
      moves.push({ type: 'stop' })
      if (tokens(player) > 0) moves.push({ type: 'go' })
      return moves
  }
}
