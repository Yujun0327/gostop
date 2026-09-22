/** Shared motion vocabulary. JS transitions honor reduced-motion via zeroed durations. */

export function motionOk(): boolean {
  return typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Duration that collapses to 0 under prefers-reduced-motion. */
export function dur(ms: number): number {
  return motionOk() ? ms : 0
}

/** The house easing: quick start, gentle settle. */
export const settle = (t: number) => 1 - Math.pow(1 - t, 3)
