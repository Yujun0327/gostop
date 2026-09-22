<script lang="ts">
  import { backSvg, cardSvg, CARDS, HIDDEN_CARD } from '@yujun/hwatu'

  interface Props {
    id: string
    /** CSS width; the card keeps a 5:8 ratio. */
    width?: string
    selected?: boolean
    playable?: boolean
    dim?: boolean
    flat?: boolean
    onclick?: () => void
    label?: string
  }

  let { id, width = '64px', selected = false, playable = false, dim = false, flat = false, onclick, label }: Props = $props()

  const hidden = $derived(id === HIDDEN_CARD || !CARDS[id])
  const svg = $derived(hidden ? backSvg() : cardSvg(id))
  const name = $derived(label ?? (hidden ? '뒷면' : `${CARDS[id].monthKo} ${CARDS[id].nameKo}`))
</script>

{#if onclick}
  <button
    type="button"
    class="card"
    class:selected
    class:playable
    class:dim
    class:flat
    style="width: {width}"
    aria-label={name}
    aria-pressed={selected}
    {onclick}
  >
    {@html svg}
    {#if playable}<span class="tick" aria-hidden="true">▲</span>{/if}
  </button>
{:else}
  <div class="card" class:dim class:flat style="width: {width}" role="img" aria-label={name}>
    {@html svg}
  </div>
{/if}

<style>
  .card {
    position: relative;
    display: block;
    aspect-ratio: 5 / 8;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: var(--r-card);
    box-shadow: var(--shadow);
    transition: transform 160ms cubic-bezier(0.2, 0.7, 0.3, 1.1), box-shadow 160ms ease, opacity 160ms ease;
    flex: none;
    color: inherit;
  }
  .card :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: var(--r-card);
  }
  .card.flat { box-shadow: 0 1px 0 rgb(0 0 0 / 0.35), 0 2px 5px rgb(0 0 0 / 0.25); }
  button.card { cursor: pointer; }
  button.card:hover:not(:disabled) { transform: translateY(-6px); }
  .card.selected { transform: translateY(-10px) scale(1.04); box-shadow: 0 0 0 3px var(--gold-hi), var(--shadow); }
  .card.playable { box-shadow: 0 0 0 2px var(--gold), var(--shadow); animation: breathe 1.6s ease-in-out infinite; }
  .card.dim { opacity: 0.55; filter: saturate(0.6); }
  .tick {
    position: absolute;
    left: 50%;
    bottom: -14px;
    translate: -50% 0;
    color: var(--gold-hi);
    font-size: 10px;
    line-height: 1;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.6);
  }
  @keyframes breathe {
    0%, 100% { box-shadow: 0 0 0 2px var(--gold), var(--shadow); }
    50% { box-shadow: 0 0 0 3px var(--gold-hi), 0 0 18px rgb(241 210 122 / 0.5), var(--shadow); }
  }
</style>
