<script lang="ts">
  import WalletBadge from './WalletBadge.svelte'
  import RulesLeaflet from './RulesLeaflet.svelte'
  import { loadPlayerName, savePlayerName } from '../app/persist'

  interface Props {
    onHotseat: (playerCount: 2 | 3, names: string[]) => void
    onCreateRoom: () => void
    onJoinRoom: (code: string) => void
  }

  let { onHotseat, onCreateRoom, onJoinRoom }: Props = $props()

  let playerCount = $state<2 | 3>(2)
  let names = $state(['', '', ''])
  let code = $state('')
  let rulesOpen = $state(false)
  let myName = $state(loadPlayerName())

  function rename(e: Event) {
    myName = (e.target as HTMLInputElement).value
    savePlayerName(myName)
  }
</script>

<main class="home">
  <header class="marquee">
    <p class="label kicker">담요 깔고 한 판</p>
    <h1><span class="foil-text">고스탑</span></h1>
    <p class="tag">맞고 · 고스탑 — 뻑, 따닥, 쪽, 싹쓸이, 흔들기, 폭탄 다 됩니다</p>
  </header>
  <WalletBadge />

  <section class="panel block online">
    <h2>온라인</h2>
    <label class="field">
      <span class="label">내 이름</span>
      <input type="text" maxlength="14" value={myName} placeholder="이름" onchange={rename} />
    </label>
    <div class="row">
      <button class="btn btn--gold" onclick={onCreateRoom}>방 만들기</button>
      <form class="join" onsubmit={(e) => { e.preventDefault(); if (code.trim()) onJoinRoom(code.trim()) }}>
        <input type="text" maxlength="8" bind:value={code} placeholder="방 코드" aria-label="방 코드" />
        <button class="btn" type="submit" disabled={!code.trim()}>들어가기</button>
      </form>
    </div>
    <p class="hint">2명은 맞고, 3명은 고스탑. 점당은 방장이 정하고, 판돈은 지갑에서 겁니다.</p>
  </section>

  <section class="panel block">
    <h2>한 기기로</h2>
    <div class="row">
      <div class="seg" role="group" aria-label="인원">
        <button class="btn" class:btn--gold={playerCount === 2} onclick={() => (playerCount = 2)}>2명 맞고</button>
        <button class="btn" class:btn--gold={playerCount === 3} onclick={() => (playerCount = 3)}>3명 고스탑</button>
      </div>
    </div>
    <div class="names">
      {#each { length: playerCount } as _, i (i)}
        <input type="text" maxlength="12" bind:value={names[i]} placeholder={`${i + 1}번 이름`} aria-label={`${i + 1}번 이름`} />
      {/each}
    </div>
    <div class="row">
      <button class="btn btn--gold" onclick={() => onHotseat(playerCount, names.slice(0, playerCount))}>패 돌리기</button>
      <button class="btn btn--quiet dark" onclick={() => (rulesOpen = true)}>규칙</button>
    </div>
    <p class="hint">기기를 돌려 가며 칩니다. 돈은 걸리지 않습니다.</p>
  </section>

  <footer>
    <p>친구들끼리 노는 팬 게임 · 원작 화투 문화에 대한 오마주</p>
    <p class="stamp-line">build {__BUILD_STAMP__}</p>
  </footer>
</main>

{#if rulesOpen}
  <RulesLeaflet onClose={() => (rulesOpen = false)} />
{/if}

<style>
  .home { max-width: 44rem; margin: 0 auto; padding: 6vh var(--sp-4) var(--sp-7); display: flex; flex-direction: column; gap: var(--sp-5); }
  .marquee { text-align: center; }
  .kicker { color: var(--gold-hi); }
  h1 { font-size: clamp(3.4rem, 14vw, 6rem); line-height: 1; }
  .tag { margin: var(--sp-2) 0 0; color: var(--on-felt-soft); font-family: var(--font-body); }
  .block { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
  .block h2 { font-size: var(--fs-lg); color: var(--ink); }
  .field { display: flex; flex-direction: column; gap: var(--sp-1); }
  .row { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; }
  .join { display: flex; gap: var(--sp-2); flex: 1; min-width: 12rem; }
  .join input { flex: 1; min-width: 0; text-transform: uppercase; letter-spacing: 0.12em; }
  .seg { display: flex; gap: var(--sp-2); }
  .names { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: var(--sp-2); }
  .hint { margin: 0; color: var(--ink-soft); font-family: var(--font-body); font-size: var(--fs-sm); }
  .dark { color: var(--ink); border-color: var(--line); }
  footer { text-align: center; color: var(--on-felt-soft); font-size: var(--fs-xs); }
  footer p { margin: var(--sp-1) 0; }
</style>
