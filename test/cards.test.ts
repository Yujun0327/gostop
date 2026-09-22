import { describe, expect, it } from 'vitest'
import {
  ALL_IDS, BI_GWANG, BLUE_RIBBONS, CARDS, GODORI, GRASS_RIBBONS, HIDDEN_CARD, KUKJIN, RED_RIBBONS, card, junkValue, kind, month,
} from '../src/engine'

describe('cards', () => {
  it('has 48 unique ids in month/slot order', () => {
    expect(ALL_IDS).toHaveLength(48)
    expect(new Set(ALL_IDS).size).toBe(48)
    expect(ALL_IDS[0]).toBe('m01a')
    expect(ALL_IDS[47]).toBe('m12d')
    expect(ALL_IDS).not.toContain(HIDDEN_CARD)
    for (const id of ALL_IDS) expect(CARDS[id].id).toBe(id)
  })

  it('counts 5 광 / 9 열끗 / 10 띠 / 24 피', () => {
    const count = (k: string) => ALL_IDS.filter((id) => kind(id) === k).length
    expect(count('gwang')).toBe(5)
    expect(count('animal')).toBe(9)
    expect(count('ribbon')).toBe(10)
    expect(count('junk')).toBe(24)
  })

  it('has junk value 26 (two 쌍피)', () => {
    expect(ALL_IDS.reduce((v, id) => v + junkValue(id), 0)).toBe(26)
    expect(ALL_IDS.filter((id) => CARDS[id].double)).toEqual(['m11b', 'm12d'])
    expect(junkValue('m11b')).toBe(2)
    expect(junkValue('m01c')).toBe(1)
    expect(junkValue('m01a')).toBe(0)
  })

  it('puts four cards in every month', () => {
    for (let m = 1; m <= 12; m++) expect(ALL_IDS.filter((id) => month(id) === m)).toHaveLength(4)
  })

  it('defines the sets', () => {
    expect(RED_RIBBONS).toEqual(['m01b', 'm02b', 'm03b'])
    expect(BLUE_RIBBONS).toEqual(['m06b', 'm09b', 'm10b'])
    expect(GRASS_RIBBONS).toEqual(['m04b', 'm05b', 'm07b'])
    expect(GODORI).toEqual(['m02a', 'm04a', 'm08b'])
    for (const id of [...RED_RIBBONS, ...BLUE_RIBBONS, ...GRASS_RIBBONS]) expect(kind(id)).toBe('ribbon')
    expect(card('m12c').ribbon).toBe('rain')
    for (const id of GODORI) expect(kind(id)).toBe('animal')
    expect(kind(KUKJIN)).toBe('animal')
    expect(card(BI_GWANG).bi).toBe(true)
    expect(ALL_IDS.filter((id) => kind(id) === 'gwang')).toEqual(['m01a', 'm03a', 'm08a', 'm11a', 'm12a'])
  })

  it('rejects unknown ids', () => {
    expect(() => card('zz')).toThrow('unknown card')
  })
})
