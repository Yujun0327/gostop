<script lang="ts">
  import Modal from './Modal.svelte'
  let { onClose }: { onClose: () => void } = $props()
</script>

<Modal {onClose}>
  <article class="rules">
    <h2>규칙 요약</h2>
    <h3>기본</h3>
    <p>손에서 한 장 내고 더미에서 한 장 뒤집습니다. 같은 달을 짝지으면 가져옵니다. 2명은 10장·바닥 8장, 3명은 7장·바닥 6장.</p>
    <h3>점수</h3>
    <ul>
      <li>광: 3광 3점(비광 포함 2점), 4광 4점, 5광 15점</li>
      <li>열끗: 5장부터 1점, 한 장마다 +1 · 고도리 5점</li>
      <li>띠: 5장부터 1점 · 홍단·청단·초단 각 3점</li>
      <li>피: 10장부터 1점, 한 장마다 +1 · 쌍피는 2장</li>
    </ul>
    <h3>고·스톱</h3>
    <p>3점이 되면 고 또는 스톱. 고를 부르면 점수가 올라야 다시 멈출 수 있습니다. 1고 +1, 2고 +2, 3고부터 두 배씩.</p>
    <h3>박</h3>
    <p>피박(피 7장 미만), 광박(광 0장), 고박(고 부르고 남이 스톱). 3명일 때 고박은 독박 — 고 부른 사람이 다 냅니다.</p>
    <h3>특수</h3>
    <ul>
      <li>뻑: 짝을 맞췄는데 뒤집은 패가 같은 달 — 셋 다 바닥에 남습니다</li>
      <li>따닥: 짝 맞추고 뒤집은 패까지 같은 달 — 넉 장 다 가져오고 피 한 장 뺏기</li>
      <li>쪽: 그냥 낸 패에 뒤집은 패가 붙음 — 피 한 장 뺏기</li>
      <li>싹쓸이: 바닥을 비우면 피 한 장씩 뺏기</li>
      <li>흔들기: 같은 달 3장 선언 — 두 배 · 폭탄: 3장을 한꺼번에 — 두 배, 두 번 쉬기</li>
      <li>나가리: 아무도 못 나면 다음 판 두 배</li>
    </ul>
    <h3>돈</h3>
    <p>점당 × 점수 × 배수를 진 사람이 냅니다. 한 판 한도는 50점. 판돈은 시작할 때 지갑에서 걸립니다.</p>
    <p class="en">Go-Stop, the Korean flower-card game. Match months, score sets, call go for more or stop to cash out.</p>
    <button class="btn" onclick={onClose}>닫기</button>
  </article>
</Modal>

<style>
  .rules { color: var(--ink); font-family: var(--font-body); display: flex; flex-direction: column; gap: var(--sp-2); }
  h2 { font-size: var(--fs-xl); }
  h3 { font-size: var(--fs-md); margin-top: var(--sp-2); }
  p, ul { margin: 0; }
  ul { padding-left: 1.2em; }
  .en { color: var(--ink-soft); font-size: var(--fs-xs); font-family: var(--font-ui); }
  .btn { align-self: flex-start; margin-top: var(--sp-2); }
</style>
