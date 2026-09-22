<script lang="ts">
  interface Props {
    name: string
    onOpen: () => void
  }

  const { name, onOpen }: Props = $props()
</script>

<div class="shield" role="dialog" aria-label="화면을 넘겨주세요">
  <div class="cover panel">
    <span class="label">패 가리기</span>
    <h2>{name} 차례</h2>
    <p class="hint">다른 사람은 잠시 눈을 돌려 주세요. 본인이면 아래를 눌러 패를 펼칩니다.</p>
    <button class="btn btn--gold" onclick={onOpen}>{name} — 내 패 보기</button>
  </div>
</div>

<style>
  .shield {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    /* fully opaque: the incoming player's hand must not read through */
    background: var(--felt-deep);
    padding: var(--sp-5);
  }
  .cover {
    padding: var(--sp-6);
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    align-items: center;
    text-align: center;
    width: min(94vw, 420px);
  }
  h2 { font-size: var(--fs-xl); color: var(--ink); }
  .hint { margin: 0; color: var(--ink-soft); font-family: var(--font-body); }
</style>
