/** @type {import('tailwindcss').Config} */
// 색·글꼴은 블록 패키지 프리셋 하나에서 — 플레이그라운드와 같다.
// 탐색기 화면 값(사이드바 바탕·선·호버·떠 있는 그림자)은 src/index.css 변수
module.exports = {
  presets: [require('@dumpster/blocks/tailwind.preset')],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // 블록 스타일은 블록 패키지의 styles.json에 클래스 글자로 있다 (json 빠지면 본문 스타일이 안 생김)
    '../../packages/blocks/src/**/*.{ts,tsx,json}',
  ],
  theme: {
    extend: {
      colors: {
        side: 'var(--side)',
        'side-hover': 'var(--side-hover)',
        hover: 'var(--hover)',
        line: 'var(--line)',
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
      },
    },
  },
  // 칸 폭에 따라 본문 여백·이전/다음 카드 배치를 바꾼다 (@container / @[560px]:)
  plugins: [require('@tailwindcss/container-queries')],
}
