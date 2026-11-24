import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 전용 — 포트는 package.json 스크립트(--port 5310 --strictPort)에서
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
