<script lang="ts">
  import type { Snippet } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { dur, settle } from './motion'

  interface Props {
    onClose?: () => void
    children: Snippet
  }

  let { onClose, children }: Props = $props()

  function backdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose?.()
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose?.()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  class="backdrop"
  onclick={backdrop}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  transition:fade={{ duration: dur(160) }}
>
  <div class="sheet" transition:fly={{ y: 26, duration: dur(260), easing: settle }}>
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(59 47 30 / 0.45);
    display: grid;
    place-items: center;
    z-index: 40;
    padding: var(--sp-4);
  }

  .sheet {
    background: var(--panel);
    color: var(--ink);
    border-radius: var(--radius);
    box-shadow: var(--hairline), 0 8px 28px rgb(59 47 30 / 0.35);
    padding: var(--sp-5);
    max-width: min(92vw, 460px);
    max-height: 88dvh;
    overflow-y: auto;
    position: relative;
  }

  .sheet::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-image: var(--grain);
    opacity: 0.06;
    pointer-events: none;
  }

  .sheet > :global(*) {
    position: relative;
  }

  @media (max-width: 640px) {
    .backdrop {
      place-items: end center;
      padding: 0;
    }

    .sheet {
      width: 100%;
      max-width: none;
      border-radius: var(--radius) var(--radius) 0 0;
      padding-bottom: max(var(--sp-5), env(safe-area-inset-bottom));
    }
  }
</style>
