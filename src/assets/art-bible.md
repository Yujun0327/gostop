# 고스탑 — art bible: "화투방"

## Mood
A friend's living room on a winter night: a green army blanket (담요) spread on the floor,
a lacquered tray for the piles, tungsten light, the slap of plastic cards. Loud, warm,
a little rowdy. NOT: casino neon, purple gradients, glassmorphism, emoji, Inter/Roboto.

## Surfaces
| token | hex | use |
|---|---|---|
| --felt | #1f5c3a | the blanket: page background |
| --felt-deep | #153f28 | table wells, empty slots |
| --lacquer | #14100e | trays, top bar, modal scrims, card bodies |
| --ivory | #f3ead6 | card fields, panels, sheets |
| --ivory-deep | #e6d9bb | pressed panels, insets |
| --ink | #1a1512 | text on ivory |
| --ink-soft | rgb(26 21 18 / 0.62) | secondary text |
| --vermilion | #c8102e | THE accent: 고!, stamps, ribbons, danger |
| --gold | #d9a441 | 광 foil, score highlights |
| --gold-hi | #f1d27a | foil highlight |
| --indigo | #1d2a6d | 청단, cool secondary |

## The cards
Rendered by `@yujun/hwatu` (`cardSvg`). Chrome lives in `HwatuCard.svelte`: 5:8 portrait,
container-query sizing, hard drop shadow (0 2px 0 rgb(0 0 0 / 0.45) + 0 6px 14px), a plastic
specular already inside the SVG. States: in hand (raised on hover/selected: translateY(-8px)),
playable (gold hairline pulse), on table (flat), captured (fanned, overlap 62%), face-down
(the red back). Never color-only: playable cards also get a small ▲ tick.

## Type
- Display: Black Han Sans — titles, 고/스톱, stamps (뻑! 따닥! 쪽! 싹쓸이!). Min 22px.
- Body: Nanum Myeongjo — prose, rules, breakdown lines.
- UI: Noto Sans KR 500 — buttons, labels, numbers (tabular).

## Shape & depth
One radius 6px (cards 10px). One shadow. Hairline insets on ivory panels. Paper grain at 6%.

## Motion
- Card play: 180ms slide + 60ms slap (scale 1.04 → 1), sound: slap.
- Capture sweep: matched cards fly to the pile (260ms, settle easing), stagger 40ms.
- Stamp (뻑/따닥/쪽/싹쓸이/흔들기/폭탄): vermilion brush-stroke text pops from 0.3 → 1.05 → 1
  with a 0.45s quake; tier by importance (쪽/뻑 tier 1, 따닥/싹쓸이/흔들기 tier 2, 폭탄 tier 3).
- 고!: the sheet slams, multiplier badge counts 1고 → 2고 → 3고 with flames from 3고.
- 스톱: breakdown rolls up line by line (120ms each), then the cash counts up.
- All durations through `dur()`; reduced motion → banner only.

## Sound (synthesized)
slap, sweep (whoosh + card flutter), clink (피 steal), stamp hit (low thud + high snap),
go drum (rising toms), stop gong, nagari deflate, win fanfare / lose descend.

## Anti-slop checklist
- [ ] no purple, no glass blur, no emoji, no Inter
- [ ] vermilion focus ring
- [ ] designed empty states (empty pile = dashed lacquer well with a label)
- [ ] grain present on ivory
- [ ] every stamp has a sound and a reduced-motion fallback
