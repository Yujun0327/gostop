import { describe, expect, it } from 'vitest'
import { breakdown, goAdjusted, score, settle } from '../src/engine'
import type { CardId, GameConfig } from '../src/engine'
import { buildState, makeConfig, pile } from './helpers'
import type { Scenario } from './helpers'

const J = (n: number): CardId[] => ['m01c', 'm01d', 'm02c', 'm02d', 'm03c', 'm03d', 'm04c', 'm04d', 'm05c', 'm05d', 'm06c', 'm06d', 'm07c', 'm07d'].slice(0, n)

describe('breakdown', () => {
  it('scores 광: 3 → 3, 비삼광 → 2, 4 → 4, 5 → 15', () => {
    expect(breakdown(pile(['m01a', 'm03a', 'm08a'])).gwangPoints).toBe(3)
    expect(breakdown(pile(['m01a', 'm03a', 'm12a'])).gwangPoints).toBe(2)
    expect(breakdown(pile(['m01a', 'm03a', 'm08a', 'm12a'])).gwangPoints).toBe(4)
    expect(breakdown(pile(['m01a', 'm03a', 'm08a', 'm11a', 'm12a'])).gwangPoints).toBe(15)
    expect(breakdown(pile(['m01a', 'm03a'])).gwangPoints).toBe(0)
  })

  it('scores 열끗: 5 → 1, 7 → 3; 고도리 +5', () => {
    expect(breakdown(pile(['m05a', 'm06a', 'm07a', 'm10a', 'm12b'])).animalPoints).toBe(1)
    expect(breakdown(pile(['m05a', 'm06a', 'm07a', 'm10a', 'm12b', 'm09a', 'm02a'])).animalPoints).toBe(3)
    expect(breakdown(pile(['m02a', 'm04a', 'm08b'])).animalPoints).toBe(5)
    const seven = breakdown(pile(['m02a', 'm04a', 'm08b', 'm05a', 'm06a', 'm07a', 'm10a']))
    expect(seven.godori).toBe(true)
    expect(seven.animalPoints).toBe(3 + 5)
  })

  it('scores 띠: 5 → 1; 홍단/청단/초단 +3 each', () => {
    expect(breakdown(pile(['m01b', 'm02b', 'm03b'])).ribbonPoints).toBe(3)
    expect(breakdown(pile(['m06b', 'm09b', 'm10b'])).ribbonPoints).toBe(3)
    expect(breakdown(pile(['m04b', 'm05b', 'm07b'])).ribbonPoints).toBe(3)
    expect(breakdown(pile(['m01b', 'm02b', 'm04b', 'm06b', 'm12c'])).ribbonPoints).toBe(1)
    const all = breakdown(pile(['m01b', 'm02b', 'm03b', 'm04b', 'm05b', 'm07b', 'm06b', 'm09b', 'm10b', 'm12c']))
    expect(all.ribbonPoints).toBe(6 + 9)
  })

  it('scores 피: value ≥ 10 → v − 9, 쌍피 counts 2', () => {
    expect(breakdown(pile(J(9))).junkPoints).toBe(0)
    expect(breakdown(pile(J(10))).junkPoints).toBe(1)
    expect(breakdown(pile([...J(8), 'm11b'])).junkPoints).toBe(1)
    expect(breakdown(pile([...J(8), 'm11b', 'm12d'])).junkPoints).toBe(3)
  })

  it('counts 국진 both ways', () => {
    const asAnimal = pile(['m09a', 'm05a', 'm06a', 'm07a', 'm10a', ...J(8)])
    expect(breakdown(asAnimal).animalPoints).toBe(1)
    expect(breakdown(asAnimal).junkPoints).toBe(0)
    const asJunk = pile(asAnimal.captured, { kukjinAsJunk: true })
    expect(breakdown(asJunk).animalPoints).toBe(0)
    expect(breakdown(asJunk).junkValue).toBe(10)
    expect(breakdown(asJunk).junkPoints).toBe(1)
  })

  it('sums categories into score()', () => {
    const p = pile(['m01a', 'm03a', 'm08a', 'm01b', 'm02b', 'm03b', ...J(11)])
    expect(score(p)).toBe(3 + 3 + 2)
  })
})

