<script lang="ts">
  import { DAILY_CASH } from '@yujun/game-net/wallet'
  import { PORTAL_URL, wallet } from '../app/wallet.svelte'

  $effect(() => {
    void wallet.init()
  })
</script>

{#if wallet.configured}
  <div class="wallet-badge" aria-label="your wallet">
    <span class="wb-stat"><span class="wb-label">cash</span> {(wallet.profile?.balance ?? 0).toLocaleString()}</span>
    <span class="wb-stat"><span class="wb-label">trophies</span> {wallet.profile?.trophies ?? 0}</span>
    <button class="wb-btn" disabled={!wallet.canClaim} onclick={() => wallet.claim()}>
      {wallet.canClaim ? `Collect ${DAILY_CASH.toLocaleString()}` : 'Collected today'}
    </button>
    <a class="wb-link" href={PORTAL_URL} target="_blank" rel="noopener">ranking ↗</a>
    {#if wallet.notice}<span class="wb-notice">{wallet.notice}</span>{/if}
  </div>
{/if}

<style>
  .wallet-badge {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.6rem 1rem;
    margin: 0.6rem auto 1rem;
    padding: 0.45rem 0.9rem;
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 999px;
    width: fit-content;
    max-width: 100%;
    font-size: 0.85rem;
  }
  .wb-label { opacity: 0.6; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; margin-right: 0.25rem; }
  .wb-btn {
    font: inherit; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.25rem 0.7rem; border-radius: 999px; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer;
  }
  .wb-btn:disabled { opacity: 0.45; cursor: default; }
  .wb-link { color: inherit; opacity: 0.8; font-size: 0.8rem; }
  .wb-notice { font-style: italic; opacity: 0.8; }
</style>
