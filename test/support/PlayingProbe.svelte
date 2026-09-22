<script lang="ts">
  import type { OnlineSession } from '../../src/app/session.svelte'

  let { session }: { session: OnlineSession } = $props()
</script>

<!-- Mirrors App.svelte's routing condition so template reactivity is under test. -->
{#if session.playing}
  <span data-probe="game">GAME</span>
{:else}
  <span data-probe="lobby">LOBBY</span>
{/if}
