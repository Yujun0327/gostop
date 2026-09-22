<script lang="ts">
  import type { LockState, Payout } from '@yujun/game-net/wallet'

  let { payout = null, lock = null }: { payout?: Payout | null; lock?: LockState | null } = $props()

  const text = $derived.by(() => {
    if (!payout || payout.status === 'none') return null
    switch (payout.status) {
      case 'signing':
      case 'pending':
        return `Settling with the table… ${payout.attested.length}/${payout.seatCount} confirmed`
      case 'settled':
        if (payout.cash === 0 && payout.trophies === 0) return 'Settled — nothing changes for you this time.'
        return `+${payout.cash.toLocaleString()} cash · +${payout.trophies} trophies`
      case 'void':
        return lock?.error ? `Bet voided — ${lock.error}. Stakes refunded.` : 'Bet voided — stakes refunded.'
      case 'rejected':
        return `Not settled: ${payout.error ?? 'the ledger refused it'}`
    }
  })
</script>

{#if text}
  <p class="payout" class:pending={payout?.status === 'signing' || payout?.status === 'pending'}>{text}</p>
{/if}

<style>
  .payout { margin: 0.4rem 0 0.8rem; font-size: 0.9rem; opacity: 0.9; }
  .payout.pending { font-style: italic; opacity: 0.7; }
</style>
