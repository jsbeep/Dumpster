/** @type {import('tailwindcss').Config} */
// 색·글꼴은 블록 패키지 프리셋 하나에서 — 탐색기(apps/web)도 같은 프리셋을 쓴다
module.exports = {
  presets: [require('@dumpster/blocks/tailwind.preset')],
  // 블록 View의 클래스가 블록 패키지 소스에 있으므로 같이 훑는다
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/blocks/src/**/*.{ts,tsx}'],
}
