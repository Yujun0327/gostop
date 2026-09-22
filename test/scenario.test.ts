import { describe, expect, it } from 'vitest'
import { ALL_IDS, applyMove, createGame, hasFourOfMonth, legalMoves, mulberry32, seededShuffle } from '../src/engine'
import type { GameState, Move } from '../src/engine'
import { buildState, makeConfig } from './helpers'

const J10 = ['m01c', 'm01d', 'm02c', 'm02d', 'm03c', 'm03d', 'm04c', 'm04d', 'm05c', 'm05d']

function types(state: GameState): string[] {
  return state.events.map((e) => e.type)
}

describe('뻑', () => {
  // deck flips from the end: m01c first, then m06c (P1's turn), then m07c
  const base = () =>
    buildState({
      hands: [['m01a', 'm01d', 'm08c'], ['m05a', 'm06d']],
      table: ['m01b', 'm09c'],
      deck: ['m10c', 'm07c', 'm06c', 'm01c'],
      captured: [['m03c'], ['m02c']],
    })

  it('leaves play, match and flip on the table with a mark', () => {
    let s = applyMove(base(), 0, { type: 'play', card: 'm01a' })
    expect(types(s)).toEqual(['ppeok'])
    expect(s.table).toEqual(expect.arrayContaining(['m01a', 'm01b', 'm01c']))
    expect(s.players[0].captured).toEqual(['m03c'])
    expect(s.ppeokMarks).toEqual([{ month: 1, by: 0 }])
    expect(s.players[0].ppeokStreak).toBe(1)
    expect(s.turn).toBe(1)
    expect(s.phase).toBe('play')
    s = applyMove(s, 1, { type: 'play', card: 'm05a' })
    expect(s.events).toEqual([]) // events are cleared per turn (m05a laid, m06c laid)
  })

  it('자뻑: taking your own stack steals jappeokSteal from each opponent', () => {
    let s = applyMove(base(), 0, { type: 'play', card: 'm01a' })
    s = applyMove(s, 1, { type: 'play', card: 'm05a' })
    s = applyMove(s, 0, { type: 'play', card: 'm01d' })
    expect(types(s)).toEqual(['jappeok', 'steal'])
    expect(s.players[0].captured).toEqual(expect.arrayContaining(['m01a', 'm01b', 'm01c', 'm01d', 'm02c']))
    expect(s.players[1].captured).toEqual([])
    expect(s.ppeokMarks).toEqual([])
    expect(s.players[0].ppeokStreak).toBe(0) // the streak breaks on a non-뻑 turn
    expect(s.events[1]).toMatchObject({ type: 'steal', seat: 0, from: 1, cards: ['m02c'], reason: 'jappeok' })
  })

  it('뻑 captured by the opponent steals ppeokSteal from its maker', () => {
    const st = base()
    st.players[1].hand = ['m01d', 'm06d']
    let s = applyMove(st, 0, { type: 'play', card: 'm01a' })
    s = applyMove(s, 1, { type: 'play', card: 'm01d' })
    expect(types(s)).toEqual(['ppeokCapture', 'steal'])
    expect(s.events[0]).toMatchObject({ type: 'ppeokCapture', seat: 1, from: 0, month: 1 })
    expect(s.players[1].captured).toEqual(expect.arrayContaining(['m01a', 'm01b', 'm01c', 'm01d', 'm03c']))
    expect(s.players[0].captured).toEqual([])
  })

  it('a flip landing on the stack also takes it', () => {
    const st = base()
    st.deck = ['m10c', 'm01d', 'm01c']
    let s = applyMove(st, 0, { type: 'play', card: 'm01a' })
    s = applyMove(s, 1, { type: 'play', card: 'm05a' })
    expect(types(s)).toEqual(['ppeokCapture', 'steal'])
    expect(s.players[1].captured).toHaveLength(6) // 4 + m02c + stolen m03c
  })

  it('three of a month from the deal is a plain capture (no mark, no steal)', () => {
    const s = applyMove(
      buildState({ hands: [['m01a'], ['m05a']], table: ['m01b', 'm01c', 'm01d'], deck: ['m10c', 'm09c'], captured: [[], ['m02c']] }),
      0,
      { type: 'play', card: 'm01a' },
    )
    expect(types(s)).toEqual([])
    expect(s.players[0].captured).toHaveLength(4)
    expect(s.players[1].captured).toEqual(['m02c'])
  })

  it('삼연뻑 wins when enabled', () => {
    const st = buildState({
      cfg: { samyeonppeok: 'win' },
      hands: [['m01a', 'm02a', 'm03a'], ['m10a', 'm10b', 'm10c']],
      table: ['m01b', 'm02b', 'm03b'],
      deck: ['m03c', 'm09c', 'm02c', 'm08c', 'm01c'],
      captured: [[], []],
    })
    let s = applyMove(st, 0, { type: 'play', card: 'm01a' })
    s = applyMove(s, 1, { type: 'play', card: 'm10a' })
    s = applyMove(s, 0, { type: 'play', card: 'm02a' })
    s = applyMove(s, 1, { type: 'play', card: 'm10b' })
    expect(s.players[0].ppeokStreak).toBe(2)
    s = applyMove(s, 0, { type: 'play', card: 'm03a' })
    expect(types(s)).toEqual(['ppeok', 'samyeonppeok'])
    expect(s.result).toMatchObject({ winner: 0, reason: 'samyeonppeok', perLoser: [{ seat: 1, points: 3 }] })
  })
})

