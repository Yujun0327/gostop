<script lang="ts">
  import { ALL_IDS, CARDS, MONTHS } from '@yujun/hwatu'
  import HwatuCard from './HwatuCard.svelte'
  const sizes = ['44px', '72px', '120px']
</script>

<main class="gallery">
  <h1>화투 48장</h1>
  {#each MONTHS as m (m.month)}
    <section>
      <h2>{m.month}월 {m.nameKo}</h2>
      <div class="row">
        {#each ALL_IDS.filter((id) => CARDS[id].month === m.month) as id (id)}
          <div class="cell">
            <HwatuCard {id} width="96px" />
            <span class="label">{CARDS[id].nameKo}</span>
          </div>
        {/each}
      </div>
    </section>
  {/each}
  <section>
    <h2>크기 · 뒷면</h2>
    <div class="row">
      {#each sizes as w (w)}
        <HwatuCard id="m01a" width={w} />
        <HwatuCard id="xx" width={w} />
      {/each}
      <HwatuCard id="m03a" width="72px" selected />
      <HwatuCard id="m08a" width="72px" playable />
      <HwatuCard id="m11a" width="72px" dim />
    </div>
  </section>
</main>

<style>
  .gallery { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-5); }
  .row { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: flex-end; }
  .cell { display: flex; flex-direction: column; align-items: center; gap: var(--sp-1); }
  h2 { font-size: var(--fs-md); margin-bottom: var(--sp-2); }
</style>
