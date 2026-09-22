<script lang="ts">
  import { MONEY_RULES } from '@yujun/game-net/wallet'
  import type { OnlineSession } from '../app/session.svelte'
  import { savePlayerName } from '../app/persist'

  interface Props {
    session: OnlineSession
    onExit: () => void
  }

  let { session, onExit }: Props = $props()

  const POINT_VALUES = MONEY_RULES.gostop?.table?.pointValues ?? []
  const CAP = MONEY_RULES.gostop?.table?.capPoints ?? 50

  let copied = $state(false)
  let relays = $state(0)
  let waitedLong = $state(false)

  $effect(() => {
    const poll = setInterval(() => (relays = session.relayCount()), 1500)
    const slow = setTimeout(() => (waitedLong = true), 12000)
    return () => {
      clearInterval(poll)
      clearTimeout(slow)
    }
  })

  const mySeatEntry = $derived(session.seats.find((s) => s.playerKey === session.myKey))
  const filled = $derived(session.seats.filter((s) => s.playerKey !== null))
  const buyIn = $derived(session.hostPointValue * CAP)

  async function copyInvite() {
    const url = `${location.origin}${location.pathname}#room=${session.room}`
    try {
      await navigator.clipboard.writeText(url)
      copied = true
      setTimeout(() => (copied = false), 1600)
    } catch {}
  }

  function rename(e: Event) {
    const name = (e.target as HTMLInputElement).value
    savePlayerName(name)
    session.rename(name)
  }
</script>