describe('따닥 / 쪽 / 싹쓸이', () => {
  it('따닥: the flip completes the month after a two-way match, steal 1', () => {
    const s = applyMove(
      buildState({ hands: [['m02a', 'm09c'], ['m05a']], table: ['m02c', 'm02d', 'm10c'], deck: ['m08c', 'm02b'], captured: [[], ['m03c', 'm11b']] }),
      0,
      { type: 'play', card: 'm02a', target: 'm02d' },
    )
    expect(types(s)).toEqual(['ttadak', 'steal'])
    expect(s.players[0].captured).toEqual(expect.arrayContaining(['m02a', 'm02b', 'm02c', 'm02d', 'm03c']))
    expect(s.players[1].captured).toEqual(['m11b'])
    expect(s.table).toEqual(['m10c'])
  })

  it('a two-way match requires a valid target', () => {
    const st = buildState({ hands: [['m02a'], ['m05a']], table: ['m02c', 'm02d'], deck: ['m08c', 'm09c'] })
    expect(() => applyMove(st, 0, { type: 'play', card: 'm02a' })).toThrow('target required')
    expect(() => applyMove(st, 0, { type: 'play', card: 'm02a', target: 'm05c' })).toThrow('target does not match')
    expect(legalMoves(st, 0).filter((m) => m.type === 'play')).toEqual([
      { type: 'play', card: 'm02a', target: 'm02c' },
      { type: 'play', card: 'm02a', target: 'm02d' },
    ])
  })

  it('쪽: the laid card is matched by the flip, steal 1', () => {
    const s = applyMove(
      buildState({ hands: [['m03a', 'm09c'], ['m05a']], table: ['m10c'], deck: ['m08c', 'm03b'], captured: [[], ['m11b', 'm04c']] }),
      0,
      { type: 'play', card: 'm03a' },
    )
    expect(types(s)).toEqual(['jjok', 'steal'])
    expect(s.players[0].captured).toEqual(['m03a', 'm03b', 'm04c']) // plain 피 before 쌍피
    expect(s.table).toEqual(['m10c'])
    expect(s.scratch).toMatchObject({ playedCard: 'm03a', playedLaid: false, flipped: 'm03b' })
  })

  it('싹쓸이: clearing the table steals 1 from everyone', () => {
    const s = applyMove(
      buildState({ players: 3, hands: [['m04a'], ['m08c'], ['m09c']], table: ['m04c', 'm05c'], deck: ['m10c', 'm05a'], captured: [[], ['m01c'], ['m02c']] }),
      0,
      { type: 'play', card: 'm04a' },
    )
    expect(types(s)).toEqual(['sseul', 'steal', 'steal'])
    expect(s.table).toEqual([])
    expect(s.players[0].captured).toEqual(['m04a', 'm04c', 'm05a', 'm05c', 'm01c', 'm02c'])
  })

  it('steals take a plain 피 first, then 쌍피, never 국진, never a debt', () => {
    const victim = ['m09a', 'm11b', 'm01c']
    const mk = () =>
      buildState({
        hands: [['m03a'], ['m05a']],
        table: ['m10c'],
        deck: ['m08c', 'm03b'],
        captured: [[], victim],
        patch: (st) => {
          st.players[1].kukjinAsJunk = true
        },
      })
    let s = applyMove(mk(), 0, { type: 'play', card: 'm03a' })
    expect(s.players[1].captured).toEqual(['m09a', 'm11b'])
    const st2 = mk()
    st2.players[1].captured = ['m09a', 'm11b']
    s = applyMove(st2, 0, { type: 'play', card: 'm03a' })
    expect(s.players[1].captured).toEqual(['m09a'])
    const st3 = mk()
    st3.players[1].captured = ['m09a']
    s = applyMove(st3, 0, { type: 'play', card: 'm03a' })
    expect(s.players[1].captured).toEqual(['m09a'])
    expect(types(s)).toEqual(['jjok']) // no steal event when nothing was taken
  })

  it('stealFromAll=false takes only from the richest 피 pile', () => {
    const s = applyMove(
      buildState({ players: 3, cfg: { stealFromAll: false }, hands: [['m03a'], ['m05a'], ['m06a']], table: ['m10c'], deck: ['m08c', 'm03b'], captured: [[], ['m01c'], ['m02c', 'm02d']] }),
      0,
      { type: 'play', card: 'm03a' },
    )
    expect(s.players[1].captured).toEqual(['m01c'])
    expect(s.players[2].captured).toEqual(['m02d'])
  })
})

