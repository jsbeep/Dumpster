/** @type {import('tailwindcss').Config} */
// 색·글꼴은 블록 패키지 프리셋 하나에서 — 탐색기(apps/web)도 같은 프리셋을 쓴다
module.exports = {
  presets: [require('@dumpster/blocks/tailwind.preset')],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // 블록 스타일은 블록 패키지의 styles.json에 클래스 글자로 있다 (View 코드에도 조금)
    '../../packages/blocks/src/**/*.{ts,tsx,json}',
    // 스타일 탭에서 아직 저장 안 한 초안의 클래스 (dev 서버가 씀, gitignore)
    './.draft/classes.txt',
  ],
}
