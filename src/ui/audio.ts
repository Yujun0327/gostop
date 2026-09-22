/**
 * Synthesized foley for the 화투방: card slaps, pile sweeps, coin clinks,
 * stamp hits, the go drum and the stop gong. Zero audio binaries.
 */
import type { SfxEvent } from '../app/session.svelte'

let ctx: AudioContext | null = null
let muted = localStorage.getItem('gostop:muted') === '1'

function ac(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlock(): void {
  try {
    ac()
  } catch {
    /* no audio */
  }
}

export function setMuted(m: boolean): void {
  muted = m
  localStorage.setItem('gostop:muted', m ? '1' : '0')
}

export function isMuted(): boolean {
  return muted
}

function tone(freq: number, { t = 0, dur = 0.12, type = 'triangle' as OscillatorType, vol = 0.18, glide = 0 } = {}): void {
  const a = ac()
  const osc = a.createOscillator()
  const gain = a.createGain()
  const start = a.currentTime + t
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(a.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function noise({ t = 0, vol = 0.4, cutoff = 1200, dur = 0.05, type = 'lowpass' as BiquadFilterType } = {}): void {
  const a = ac()
  const buffer = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = type
  filter.frequency.value = cutoff
  const gain = a.createGain()
  gain.gain.value = vol
  src.connect(filter).connect(gain).connect(a.destination)
  src.start(a.currentTime + t)
}

/** A plastic card hitting the blanket. */
export function slap(): void {
  if (muted) return
  try {
    noise({ vol: 0.5, cutoff: 900, dur: 0.05 })
    noise({ t: 0.005, vol: 0.2, cutoff: 5200, dur: 0.02, type: 'highpass' })
  } catch {}
}

/** Cards sweeping into a pile. */
export function sweep(n = 2): void {
  if (muted) return
  try {
    noise({ vol: 0.22, cutoff: 1400, dur: 0.16, type: 'bandpass' })
    for (let i = 0; i < Math.min(n, 4); i++) noise({ t: 0.05 + i * 0.05, vol: 0.14, cutoff: 3200, dur: 0.03, type: 'highpass' })
  } catch {}
}

/** A 피 changing hands. */
export function clink(): void {
  if (muted) return
  try {
    tone(2600, { dur: 0.06, vol: 0.09, type: 'sine' })
    tone(3900, { t: 0.03, dur: 0.1, vol: 0.07, type: 'sine' })
  } catch {}
}

/** Stamp hit for 뻑/따닥/쪽/싹쓸이/흔들기/폭탄; tier scales the weight. */
export function stamp(tier: 1 | 2 | 3): void {
  if (muted) return
  try {
    noise({ vol: 0.5, cutoff: 300 + tier * 120, dur: 0.12 })
    noise({ t: 0.01, vol: 0.25, cutoff: 6000, dur: 0.03, type: 'highpass' })
    tone(90 - tier * 10, { dur: 0.35, vol: 0.22, type: 'sine', glide: -30 })
    if (tier >= 2) tone(520, { t: 0.08, dur: 0.25, vol: 0.12 })
    if (tier === 3) {
      tone(220, { t: 0.1, dur: 0.5, vol: 0.18, type: 'sawtooth', glide: 500 })
      for (const i of [0, 1, 2]) noise({ t: 0.3 + i * 0.22, vol: 0.2, cutoff: 6500, dur: 0.25, type: 'highpass' })
    }
  } catch {}
}

/** 고! — rising toms, more of them the higher the count. */
export function goDrum(count: number): void {
  if (muted) return
  try {
    const hits = Math.min(2 + count, 6)
    for (let i = 0; i < hits; i++) {
      tone(120 + i * 30, { t: i * 0.11, dur: 0.22, vol: 0.2, type: 'sine', glide: -40 })
      noise({ t: i * 0.11, vol: 0.18, cutoff: 800, dur: 0.05 })
    }
    if (count >= 3) tone(880, { t: hits * 0.11, dur: 0.5, vol: 0.14 })
  } catch {}
}

/** 스톱 — a gong. */
export function gong(): void {
  if (muted) return
  try {
    tone(196, { dur: 1.4, vol: 0.22, type: 'sine' })
    tone(392, { t: 0.02, dur: 1.0, vol: 0.12, type: 'triangle' })
    tone(587, { t: 0.04, dur: 0.7, vol: 0.08, type: 'sine' })
    noise({ vol: 0.3, cutoff: 500, dur: 0.1 })
  } catch {}
}

export function celebrate(tier: 1 | 2 | 3): void {
  if (muted) return
  try {
    if (tier === 1) {
      tone(659, { dur: 0.22, vol: 0.15 })
      tone(880, { t: 0.1, dur: 0.32, vol: 0.15 })
    } else if (tier === 2) {
      for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, { t: i * 0.09, dur: 0.24, vol: 0.16 })
      noise({ t: 0.3, vol: 0.2, cutoff: 7000, dur: 0.28, type: 'highpass' })
    } else {
      tone(220, { dur: 0.5, vol: 0.18, type: 'sawtooth', glide: 660 })
      tone(65, { t: 0.32, dur: 0.7, vol: 0.26, type: 'sine' })
      for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) {
        tone(f, { t: 0.35 + i * 0.11, dur: 0.38, vol: 0.18 })
        tone(f / 2, { t: 0.35 + i * 0.11, dur: 0.38, vol: 0.11 })
      }
      for (const i of [0, 1, 2]) noise({ t: 0.45 + i * 0.28, vol: 0.22, cutoff: 6500, dur: 0.3, type: 'highpass' })
      tone(2093, { t: 1.15, dur: 0.9, vol: 0.12, type: 'sine' })
    }
  } catch {}
}

export function play(sfx: SfxEvent | 'select' | 'error'): void {
  if (muted) return
  try {
    switch (sfx) {
      case 'select':
        noise({ vol: 0.12, cutoff: 5200, dur: 0.03, type: 'highpass' })
        return
      case 'error':
        tone(180, { dur: 0.18, vol: 0.12, type: 'sawtooth', glide: -60 })
        return
      case 'slap':
        slap()
        return
      case 'sweep':
        sweep()
        return
      case 'clink':
        clink()
        return
      case 'stamp1':
        stamp(1)
        return
      case 'stamp2':
        stamp(2)
        return
      case 'stamp3':
        stamp(3)
        return
      case 'go':
        goDrum(1)
        return
      case 'stop':
        gong()
        return
      case 'nagari':
        tone(330, { dur: 0.5, vol: 0.14, type: 'sawtooth', glide: -200 })
        return
      case 'win':
        celebrate(2)
        return
      case 'lose':
        for (const [i, f] of [392, 330, 262].entries()) tone(f, { t: i * 0.16, dur: 0.3, vol: 0.14, type: 'sawtooth' })
        return
    }
  } catch {}
}
