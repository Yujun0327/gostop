<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { OnlineSession, cashPayouts } from '../app/session.svelte'
  import type { BaseSession } from '../app/session.svelte'
  import { dur, settle } from './motion'
  import PayoutLine from './PayoutLine.svelte'

  interface Props {
    session: BaseSession
    onRematch: () => void
    onExit: () => void
  }

  let { session, onRematch, onExit }: Props = $props()

  const online = $derived(session instanceof OnlineSession ? session : null)
  const gs = $derived(session.state)
  const r = $derived(gs.result!)
  const names = $derived(gs.cfg.names)
  const me = $derived(session.mySeat)
  const cash = $derived(cashPayouts(gs, gs.cfg))

  const TAGS: Record<string, string> = {
    pibak: '피박',
    gwangbak: '광박',
    mongbak: '멍박',
    gobak: '고박',
    dokbak: '독박',
    'dokbak-exempt': '독박 면제',
    concede: '항복',
    shake: '흔들기',
    bomb: '폭탄',
    carry: '나가리 배',
  }
  const tagText = (t: string) => TAGS[t] ?? t

  const title = $derived.by(() => {
    if (r.reason === 'nagari') return '나가리'
    if (r.reason === 'chongtong') return '총통!'
    if (r.reason === 'samyeonppeok') return '삼연뻑!'
    if (r.winner === null) return '항복'
    return me === null ? `${names[r.winner]} 승` : r.winner === me ? '이겼다!' : `${names[r.winner]} 승`
  })

  const lines = $derived.by(() => {
    const b = r.breakdown
    if (!b) return []
    const out: { label: string; pts: number }[] = []
    if (b.gwangPoints) out.push({ label: `광 ${b.gwangCount}장${b.biGwang ? ' (비광)' : ''}`, pts: b.gwangPoints })
    if (b.animalPoints) out.push({ label: `열끗 ${b.animalCount}장${b.godori ? ' · 고도리' : ''}`, pts: b.animalPoints })
    if (b.ribbonPoints) out.push({ label: `띠 ${b.ribbonCount}장${b.hongdan ? ' · 홍단' : ''}${b.cheongdan ? ' · 청단' : ''}${b.chodan ? ' · 초단' : ''}`, pts: b.ribbonPoints })
    if (b.junkPoints) out.push({ label: `피 ${b.junkValue}`, pts: b.junkPoints })
    return out
  })
</script>

<div class="overlay" transition:fade={{ duration: dur(200) }}>
  <div class="card panel" transition:fly={{ y: 40, duration: dur(320), easing: settle }}>
    <p class="label">{r.reason === 'stop' ? '스톱' : r.reason === 'nagari' ? '아무도 못 났습니다' : r.reason}</p>
    <h2 class:win={r.winner !== null && r.winner === me}>{title}</h2>

    {#if r.winner !== null && r.breakdown}
      <ol class="lines">
        {#each lines as l, i (l.label)}
          <li style="--d:{i}"><span>{l.label}</span><span class="tabular">{l.pts}점</span></li>
        {/each}
        {#if r.goAdj !== r.score}
          <li style="--d:{lines.length}"><span>{gs.players[r.winner].goCount}고</span><span class="tabular">→ {r.goAdj}점</span></li>
        {/if}
        {#if r.multiplier > 1}
          <li style="--d:{lines.length + 1}"><span>흔들기·폭탄·나가리</span><span class="tabular">×{r.multiplier}</span></li>
        {/if}
      </ol>
    {/if}

    <ul class="losers">
      {#each r.perLoser as l, i (l.seat)}
        <li style="--d:{lines.length + 2 + i}">
          <span class="who">{names[l.seat]}</span>
          <span class="tags">{l.tags.map(tagText).join(' · ')}</span>
          <span class="pts tabular">{l.points}점</span>
          {#if gs.cfg.pointValue > 0}<span class="cash tabular">{cash[l.seat].toLocaleString()}</span>{/if}
        </li>
      {/each}
      {#if r.winner !== null && gs.cfg.pointValue > 0}
        <li class="winner-line" style="--d:{lines.length + 2 + r.perLoser.length}">
          <span class="who">{names[r.winner]}</span>
          <span class="tags">받음</span>
          <span class="pts tabular">{r.payoutPoints[r.winner]}점</span>
          <span class="cash tabular plus">+{cash[r.winner].toLocaleString()}</span>
        </li>
      {/if}
    </ul>
    {#if r.reason === 'nagari'}
      <p class="hint">다음 판은 ×{r.nextCarry}.</p>
    {/if}

    <PayoutLine payout={online?.payout ?? null} lock={online?.lockState ?? null} />

    <div class="actions">
      <button class="btn btn--gold" onclick={onRematch}>{r.reason === 'nagari' ? '다시 (×' + r.nextCarry + ')' : '한 판 더'}</button>
      <button class="btn" onclick={onExit}>일어나기</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); padding: var(--sp-4); }
  .card { width: min(94vw, 460px); padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); max-height: 92dvh; overflow: auto; }
  h2 { font-size: var(--fs-2xl); color: var(--ink); }
  h2.win { color: var(--vermilion); }
  .lines, .losers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .lines li, .losers li { display: flex; justify-content: space-between; gap: var(--sp-2); font-family: var(--font-body); animation: rise 300ms ease-out both; animation-delay: calc(var(--d) * 120ms); }
  .losers li { border-top: 1px solid var(--line); padding-top: 4px; }
  .who { font-weight: 700; }
  .tags { color: var(--ink-soft); flex: 1; font-size: var(--fs-xs); }
  .pts { min-width: 3.5em; text-align: right; }
  .cash { min-width: 5em; text-align: right; color: var(--vermilion); }
  .cash.plus { color: #1f6f43; }
  .winner-line .who { color: var(--vermilion); }
  .hint { margin: 0; color: var(--ink-soft); font-family: var(--font-body); }
  .actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-2); }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
</style>