describe('폭탄 / 흔들기', () => {
  const bombState = () =>
    buildState({
      hands: [['m01a', 'm01b', 'm01c', 'm08c'], ['m05a', 'm06a', 'm07a']],
      table: ['m01d', 'm09c'],
      deck: ['m12d', 'm10d', 'm10c', 'm11c', 'm02c'],
      captured: [[], ['m03c', 'm04c']],
    })

  it('폭탄 takes all four, doubles, grants two passes and steals 1', () => {
    const st = bombState()
    expect(legalMoves(st, 0)).toContainEqual({ type: 'play', card: 'm01a', bomb: true })
    expect(legalMoves(st, 0)).not.toContainEqual({ type: 'play', card: 'm01a', shake: true })
    let s = applyMove(st, 0, { type: 'play', card: 'm01b', bomb: true })
    expect(types(s)).toEqual(['bomb', 'steal'])
    expect(s.players[0]).toMatchObject({ hand: ['m08c'], bombs: 1, bombPasses: 2 })
    expect(s.players[0].captured).toEqual(['m01a', 'm01b', 'm01c', 'm01d', 'm03c'])
    expect(s.scratch.flipped).toBe('m02c')
    expect(s.table).toEqual(['m09c', 'm02c'])
    expect(s.turn).toBe(1)

    s = applyMove(s, 1, { type: 'play', card: 'm05a' })
    expect(legalMoves(s, 0)).toContainEqual({ type: 'pass' })
    s = applyMove(s, 0, { type: 'pass' })
    expect(s.players[0].bombPasses).toBe(1)
    expect(s.players[0].hand).toEqual(['m08c'])
    expect(s.scratch).toMatchObject({ playedCard: null, flipped: 'm10c' })
    expect(s.turn).toBe(1)
  })

  it('a bomb needs three in hand and exactly one on the table', () => {
    const st = bombState()
    st.players[0].hand = ['m01a', 'm01b', 'm08c']
    expect(() => applyMove(st, 0, { type: 'play', card: 'm01a', bomb: true })).toThrow('bomb needs three')
    expect(() => applyMove(bombState(), 0, { type: 'play', card: 'm01a', bomb: true, shake: true })).toThrow('bomb already doubles')
    const st2 = bombState()
    st2.table = ['m09c']
    expect(() => applyMove(st2, 0, { type: 'play', card: 'm01a', bomb: true })).toThrow('exactly one')
  })

  it('pass is illegal without a credit', () => {
    expect(() => applyMove(bombState(), 0, { type: 'pass' })).toThrow('no bomb credit')
  })

  it('흔들기 doubles once per month and needs the month off the table', () => {
    const st = buildState({ cfg: { chongtongPoints: 0 }, hands: [['m06a', 'm06b', 'm06c', 'm06d', 'm08c'], ['m05a']], table: ['m09c'], deck: ['m12d', 'm10d', 'm11c'] })
    expect(legalMoves(st, 0)).toContainEqual({ type: 'play', card: 'm06a', shake: true })
    let s = applyMove(st, 0, { type: 'play', card: 'm06a', shake: true })
    expect(types(s)).toEqual(['shake'])
    expect(s.players[0]).toMatchObject({ shakes: 1, shookMonths: [6] })
    expect(s.table).toContain('m06a')
    s = applyMove(s, 1, { type: 'play', card: 'm05a' })
    expect(() => applyMove(s, 0, { type: 'play', card: 'm06b', shake: true })).toThrow('cannot shake a month that is on the table')
    expect(legalMoves(s, 0).some((m) => m.type === 'play' && m.shake)).toBe(false)

    const again = buildState({ hands: [['m06a', 'm06b', 'm06c'], ['m05a']], table: [], deck: ['m10c'], patch: (x) => { x.players[0].shookMonths = [6] } })
    expect(() => applyMove(again, 0, { type: 'play', card: 'm06a', shake: true })).toThrow('already shaken')
    const two = buildState({ hands: [['m06a', 'm06b'], ['m05a']], table: [], deck: ['m10c'] })
    expect(() => applyMove(two, 0, { type: 'play', card: 'm06a', shake: true })).toThrow('shake needs three')
  })
})

