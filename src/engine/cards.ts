/**
 * The 48-card hwatu deck. Ids are `m<month>` + slot: slot `a` is the month's
 * headline card (광 / 열끗 / 쌍피), `b` the ribbon or second special, `c`/`d`
 * the junk. `@yujun/hwatu` ships the same ids with the art; this table is
 * deliberately self-contained so the engine has no dependency.
 */
export type CardId = string

export type Kind = 'gwang' | 'animal' | 'ribbon' | 'junk'
export type Ribbon = 'red' | 'blue' | 'grass' | 'rain'

export interface Card {
  id: CardId
  month: number
  slot: 'a' | 'b' | 'c' | 'd'
  kind: Kind
  /** Ribbon color: 홍단 / 청단 / 초단, or the plain 비띠. */
  ribbon?: Ribbon
  /** 쌍피 counts 2 junk. */
  double?: boolean
  /** 12월 광 scores 2 in a three-bright set (비삼광). */
  bi?: boolean
  /** Korean display name. */
  name: string
}

/** Sentinel for cards stripped by `redact` — never a real id. */
export const HIDDEN_CARD: CardId = 'xx'

type Spec = [kind: Kind, name: string, extra?: Partial<Card>]

const JUNK: Spec = ['junk', '피']
const DOUBLE: Spec = ['junk', '쌍피', { double: true }]
const RED: Spec = ['ribbon', '홍단', { ribbon: 'red' }]
const BLUE: Spec = ['ribbon', '청단', { ribbon: 'blue' }]
const GRASS: Spec = ['ribbon', '초단', { ribbon: 'grass' }]

const MONTHS: Spec[][] = [
  [['gwang', '송학'], RED, JUNK, JUNK], // 1
  [['animal', '매조'], RED, JUNK, JUNK], // 2
  [['gwang', '벚꽃'], RED, JUNK, JUNK], // 3
  [['animal', '흑싸리'], GRASS, JUNK, JUNK], // 4
  [['animal', '난초'], GRASS, JUNK, JUNK], // 5
  [['animal', '모란'], BLUE, JUNK, JUNK], // 6
  [['animal', '홍싸리'], GRASS, JUNK, JUNK], // 7
  [['gwang', '공산'], ['animal', '기러기'], JUNK, JUNK], // 8
  [['animal', '국진'], BLUE, JUNK, JUNK], // 9
  [['animal', '단풍'], BLUE, JUNK, JUNK], // 10
  [['gwang', '오동'], DOUBLE, JUNK, JUNK], // 11
  [['gwang', '비광', { bi: true }], ['animal', '비'], ['ribbon', '비띠', { ribbon: 'rain' }], DOUBLE], // 12
]

const SLOTS = ['a', 'b', 'c', 'd'] as const

/** Every card keyed by id. */
export const CARDS: Readonly<Record<CardId, Card>> = (() => {
  const out: Record<CardId, Card> = {}
  MONTHS.forEach((specs, mi) => {
    const month = mi + 1
    specs.forEach(([kind, name, extra], si) => {
      const id = `m${String(month).padStart(2, '0')}${SLOTS[si]}`
      out[id] = { id, month, slot: SLOTS[si], kind, name, ...extra }
    })
  })
  return out
})()

/** All 48 ids in month/slot order. */
export const ALL_IDS: readonly CardId[] = Object.keys(CARDS)

export function card(id: CardId): Card {
  const c = CARDS[id]
  if (!c) throw new Error(`unknown card ${id}`)
  return c
}

export function month(id: CardId): number {
  return card(id).month
}

export function kind(id: CardId): Kind {
  return card(id).kind
}

/** Junk value of a single card for the 피 count: 0 for non-junk, 2 for 쌍피. */
export function junkValue(id: CardId): number {
  const c = card(id)
  return c.kind === 'junk' ? (c.double ? 2 : 1) : 0
}

export const RED_RIBBONS: readonly CardId[] = ['m01b', 'm02b', 'm03b']
export const BLUE_RIBBONS: readonly CardId[] = ['m06b', 'm09b', 'm10b']
export const GRASS_RIBBONS: readonly CardId[] = ['m04b', 'm05b', 'm07b']
export const GODORI: readonly CardId[] = ['m02a', 'm04a', 'm08b']
export const KUKJIN: CardId = 'm09a'
export const BI_GWANG: CardId = 'm12a'
