import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { dumpsterDevApi } from './devApi'

// 짜가 볼트의 공개 폴더 목록 — .env는 실제 볼트를 가리킬 수 있으니 .env.example(짜가 볼트 기본값)에서 읽는다.
// 라이브 탭의 링크·이미지 해석이 빌더와 같게 비공개 폴더를 못 찾게 하려고
const envExample = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8')
const fixturePublic = (/^DUMPSTER_PUBLIC=(.*)$/m.exec(envExample)?.[1] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const fixtureIgnore = (/^DUMPSTER_IGNORE=(.*)$/m.exec(envExample)?.[1] || '_image')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// 개발 전용 — 포트는 package.json 스크립트(--port 5310 --strictPort)에서
export default defineConfig({
  plugins: [react(), dumpsterDevApi()],
  define: { __FIXTURE_PUBLIC__: JSON.stringify(fixturePublic), __FIXTURE_IGNORE__: JSON.stringify(fixtureIgnore) },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