describe('decisions', () => {
  it('chooseFlipMatch pauses on a two-way flip and resumes on choose', () => {
    const st = buildState({ hands: [['m10a', 'm08c'], ['m05a']], table: ['m07c', 'm07d', 'm10c'], deck: ['m12d', 'm07a'] })
    let s = applyMove(st, 0, { type: 'play', card: 'm10a' })
    expect(s.phase).toBe('chooseFlipMatch')
    expect(s.turn).toBe(0)
    expect(s.scratch.flipMatches).toEqual(['m07c', 'm07d'])
    expect(s.table).toEqual(['m07c', 'm07d', 'm07a'])
    expect(legalMoves(s, 0).filter((m) => m.type !== 'concede')).toEqual([{ type: 'choose', card: 'm07c' }, { type: 'choose', card: 'm07d' }])
    expect(() => applyMove(s, 0, { type: 'choose', card: 'm07a' })).toThrow('not a matching card')
    expect(() => applyMove(s, 0, { type: 'play', card: 'm08c' })).toThrow('not in play phase')
    s = applyMove(s, 0, { type: 'choose', card: 'm07d' })
    expect(s.players[0].captured).toEqual(['m10a', 'm10c', 'm07a', 'm07d'])
    expect(s.table).toEqual(['m07c'])
    expect(s.phase).toBe('play')
    expect(s.turn).toBe(1)
  })

  it('국진: choice pauses; fixed rules decide silently', () => {
    const mk = (kukjin: 'choice' | 'animal' | 'junk') =>
      buildState({ cfg: { kukjin }, hands: [['m09a', 'm08c'], ['m05a']], table: ['m09c'], deck: ['m12d', 'm11c'] })
    let s = applyMove(mk('choice'), 0, { type: 'play', card: 'm09a' })
    expect(s.phase).toBe('kukjin')
    expect(legalMoves(s, 0).filter((m) => m.type !== 'concede')).toEqual([{ type: 'kukjin', asJunk: true }, { type: 'kukjin', asJunk: false }])
    expect(() => applyMove(s, 0, { type: 'go' })).toThrow('not offered go')
    s = applyMove(s, 0, { type: 'kukjin', asJunk: true })
    expect(s.players[0].kukjinAsJunk).toBe(true)
    expect(s.turn).toBe(1)
    expect(applyMove(mk('junk'), 0, { type: 'play', card: 'm09a' })).toMatchObject({ phase: 'play', turn: 1, players: [{ kukjinAsJunk: true }, {}] })
    expect(applyMove(mk('animal'), 0, { type: 'play', card: 'm09a' })).toMatchObject({ phase: 'play', turn: 1, players: [{ kukjinAsJunk: false }, {}] })
    expect(() => applyMove(mk('junk'), 0, { type: 'kukjin', asJunk: true })).toThrow('no kukjin decision pending')
  })

  it('offers go/stop at minStopScore; go raises the bar', () => {
    // 9 junk captured, m01c + m01d gives 11 → 2 points... use a 3-광 finish instead
    const st = buildState({
      hands: [['m08a', 'm06c', 'm07c'], ['m05a', 'm05b', 'm05c']],
      table: ['m08c', 'm10c'],
      deck: ['m12d', 'm11c', 'm10d', 'm09c', 'm02c', 'm11d'],
      captured: [['m01a', 'm03a'], ['m12a']],
    })
    let s = applyMove(st, 0, { type: 'play', card: 'm08a' })
    expect(s.phase).toBe('goStop')
    expect(legalMoves(s, 0).filter((m) => m.type !== 'concede')).toEqual([{ type: 'stop' }, { type: 'go' }])
    expect(() => applyMove(s, 0, { type: 'play', card: 'm06c' })).toThrow('not in play phase')
    s = applyMove(s, 0, { type: 'go' })
    expect(types(s)).toEqual(['go'])
    expect(s.players[0]).toMatchObject({ goCount: 1, scoreAtLastGo: 3 })
    expect(s.turn).toBe(1)
    s = applyMove(s, 1, { type: 'play', card: 'm05a' })
    s = applyMove(s, 0, { type: 'play', card: 'm06c' }) // score unchanged: no new offer
    expect(s.phase).toBe('play')
    expect(s.turn).toBe(1)
  })

  it('stop settles with the go adjustment', () => {
    const st = buildState({
      hands: [['m08a', 'm06c'], ['m05a', 'm05b']],
      table: ['m08c', 'm10c'],
      deck: ['m12d', 'm11c', 'm09c'],
      captured: [['m01a', 'm03a'], ['m12a']],
      patch: (x) => {
        x.players[0].goCount = 1
        x.players[0].scoreAtLastGo = 1
      },
    })
    let s = applyMove(st, 0, { type: 'play', card: 'm08a' })
    s = applyMove(s, 0, { type: 'stop' })
    expect(types(s)).toEqual(['stop'])
    expect(s.result).toMatchObject({ winner: 0, score: 3, goAdj: 4, reason: 'stop', payoutPoints: [4, -4] })
    expect(() => applyMove(s, 0, { type: 'stop' })).toThrow('game is over')
    expect(legalMoves(s, 0)).toEqual([])
  })

  it('go is illegal with no cards left; the last-card score auto-stops', () => {
    const forced = buildState({ hands: [[], ['m05a']], deck: ['m09c'], patch: (x) => { x.phase = 'goStop' } })
    expect(() => applyMove(forced, 0, { type: 'go' })).toThrow('no cards left to go')
    expect(legalMoves(forced, 0).filter((m) => m.type !== 'concede')).toEqual([{ type: 'stop' }])

    const last = buildState({ hands: [['m08a'], ['m05a']], table: ['m08c'], deck: ['m09c'], captured: [['m01a', 'm03a'], ['m12a']] })
    const s = applyMove(last, 0, { type: 'play', card: 'm08a' })
    expect(types(s)).toEqual(['stop'])
    expect(s.result).toMatchObject({ winner: 0, reason: 'stop', score: 3 })
  })
})

