<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly, scale } from 'svelte/transition'
  import { breakdown, kind, month, tokens } from '../engine'
  import type { CardId, Move, Seat, TurnEvent } from '../engine'
  import { HotseatSession, OnlineSession, stampFor } from '../app/session.svelte'
  import type { BaseSession } from '../app/session.svelte'
  import { celebrate, isMuted, play, setMuted, stamp as stampSfx, unlock } from './audio'
  import { dur, settle } from './motion'
  import Celebration from './Celebration.svelte'
  import HwatuCard from './HwatuCard.svelte'
  import PeekShield from './PeekShield.svelte'
  import Pile from './Pile.svelte'
  import RulesLeaflet from './RulesLeaflet.svelte'
  import VictoryOverlay from './VictoryOverlay.svelte'

  interface Props {
    session: BaseSession
    onExit: () => void
    onRematch: () => void
  }

  let { session, onExit, onRematch }: Props = $props()

  const online = $derived(session instanceof OnlineSession ? session : null)
  const hotseat = $derived(session instanceof HotseatSession ? session : null)

  const gs = $derived(session.visibleState)
  const n = $derived(gs.cfg.playerCount)
  /** The seat drawn at the bottom: mine online, the actor in hotseat. */
  const me = $derived<Seat>(session.mySeat ?? session.actor)
  const others = $derived(Array.from({ length: n - 1 }, (_, i) => (me + 1 + i) % n))
  const myMoves = $derived(session.myMoves())
  const canAct = $derived(session.myTurn && !gs.result && !(hotseat?.handoffNeeded ?? false))

  let selected = $state<CardId | null>(null)
  let shakeOn = $state(false)
  let muted = $state(isMuted())
  let rulesOpen = $state(false)
  let confirmConcede = $state(false)
  let celebration = $state<{ tier: 1 | 2 | 3; title: string; kicker?: string } | null>(null)

  // foley from the session queue
  let seenEvent = -1
  $effect(() => {
    const last = session.events.at(-1)
    if (last && last.id > seenEvent) {
      seenEvent = last.id
      play(last.sfx)
    }
  })

  // stamps: the engine's public events, once each
  let stampedKey = ''
  $effect(() => {
    const evs = gs.events
    for (let i = 0; i < evs.length; i++) {
      const key = `${gs.turn}:${gs.deck.length}:${i}:${evs[i].type}`
      if (key <= stampedKey && stampedKey.startsWith(`${gs.turn}:${gs.deck.length}:`)) continue
      const s = stampFor(evs[i])
      if (s) {
        stampedKey = key
        celebration = s
        stampSfx(s.tier)
        if (s.tier === 3) celebrate(3)
      }
    }
  })

  // a new turn clears the selection
  $effect(() => {
    void gs.turn
    void gs.phase
    selected = null
    shakeOn = false
  })

  const playMoves = $derived(myMoves.filter((m): m is Extract<Move, { type: 'play' }> => m.type === 'play'))
  const playableCards = $derived(new Set(playMoves.map((m) => m.card)))
  const variants = $derived(selected ? playMoves.filter((m) => m.card === selected) : [])
  const targetCards = $derived(new Set(variants.filter((m) => m.target && !!m.shake === shakeOn).map((m) => m.target!)))
  const canShake = $derived(variants.some((m) => m.shake))
  const bombMove = $derived(variants.find((m) => m.bomb) ?? null)
  const passMove = $derived(myMoves.find((m) => m.type === 'pass') ?? null)
  const flipChoices = $derived(new Set(gs.phase === 'chooseFlipMatch' && canAct ? gs.scratch.flipMatches : []))
  const myScore = $derived(session.scores[me] ?? 0)
  const myBreak = $derived(breakdown(gs.players[me]))

  function pickHand(card: CardId) {
    unlock()
    if (!canAct || !playableCards.has(card)) return
    if (selected === card) {
      selected = null
      return
    }
    selected = card
    shakeOn = false
    play('select')
    const plain = playMoves.filter((m) => m.card === card && !m.shake && !m.bomb)
    // a single unambiguous play goes straight in
    if (plain.length === 1 && !plain[0].target && !playMoves.some((m) => m.card === card && (m.shake || m.bomb))) submit(plain[0])
  }

  function playSelected() {
    const m = variants.find((v) => !v.target && !!v.shake === shakeOn && !v.bomb)
    if (m) submit(m)
  }

  function pickTable(card: CardId) {
    if (!canAct) return
    if (flipChoices.has(card)) {
      submit({ type: 'choose', card })
      return
    }
    if (targetCards.has(card)) {
      const m = variants.find((v) => v.target === card && !!v.shake === shakeOn && !v.bomb)
      if (m) submit(m)
    }
  }

  function submit(move: Move) {
    try {
      session.submit(move)
    } catch {
      play('error')
    }
    selected = null
    shakeOn = false
  }

  function concede() {
    if (!confirmConcede) {
      confirmConcede = true
      setTimeout(() => (confirmConcede = false), 4000)
      return
    }
    confirmConcede = false
    submit({ type: 'concede' })
  }

  /** Table cards grouped by month, 뻑 stacks marked. */
  const tableGroups = $derived.by(() => {
    const groups = new Map<number, CardId[]>()
    for (const id of gs.table) {
      const m = month(id)
      groups.set(m, [...(groups.get(m) ?? []), id])
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([m, cards]) => ({ month: m, cards, ppeok: gs.ppeokMarks.find((p) => p.month === m) ?? null }))
  })

  const turnLine = $derived.by(() => {
    if (gs.result) return '판 끝'
    const who = gs.cfg.names[gs.turn]
    if (gs.phase === 'goStop') return session.mySeat === null || gs.turn === session.mySeat ? '고? 스톱?' : `${who} — 고냐 스톱이냐`
    if (gs.phase === 'chooseFlipMatch') return `${who} — 어느 패를 가져올까`
    if (gs.phase === 'kukjin') return `${who} — 국진을 어떻게 쓸까`
    if (session.myTurn) return '내 차례'
    return `${who} 차례`
  })

  function toggleMute() {
    muted = !muted
    setMuted(muted)
  }

  const goLabel = (seat: Seat) => (gs.players[seat].goCount > 0 ? `${gs.players[seat].goCount}고` : '')
  const eventText = (ev: TurnEvent) => stampFor(ev)?.title ?? ev.type
