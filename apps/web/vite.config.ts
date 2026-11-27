import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// 탐색기 — 빌더 결과물(out/graph.json + out/assets)을 정적 폴더로 그대로 내놓는다.
// dev는 /graph.json, build는 dist/ 안에 복사돼서 페이지 옆에 같이 간다.
// base './': gh-pages처럼 /저장소이름/ 아래에 올려도 graph.json·assets·JS를 상대경로로 찾게 (라우팅은 해시라 상관없음)
// 포트·host는 레포 루트 .env의 DUMPSTER_WEB_PORT·DUMPSTER_WEB_HOST (없으면 5320 · 127.0.0.1).
//   이미 셸에 있는 환경변수가 .env보다 먼저, CLI --port·--host는 그보다 먼저 (vite 규칙)
//   DUMPSTER_ 변수는 여기(설정)에서만 읽는다 — 화면 코드로는 안 나간다 (envPrefix는 기본 VITE_ 그대로)
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, 'DUMPSTER_WEB_')
  const host = env.DUMPSTER_WEB_HOST || '127.0.0.1'
  const port = Number(env.DUMPSTER_WEB_PORT) || 5320
  return {
    plugins: [react()],
    base: './',
    publicDir: fileURLToPath(new URL('../../out', import.meta.url)),
    server: { host, port, strictPort: true },
    preview: { host },
  }
})
