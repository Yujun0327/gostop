import { BI_GWANG, BLUE_RIBBONS, GODORI, GRASS_RIBBONS, KUKJIN, RED_RIBBONS, card, junkValue } from './cards'
import type { CardId } from './cards'
import type { GameConfig, GameState, GoStopResult, LoserShare, PlayerState, ResultReason, ScoreBreakdown, Seat } from './types'

function has(pile: readonly CardId[], ids: readonly CardId[]): boolean {
  return ids.every((id) => pile.includes(id))
}

export function gwangCount(p: PlayerState): number {
  return p.captured.filter((id) => card(id).kind === 'gwang').length
}

export function animalCount(p: PlayerState): number {
  return p.captured.filter((id) => card(id).kind === 'animal' && !(id === KUKJIN && p.kukjinAsJunk)).length
}

export function ribbonCount(p: PlayerState): number {
  return p.captured.filter((id) => card(id).kind === 'ribbon').length
}

/** 피 value: plain 1, 쌍피 2, 국진 2 when counted as junk. */
export function junkTotal(p: PlayerState): number {
  return p.captured.reduce((v, id) => v + (id === KUKJIN && p.kukjinAsJunk ? 2 : junkValue(id)), 0)
}

export function breakdown(p: PlayerState): ScoreBreakdown {
  const gwangs = gwangCount(p)
  const biGwang = p.captured.includes(BI_GWANG)
  let gwangPoints = 0
  if (gwangs === 5) gwangPoints = 15
  else if (gwangs === 4) gwangPoints = 4
  else if (gwangs === 3) gwangPoints = biGwang ? 2 : 3

  const animals = animalCount(p)
  const godori = has(p.captured, GODORI)
  const animalPoints = (animals >= 5 ? animals - 4 : 0) + (godori ? 5 : 0)

  const ribbons = ribbonCount(p)
  const hongdan = has(p.captured, RED_RIBBONS)
  const cheongdan = has(p.captured, BLUE_RIBBONS)
  const chodan = has(p.captured, GRASS_RIBBONS)
  const ribbonPoints =
    (ribbons >= 5 ? ribbons - 4 : 0) + (hongdan ? 3 : 0) + (cheongdan ? 3 : 0) + (chodan ? 3 : 0)

  const junk = junkTotal(p)
  const junkPoints = junk >= 10 ? junk - 9 : 0

  return {
    gwangCount: gwangs,
    biGwang,
    gwangPoints,
    animalCount: animals,
    godori,
    animalPoints,
    ribbonCount: ribbons,
    hongdan,
    cheongdan,
    chodan,
    ribbonPoints,
    junkValue: junk,
    junkPoints,
    total: gwangPoints + animalPoints + ribbonPoints + junkPoints,
  }
}

export function score(p: PlayerState): number {
  return breakdown(p).total
}

/** go ≤ 2 adds go points; from 3고 the (score + 2) doubles per extra go. */
export function goAdjusted(base: number, goCount: number): number {
  return goCount <= 2 ? base + goCount : (base + 2) * 2 ** (goCount - 2)
}

export interface SettleOptions {
  reason?: ResultReason
  /** A flat award (총통, 양보, 삼연뻑): no go adjustment, no 박, only × carry. */
  flat?: number
}

/**
 * The winner's settlement: goAdj × 2^(흔들기+폭탄) × carry, then per loser
 * ×2 for each 박 that applies; 3P 독박 makes a lone go-loser pay both shares.
 */
export function settle(state: GameState, winner: Seat, cfg: GameConfig, opts: SettleOptions = {}): GoStopResult {
  const n = state.players.length
  const w = state.players[winner]
  const carry = state.carryMultiplier
  const reason = opts.reason ?? 'stop'
  const losers = Array.from({ length: n }, (_, s) => s).filter((s) => s !== winner)

  let perLoser: LoserShare[]
  let base: number
  let goAdj: number
  let multiplier: number
  let bd: ScoreBreakdown | null

  if (opts.flat !== undefined) {
    base = opts.flat
    goAdj = base
    multiplier = carry
    bd = null
    perLoser = losers.map((seat) => ({ seat, points: base * carry, tags: [reason] }))
  } else {
    bd = breakdown(w)
    base = bd.total
    goAdj = goAdjusted(base, w.goCount)
    multiplier = 2 ** (w.shakes + w.bombs) * carry
    const winnerPoints = goAdj * multiplier
    const wb = bd

    perLoser = losers.map((seat) => {
      const l = state.players[seat]
      const tags: string[] = []
      if (cfg.pibak && wb.junkPoints > 0 && junkTotal(l) < cfg.pibakThreshold) tags.push('pibak')
      if (cfg.gwangbak && wb.gwangPoints > 0 && gwangCount(l) === 0) tags.push('gwangbak')
      if (cfg.mongbak && wb.animalCount >= 7 && animalCount(l) === 0) tags.push('mongbak')
      if (cfg.gobak && l.goCount > 0) tags.push('gobak')
      return { seat, points: winnerPoints * 2 ** tags.length, tags }
    })

    const goLosers = perLoser.filter((s) => s.tags.includes('gobak'))
    if (n === 3 && cfg.dokbak && goLosers.length === 1) {
      const dok = goLosers[0]
      const total = perLoser.reduce((sum, s) => sum + s.points / (s.tags.includes('gobak') ? 2 : 1), 0)
      perLoser = perLoser.map((s) =>
        s.seat === dok.seat
          ? { seat: s.seat, points: total, tags: [...s.tags.filter((t) => t !== 'gobak'), 'dokbak'] }
          : { seat: s.seat, points: 0, tags: [...s.tags, 'dokbak-exempt'] },
      )
    }
  }

  const payoutPoints = Array.from({ length: n }, () => 0)
  for (const s of perLoser) {
    payoutPoints[s.seat] -= s.points
    payoutPoints[winner] += s.points
  }

  return { winner, score: base, goAdj, multiplier, breakdown: bd, perLoser, payoutPoints, nextCarry: 1, reason }
}