</script>

<div class="screen">
  <header class="topbar tray">
    <button class="btn btn--quiet exit" onclick={onExit}>나가기</button>
    <button class="btn btn--quiet exit" onclick={toggleMute} aria-label={muted ? '소리 켜기' : '소리 끄기'}>{muted ? '소리 꺼짐' : '소리'}</button>
    <button class="btn btn--quiet exit" onclick={() => (rulesOpen = true)}>규칙</button>
    <div class="turn">
      <span class="turnline">{turnLine}</span>
      {#if gs.carryMultiplier > 1}<span class="label carry">나가리 ×{gs.carryMultiplier}</span>{/if}
      {#if gs.cfg.pointValue > 0}<span class="label carry">점당 {gs.cfg.pointValue.toLocaleString()}</span>{/if}
    </div>
    {#if online && online.mySeat !== null && !gs.result}
      <button class="btn btn--quiet exit concede" class:arm={confirmConcede} onclick={concede}>{confirmConcede ? '정말 항복?' : '항복'}</button>
    {/if}
  </header>

  {#if online?.status === 'desync'}
    <div class="notice">판이 어긋났습니다 — 다시 맞추는 중…</div>
  {:else if online?.waitingOn}
    <div class="notice">{online.waitingOn} 님이 다시 들어오길 기다리는 중…</div>
  {/if}

  <section class="opponents">
    {#each others as seat (seat)}
      <div class="opp tray" class:active={gs.turn === seat && !gs.result}>
        <div class="opp-head">
          <span class="name">{gs.cfg.names[seat]}</span>
          <span class="score tabular"><strong>{session.scores[seat]}</strong>점</span>
          {#if goLabel(seat)}<span class="go-badge">{goLabel(seat)}</span>{/if}
          {#if gs.players[seat].shakes}<span class="label mini">흔들기 ×{gs.players[seat].shakes}</span>{/if}
          {#if gs.players[seat].bombs}<span class="label mini">폭탄 ×{gs.players[seat].bombs}</span>{/if}
          <span class="label mini">손 {gs.players[seat].hand.length}장{gs.players[seat].bombPasses ? ` · 쉬기 ${gs.players[seat].bombPasses}` : ''}</span>
        </div>
        <Pile cards={gs.players[seat].captured} kukjinAsJunk={gs.players[seat].kukjinAsJunk} compact />
      </div>
    {/each}
  </section>

  <main class="table">
    <div class="deck" aria-label="더미 {gs.deck.length}장">
      <HwatuCard id="xx" width="var(--cw)" flat />
      <span class="count tabular">{gs.deck.length}</span>
    </div>
    <div class="field">
      {#each tableGroups as g (g.month)}
        <div class="group" class:ppeok={!!g.ppeok} animate:flip={{ duration: dur(260) }}>
          {#each g.cards as id, i (id)}
            <div class="slot" style="--i:{i}" in:scale={{ duration: dur(220), start: 1.08, easing: settle }}>
              <HwatuCard
                {id}
                width="var(--cw)"
                flat
                playable={targetCards.has(id) || flipChoices.has(id)}
                dim={(selected !== null && targetCards.size > 0 && !targetCards.has(id)) || (flipChoices.size > 0 && !flipChoices.has(id))}
                onclick={targetCards.has(id) || flipChoices.has(id) ? () => pickTable(id) : undefined}
              />
              {#if gs.scratch.flipped === id}<span class="flipped-tag label">방금</span>{/if}
            </div>
          {/each}
          {#if g.ppeok}<span class="ppeok-tag">뻑 · {gs.cfg.names[g.ppeok.by]}</span>{/if}
        </div>
      {/each}
      {#if gs.table.length === 0}
        <p class="empty label">바닥이 비었습니다</p>
      {/if}
    </div>
    {#if gs.events.length}
      <div class="ticker" aria-live="polite">
        {#each gs.events as ev, i (i)}
          <span class="tick-item" class:steal={ev.type === 'steal'}>{gs.cfg.names[ev.seat]} · {ev.type === 'steal' ? `피 뺏기 ← ${gs.cfg.names[ev.from ?? 0]}` : eventText(ev)}</span>
        {/each}
      </div>
    {/if}
  </main>

  <section class="mine tray" class:active={gs.turn === me && !gs.result}>
    <div class="opp-head">
      <span class="name">{gs.cfg.names[me]}{session.mySeat === null ? '' : ' (나)'}</span>
      <span class="score tabular"><strong>{myScore}</strong>점</span>
      {#if goLabel(me)}<span class="go-badge">{goLabel(me)}</span>{/if}
      {#if gs.players[me].shakes}<span class="label mini">흔들기 ×{gs.players[me].shakes}</span>{/if}
      {#if gs.players[me].bombs}<span class="label mini">폭탄 ×{gs.players[me].bombs}</span>{/if}
      <span class="label mini breakdown">광 {myBreak.gwangCount} · 열끗 {myBreak.animalCount} · 띠 {myBreak.ribbonCount} · 피 {myBreak.junkValue}</span>
    </div>
    <Pile cards={gs.players[me].captured} kukjinAsJunk={gs.players[me].kukjinAsJunk} />
  </section>

  <section class="hand-area">
    {#if canAct && gs.phase === 'play'}
      <div class="hand-tools">
        {#if passMove}
          <button class="btn" onclick={() => submit(passMove)}>쉬기 (폭탄 {gs.players[me].bombPasses})</button>
        {/if}
        {#if selected && canShake}
          <button class="btn" class:btn--gold={shakeOn} onclick={() => (shakeOn = !shakeOn)}>흔들기 {shakeOn ? '켜짐' : ''}</button>
        {/if}
        {#if selected && bombMove}
          <button class="btn btn--gold" onclick={() => submit(bombMove)}>폭탄!</button>
        {/if}
        {#if selected && variants.some((v) => !v.target && !v.bomb && !!v.shake === shakeOn)}
          <button class="btn btn--gold" onclick={playSelected}>{shakeOn ? '흔들고 내기' : '내기'}</button>
        {/if}
        {#if selected && targetCards.size > 0}
          <span class="label hint">바닥에서 가져올 패를 고르세요</span>
        {/if}
      </div>
    {/if}
    <div class="hand" class:hidden={session.mySeat === null && (hotseat?.handoffNeeded ?? false)}>
      {#each gs.players[me].hand as id (id)}
        <div class="hand-slot" animate:flip={{ duration: dur(200) }} out:fly={{ y: -80, duration: dur(180) }}>
          <HwatuCard
            {id}
            width="var(--hw)"
            selected={selected === id}
            playable={canAct && gs.phase === 'play' && playableCards.has(id) && !selected}
            dim={canAct && gs.phase === 'play' && !playableCards.has(id)}
            onclick={canAct && gs.phase === 'play' ? () => pickHand(id) : undefined}
          />
        </div>
      {/each}
      {#if gs.players[me].hand.length === 0}
        <p class="empty label">손패 없음{tokens(gs.players[me]) ? ' · 쉬기 남음' : ''}</p>
      {/if}
    </div>
  </section>

  {#if canAct && gs.phase === 'goStop'}
    <div class="sheet panel" in:fly={{ y: 60, duration: dur(240), easing: settle }}>
      <p class="label">지금 {myScore}점{gs.players[me].goCount ? ` · ${gs.players[me].goCount}고째` : ''}</p>
      <div class="row">
        <button class="btn btn--gold big" onclick={() => submit({ type: 'go' })}>고!</button>
        <button class="btn big" onclick={() => submit({ type: 'stop' })}>스톱</button>
      </div>
      <p class="hint">고를 부르면 점수가 올라야 다시 멈출 수 있습니다. 남이 먼저 나면 고박입니다.</p>
    </div>
  {:else if canAct && gs.phase === 'kukjin'}
    <div class="sheet panel" in:fly={{ y: 60, duration: dur(240), easing: settle }}>
      <p class="label">국진을 어떻게 쓸까요?</p>
      <div class="row">
        <button class="btn btn--gold" onclick={() => submit({ type: 'kukjin', asJunk: false })}>열끗으로</button>
        <button class="btn" onclick={() => submit({ type: 'kukjin', asJunk: true })}>쌍피로</button>
      </div>
    </div>
  {/if}

  {#if hotseat?.handoffNeeded}
    <PeekShield name={gs.cfg.names[gs.turn]} onOpen={() => (hotseat.acknowledged = gs.turn)} />
  {/if}

  {#if celebration}
    <Celebration tier={celebration.tier} title={celebration.title} kicker={celebration.kicker} onDone={() => (celebration = null)} />
  {/if}

  {#if gs.result}
    <VictoryOverlay {session} {onRematch} {onExit} />
  {/if}

  {#if rulesOpen}
    <RulesLeaflet onClose={() => (rulesOpen = false)} />
  {/if}
</div>

<style>
  .screen {
    --cw: clamp(40px, 8.5vw, 64px);
    --hw: clamp(50px, 11vw, 82px);
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-2);
    padding-bottom: calc(var(--sp-4) + env(safe-area-inset-bottom));
  }
  .topbar { display: flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-2); flex-wrap: wrap; }
  .exit { padding: 6px 10px; min-height: 34px; font-size: var(--fs-xs); }
  .concede.arm { color: var(--vermilion-hi); border-color: var(--vermilion-hi); }
  .turn { flex: 1; display: flex; align-items: baseline; gap: var(--sp-2); justify-content: center; flex-wrap: wrap; }
  .turnline { font-family: var(--font-display); font-size: var(--fs-md); }
  .carry { color: var(--gold-hi); }
  .notice { text-align: center; font-size: var(--fs-xs); color: var(--gold-hi); }

  .opponents { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: var(--sp-2); }
  .opp, .mine { padding: var(--sp-2); display: flex; flex-direction: column; gap: var(--sp-1); border: 2px solid transparent; }
  .active { border-color: var(--gold); }
  .opp-head { display: flex; align-items: baseline; gap: var(--sp-2); flex-wrap: wrap; }
  .name { font-weight: 700; }
  .score strong { font-family: var(--font-display); font-size: var(--fs-md); color: var(--gold-hi); }
  .go-badge { font-family: var(--font-display); color: var(--ivory); background: var(--vermilion); border-radius: 999px; padding: 0 8px; font-size: var(--fs-xs); }
  .mini { font-size: 0.7rem; }
  .breakdown { margin-left: auto; }

  .table { flex: 1; display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-2); min-height: calc(var(--cw) * 1.6 * 2 + var(--sp-4)); position: relative; }
  .deck { position: relative; flex: none; }
  .count { position: absolute; inset: auto 0 -1.3em 0; text-align: center; font-size: var(--fs-xs); color: var(--on-felt-soft); }
  .field { flex: 1; display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-2); align-content: flex-start; min-height: calc(var(--cw) * 1.6 + 8px); }
  .group { position: relative; display: flex; padding-right: calc(var(--cw) * 0.3); }
  .slot { position: relative; margin-left: calc(var(--i) * var(--cw) * -0.55); z-index: var(--i); }
  .group.ppeok { outline: 2px dashed var(--vermilion-hi); outline-offset: 4px; border-radius: var(--r-card); }
  .ppeok-tag { position: absolute; top: -1.3em; left: 0; font-family: var(--font-display); color: var(--vermilion-hi); font-size: var(--fs-xs); white-space: nowrap; }
  .flipped-tag { position: absolute; bottom: -1.2em; left: 0; color: var(--gold-hi); font-size: 0.65rem; }
  .empty { margin: auto; color: var(--on-felt-soft); }
  .ticker { position: absolute; right: var(--sp-2); bottom: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; pointer-events: none; }
  .tick-item { font-size: 0.7rem; color: var(--on-felt-soft); background: rgb(0 0 0 / 0.35); padding: 1px 6px; border-radius: 999px; }
  .tick-item.steal { color: var(--gold-hi); }

  .hand-area { display: flex; flex-direction: column; gap: var(--sp-2); }
  .hand-tools { display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: center; min-height: 44px; }
  .hand { display: flex; flex-wrap: wrap; gap: var(--sp-1); justify-content: center; padding: var(--sp-2) 0 14px; }
  .hand.hidden { visibility: hidden; }
  .hand-slot { flex: none; }
  .hint { color: var(--gold-hi); }

  .sheet { position: fixed; left: 50%; bottom: max(var(--sp-4), env(safe-area-inset-bottom)); translate: -50% 0; width: min(94vw, 420px); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); z-index: 20; text-align: center; }
  .sheet .row { display: flex; gap: var(--sp-2); justify-content: center; }
  .big { font-family: var(--font-display); font-size: var(--fs-lg); padding: 12px 34px; }
  .sheet .hint { margin: 0; color: var(--ink-soft); font-size: var(--fs-xs); font-family: var(--font-body); }
</style>