describe('endings', () => {
  it('나가리 when nobody can stop: carry doubles, all payouts zero', () => {
    const st = buildState({ hands: [['m08c'], ['m05a']], table: ['m10c'], deck: ['m09c', 'm11c'], patch: (x) => { x.carryMultiplier = 2 } })
    let s = applyMove(st, 0, { type: 'play', card: 'm08c' })
    s = applyMove(s, 1, { type: 'play', card: 'm05a' })
    expect(types(s)).toEqual(['nagari'])
    expect(s.result).toEqual(expect.objectContaining({ winner: null, reason: 'nagari', nextCarry: 4, payoutPoints: [0, 0], perLoser: [] }))
  })

  it('skips seats with no turns left', () => {
    const st = buildState({ hands: [['m08c', 'm06c'], []], table: ['m10c'], deck: ['m09c', 'm11c'], patch: (x) => { x.players[1].bombPasses = 0 } })
    const s = applyMove(st, 0, { type: 'play', card: 'm08c' })
    expect(s.turn).toBe(0)
  })

  it('concede 2P: the other seat wins minStopScore × carry', () => {
    const st = buildState({ hands: [['m08c'], ['m05a']], deck: ['m09c', 'm11c'], patch: (x) => { x.carryMultiplier = 2 } })
    const s = applyMove(st, 1, { type: 'concede' }) // out of turn is fine
    expect(types(s)).toEqual(['concede'])
    expect(s.result).toMatchObject({ winner: 0, reason: 'concede', perLoser: [{ seat: 1, points: 6, tags: ['concede'] }], payoutPoints: [6, -6], nextCarry: 1 })
  })

  it('concede 3P: the conceder pays two shares', () => {
    const st = buildState({ players: 3, hands: [['m08c'], ['m05a'], ['m06a']], deck: ['m09c', 'm11c', 'm12d'] })
    const s = applyMove(st, 1, { type: 'concede' })
    expect(s.result).toMatchObject({ winner: null, reason: 'concede', perLoser: [{ seat: 1, points: 6, tags: ['concede'] }], payoutPoints: [3, -6, 3] })
    expect(() => applyMove(s, 0, { type: 'concede' })).toThrow('game is over')
  })

  it('총통: four of a month dealt wins chongtongPoints', () => {
    let found: GameState | null = null
    for (let seed = 1; seed < 5000 && !found; seed++) {
      const s = createGame(makeConfig(2, seed))
      if (s.result) found = s
    }
    expect(found).not.toBeNull()
    const s = found!
    expect(s.result).toMatchObject({ reason: 'chongtong', score: 10 })
    expect(s.result!.perLoser[0].points).toBe(10)
    expect(hasFourOfMonth(s.players[s.result!.winner!].hand)).not.toBeNull()
    expect(s.events[0]).toMatchObject({ type: 'chongtong', seat: s.result!.winner })
    // switched off, the same seed plays on
    expect(createGame(makeConfig(2, s.cfg.seed, 0, { chongtongPoints: 0 })).result).toBeNull()
  })

  it('redeals when the table shows four of a month', () => {
    let seed = 1
    let naive: string[] | null = null
    while (!naive) {
      const deck = seededShuffle(ALL_IDS, mulberry32(seed))
      deck.splice(deck.length - 20, 20)
      const table = deck.splice(deck.length - 8, 8)
      if (hasFourOfMonth(table) !== null) naive = table
      else seed++
    }
    const s = createGame(makeConfig(2, seed))
    expect(hasFourOfMonth(s.table)).toBeNull()
    expect(s.table).not.toEqual(naive)
    expect(new Set([...s.deck, ...s.table, ...s.players.flatMap((p) => p.hand)]).size).toBe(48)
    expect(s.deck).toHaveLength(20)
  })
})

describe('illegal moves', () => {
  it('rejects wrong seats, cards and phases with lowercase messages', () => {
    const st = buildState({ hands: [['m08c'], ['m05a']], deck: ['m09c', 'm11c'] })
    const bad: [number, Move, string][] = [
      [1, { type: 'play', card: 'm05a' }, 'not your turn'],
      [0, { type: 'play', card: 'm05a' }, 'card not in hand'],
      [0, { type: 'play', card: 'zz' }, 'card not in hand'],
      [0, { type: 'choose', card: 'm09c' }, 'no choice pending'],
      [0, { type: 'go' }, 'not offered go'],
      [0, { type: 'stop' }, 'not offered stop'],
      [0, { type: 'play', card: 'm08c', target: 'm09c' }, 'no target to choose'],
      [5, { type: 'play', card: 'm08c' }, 'no such seat'],
    ]
    for (const [seat, move, msg] of bad) {
      expect(() => applyMove(st, seat, move)).toThrow(msg)
      expect(msg).toBe(msg.toLowerCase())
    }
  })
})
