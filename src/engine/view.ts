import { deepClone } from './clone'
import { HIDDEN_CARD } from './cards'
import type { GameState, Seat } from './types'

/**
 * The viewer's redacted picture: other hands and the deck become HIDDEN_CARD
 * (lengths kept); the table, piles, scratch and events are public. Display
 * privacy only — every client holds the seed-derived full state and
 * `publicHash` covers all of it (honor system, see README).
 */
export function redact(state: GameState, viewer: Seat | null): GameState {
  const view = deepClone(state)
  view.players.forEach((p, seat) => {
    if (seat !== viewer) p.hand = p.hand.map(() => HIDDEN_CARD)
  })
  view.deck = view.deck.map(() => HIDDEN_CARD)
  return view
}
