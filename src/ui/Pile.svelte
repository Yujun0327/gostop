<script lang="ts">
  import { KUKJIN, kind } from '../engine'
  import type { CardId } from '../engine'
  import HwatuCard from './HwatuCard.svelte'

  let { cards, kukjinAsJunk = false, compact = false }: { cards: CardId[]; kukjinAsJunk?: boolean; compact?: boolean } = $props()

  const groups = $derived.by(() => {
    const g: Record<'gwang' | 'animal' | 'ribbon' | 'junk', CardId[]> = { gwang: [], animal: [], ribbon: [], junk: [] }
    for (const id of cards) {
      if (id === KUKJIN && kukjinAsJunk) g.junk.push(id)
      else g[kind(id)].push(id)
    }
    return g
  })
  const labels = { gwang: '광', animal: '열끗', ribbon: '띠', junk: '피' } as const
  const KINDS = ['gwang', 'animal', 'ribbon', 'junk'] as const
</script>

<div class="pile" class:compact>
  {#each KINDS as k (k)}
    {@const list = groups[k]}
    <div class="group" class:empty={list.length === 0}>
      <span class="label k">{labels[k]} <span class="tabular n">{list.length}</span></span>
      {#if list.length}
        <div class="cards">
          {#each list as id, i (id)}
            <div class="c" style="--i:{i}"><HwatuCard {id} width="var(--pw)" flat /></div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
  {#if cards.length === 0}
    <span class="label none">아직 딴 패 없음</span>
  {/if}
</div>

<style>
  .pile { --pw: 34px; display: flex; flex-wrap: wrap; gap: var(--sp-1) var(--sp-3); align-items: flex-end; min-height: calc(var(--pw) * 1.6); }
  .pile.compact { --pw: 26px; }
  .group { display: flex; align-items: flex-end; gap: 6px; }
  .group.empty { opacity: 0.45; }
  .k { white-space: nowrap; }
  .n { color: var(--gold-hi); }
  .cards { display: flex; }
  .c { margin-left: calc(var(--i) * var(--pw) * -0.62); z-index: var(--i); }
  .c:first-child { margin-left: 0; }
  .none { margin-left: auto; opacity: 0.6; }
</style>
