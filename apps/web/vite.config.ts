import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// 탐색기 — 빌더 결과물(out/graph.json + out/assets)을 정적 폴더로 그대로 내놓는다.
// dev는 /graph.json, build는 dist/ 안에 복사돼서 페이지 옆에 같이 간다.
// base './': gh-pages처럼 /저장소이름/ 아래에 올려도 graph.json·assets·JS를 상대경로로 찾게 (라우팅은 해시라 상관없음)
// 포트는 package.json 스크립트(--port 5320 --strictPort)에서
export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: fileURLToPath(new URL('../../out', import.meta.url)),
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
