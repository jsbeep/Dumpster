/** @type {import('tailwindcss').Config} */
// 색·글꼴은 블록 패키지 프리셋 하나에서 — 플레이그라운드와 같다
module.exports = {
  presets: [require('@dumpster/blocks/tailwind.preset')],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // 블록 스타일은 블록 패키지의 styles.json에 클래스 글자로 있다 (json 빠지면 본문 스타일이 안 생김)
    '../../packages/blocks/src/**/*.{ts,tsx,json}',
  ],
}