<main class="lobby">
  <section class="card panel">
    <h1>담요 폈습니다</h1>

    <div class="code-row">
      <span class="label">방 코드</span>
      <span class="code">{session.room}</span>
      <button class="btn btn--quiet dark" onclick={copyInvite}>{copied ? '복사됨' : '초대 링크 복사'}</button>
    </div>

    {#if session.status === 'room-full'}
      <p class="hint">이 판은 자리가 다 찼습니다. 다음 판을 기다려 주세요.</p>
    {:else}
      <ul class="seats">
        {#each { length: 3 } as _, i (i)}
          {@const seat = session.seats[i]}
          <li class="seat" class:open={!seat?.playerKey}>
            {#if seat?.playerKey}
              <span class="dot" class:on={seat.connected}></span>
              {#if seat.playerKey === session.myKey}
                <input class="name-input" type="text" maxlength="14" value={seat.name} onchange={rename} aria-label="내 이름" />
              {:else}
                <span class="name">{seat.name}</span>
              {/if}
              {#if seat.playerKey === session.hostKey}<span class="label">방장</span>{/if}
              {#if session.balances[seat.playerKey] !== undefined}
                <span class="label cash tabular" class:short={buyIn > 0 && session.balances[seat.playerKey] < buyIn}>
                  {session.balances[seat.playerKey].toLocaleString()}
                </span>
              {/if}
              <span class="ready" class:yes={seat.ready}>{seat.ready ? '준비됨' : '준비 전'}</span>
            {:else}
              <span class="dot"></span>
              <span class="name empty">{i === 2 ? '빈자리 (3명이면 고스탑)' : '빈자리'}</span>
            {/if}
          </li>
        {/each}
      </ul>

      {#if session.isHost}
        <div class="picks">
          <span class="label">점당</span>
          <div class="seg" role="group" aria-label="점당">
            <button class="btn" class:btn--gold={session.hostPointValue === 0} onclick={() => (session.hostPointValue = 0)}>그냥</button>
            {#each POINT_VALUES as v (v)}
              <button class="btn" class:btn--gold={session.hostPointValue === v} onclick={() => (session.hostPointValue = v)}>{v.toLocaleString()}</button>
            {/each}
          </div>
          <span class="label">스톱 점수</span>
          <div class="seg" role="group" aria-label="스톱 점수">
            <button class="btn" class:btn--gold={session.hostMinStop === 3} onclick={() => (session.hostMinStop = 3)}>3점</button>
            <button class="btn" class:btn--gold={session.hostMinStop === 7} onclick={() => (session.hostMinStop = 7)}>7점</button>
          </div>
        </div>
      {/if}
      <p class="hint">
        {#if session.hostPointValue > 0}
          점당 {session.hostPointValue.toLocaleString()} · 한 판 한도 {CAP}점 · 판돈 {buyIn.toLocaleString()}을 지갑에서 겁니다.
        {:else}
          돈 없이 그냥 칩니다.
        {/if}
      </p>

      <div class="actions">
        {#if mySeatEntry}
          <button class="btn" class:btn--gold={!mySeatEntry.ready} disabled={!mySeatEntry.ready && !session.canAfford} onclick={() => session.setReady(!mySeatEntry.ready)}>
            {mySeatEntry.ready ? '준비 취소' : '준비'}
          </button>
        {/if}
        {#if session.isHost}
          <button class="btn btn--gold" disabled={!session.canStart} onclick={() => session.startGame()}>패 돌리기</button>
        {/if}
        <button class="btn btn--quiet dark" onclick={onExit}>나가기</button>
      </div>

      <p class="hint">
        {#if session.status === 'connecting' && filled.length <= 1}
          <span class="dot" class:on={relays > 0}></span>
          {relays > 0 ? `브로커 ${relays}/${session.brokerCount()} 연결됨.` : '연결 중…'}
          {#if !session.isHost}방장을 기다립니다.{:else}초대 링크를 보내면 여기 나타납니다.{/if}
          {#if waitedLong && filled.length <= 1}
            <button class="btn btn--quiet dark" onclick={() => session.rescan()}>다시 연결</button>
          {/if}
        {:else if !session.canAfford}
          판돈 {buyIn.toLocaleString()}이 필요합니다. 포털에서 오늘의 돈을 받거나 방장에게 점당을 낮춰 달라고 하세요.
        {:else if session.isHost}
          두 명 이상 모두 준비되면 패를 돌릴 수 있습니다.
        {:else}
          모두 준비되면 방장이 패를 돌립니다.
        {/if}
      </p>
    {/if}
  </section>
</main>

<style>
  .lobby { min-height: 100dvh; display: grid; place-items: center; padding: var(--sp-5); }
  .card { padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-4); width: min(94vw, 460px); }
  h1 { font-size: var(--fs-xl); color: var(--ink); }
  .code-row { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
  .code { font-family: var(--font-display); font-size: var(--fs-xl); letter-spacing: 0.18em; color: var(--vermilion); }
  .seats { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .seat { display: flex; align-items: center; gap: var(--sp-3); background: var(--ivory-deep); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--sp-2) var(--sp-3); min-height: 48px; }
  .seat.open { opacity: 0.6; background: transparent; border-style: dashed; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--line); flex: none; }
  .dot.on { background: var(--vermilion); }
  .name { font-weight: 600; flex: 1; }
  .name.empty { font-weight: 400; color: var(--ink-soft); }
  .name-input { font: inherit; font-weight: 600; color: var(--ink); background: transparent; border: none; border-bottom: 1px solid var(--line); flex: 1; min-width: 0; padding: 2px 0; min-height: 0; border-radius: 0; }
  .cash { color: var(--ink-soft); }
  .cash.short { color: var(--vermilion); }
  .ready { font-size: var(--fs-xs); color: var(--ink-soft); }
  .ready.yes { color: var(--vermilion); }
  .picks { display: flex; flex-direction: column; gap: var(--sp-2); }
  .seg { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
  .seg .btn { padding: 8px 14px; min-height: 38px; }
  .actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
  .hint { margin: 0; font-size: var(--fs-sm); color: var(--ink-soft); display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; font-family: var(--font-body); }
  .dark { color: var(--ink); border-color: var(--line); }
</style>