describe('go adjustment', () => {
  it('adds 1 and 2, then doubles from 3고', () => {
    expect(goAdjusted(3, 0)).toBe(3)
    expect(goAdjusted(3, 1)).toBe(4)
    expect(goAdjusted(3, 2)).toBe(5)
    expect(goAdjusted(3, 3)).toBe(10)
    expect(goAdjusted(3, 4)).toBe(20)
    expect(goAdjusted(3, 5)).toBe(40)
    expect(goAdjusted(7, 3)).toBe(18)
  })
})

describe('settle', () => {
  const BIG_JUNK = [...J(10), 'm08c', 'm08d'] // 12 junk → 3 points
  const GWANG3 = ['m01a', 'm03a', 'm08a']

  function game(captured: CardId[][], over: Partial<GameConfig> = {}, patch?: Scenario['patch']) {
    return buildState({ players: captured.length, captured, cfg: over, patch })
  }

  it('plain win: loser pays the score, payouts are zero-sum', () => {
    const s = game([[...GWANG3, 'm11a'], ['m12a', ...J(7)]])
    const r = settle(s, 0, s.cfg)
    expect(r.score).toBe(4)
    expect(r.perLoser).toEqual([{ seat: 1, points: 4, tags: [] }])
    expect(r.payoutPoints).toEqual([4, -4])
    expect(r.nextCarry).toBe(1)
    expect(r.reason).toBe('stop')
  })

  it('applies 피박 when the loser has < 7 피 and the winner scored 피', () => {
    const s = game([BIG_JUNK, J(6)])
    const r = settle(s, 0, s.cfg)
    expect(r.perLoser[0]).toEqual({ seat: 1, points: 6, tags: ['pibak'] })
    const s2 = game([BIG_JUNK, J(7)])
    expect(settle(s2, 0, s2.cfg).perLoser[0].tags).toEqual([])
    const s3 = game([BIG_JUNK, J(6)], { pibak: false })
    expect(settle(s3, 0, s3.cfg).perLoser[0].tags).toEqual([])
  })

  it('does not apply 피박 when the winner scored no 피', () => {
    const s = game([GWANG3, ['m11a', ...J(2)]])
    expect(settle(s, 0, s.cfg).perLoser[0].tags).toEqual([])
  })

  it('applies 광박 when the loser has no 광 and the winner scored 광', () => {
    const s = game([GWANG3, J(8)])
    expect(settle(s, 0, s.cfg).perLoser[0]).toEqual({ seat: 1, points: 6, tags: ['gwangbak'] })
    const s2 = game([GWANG3, ['m11a', ...J(8)]])
    expect(settle(s2, 0, s2.cfg).perLoser[0].tags).toEqual([])
  })

  it('stacks 피박 + 광박 (×4)', () => {
    const s = game([[...GWANG3, ...BIG_JUNK], J(3)])
    const r = settle(s, 0, s.cfg)
    expect(r.score).toBe(6)
    expect(r.perLoser[0]).toEqual({ seat: 1, points: 24, tags: ['pibak', 'gwangbak'] })
  })

  it('applies 멍박 only when enabled (winner ≥ 7 열끗, loser none)', () => {
    const animals = ['m02a', 'm04a', 'm05a', 'm06a', 'm07a', 'm08b', 'm10a']
    const off = game([animals, ['m01a', ...J(8)]])
    expect(settle(off, 0, off.cfg).perLoser[0].tags).toEqual([])
    const on = game([animals, ['m01a', ...J(8)]], { mongbak: true })
    expect(settle(on, 0, on.cfg).perLoser[0]).toEqual({ seat: 1, points: 16, tags: ['mongbak'] })
  })

  it('applies 고박 to a loser who had declared go', () => {
    const s = game([GWANG3, ['m11a', ...J(8)]], {}, (st) => {
      st.players[1].goCount = 1
    })
    expect(settle(s, 0, s.cfg).perLoser[0]).toEqual({ seat: 1, points: 6, tags: ['gobak'] })
  })

  it('applies the go adjustment and the 흔들기/폭탄 doubling', () => {
    const s = game([[...GWANG3, 'm11a'], ['m12a', ...J(8)]], {}, (st) => {
      st.players[0].goCount = 3
      st.players[0].shakes = 1
      st.players[0].bombs = 1
    })
    const r = settle(s, 0, s.cfg)
    expect(r.goAdj).toBe((4 + 2) * 2)
    expect(r.multiplier).toBe(4)
    expect(r.perLoser[0].points).toBe(48)
  })

  it('multiplies by the carried 나가리 multiplier', () => {
    const s = game([[...GWANG3, 'm11a'], ['m12a', ...J(8)]], {}, (st) => {
      st.carryMultiplier = 2
    })
    expect(settle(s, 0, s.cfg).perLoser[0].points).toBe(8)
  })

  it('3P 독박: the lone go-loser pays both shares without the 고박 doubling', () => {
    const s = game([[...GWANG3, 'm11a'], ['m12a', ...J(8)], ['m12a', ...J(3)]], {}, (st) => {
      st.players[1].goCount = 2
    })
    const r = settle(s, 0, s.cfg)
    expect(r.score).toBe(4)
    // seat 2 alone would pay 4 (no 박: winner scored no 피); seat 1 pays 4 + 4
    expect(r.perLoser).toEqual([
      { seat: 1, points: 8, tags: ['dokbak'] },
      { seat: 2, points: 0, tags: ['dokbak-exempt'] },
    ])
    expect(r.payoutPoints).toEqual([8, -8, 0])
  })

  it('3P without 독박: 고박 doubles the go-loser only', () => {
    const s = game([[...GWANG3, 'm11a'], ['m12a', ...J(8)], ['m12a', ...J(8)]], { dokbak: false }, (st) => {
      st.players[1].goCount = 1
    })
    const r = settle(s, 0, s.cfg)
    expect(r.perLoser).toEqual([
      { seat: 1, points: 8, tags: ['gobak'] },
      { seat: 2, points: 4, tags: [] },
    ])
  })

  it('3P with two go-losers: no 독박, both 고박', () => {
    const s = game([[...GWANG3, 'm11a'], ['m12a', ...J(8)], ['m12a', ...J(8)]], {}, (st) => {
      st.players[1].goCount = 1
      st.players[2].goCount = 1
    })
    const r = settle(s, 0, s.cfg)
    expect(r.perLoser.map((l) => l.points)).toEqual([8, 8])
    expect(r.payoutPoints).toEqual([16, -8, -8])
  })

  it('flat settlements skip go, 흔들기 and 박', () => {
    const s = game([[...GWANG3, ...BIG_JUNK], J(2)], {}, (st) => {
      st.players[0].goCount = 3
      st.players[0].shakes = 1
      st.carryMultiplier = 2
    })
    const r = settle(s, 0, s.cfg, { reason: 'concede', flat: 3 })
    expect(r.perLoser).toEqual([{ seat: 1, points: 6, tags: ['concede'] }])
    expect(r.breakdown).toBeNull()
    expect(r.reason).toBe('concede')
  })

  it('uses defaultConfig house rules', () => {
    const cfg = makeConfig(2)
    expect(cfg).toMatchObject({ minStopScore: 3, chongtongPoints: 10, kukjin: 'choice', pibak: true, pibakThreshold: 7, gwangbak: true, mongbak: false, gobak: true, dokbak: true, ppeokSteal: 1, jappeokSteal: 1, samyeonppeok: 'off', stealFromAll: true, carryMultiplier: 1, pointValue: 100, capPoints: 50, rulesVersion: '1' })
  })
})
