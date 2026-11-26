import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

// 다크: ?theme=dark|light가 있으면 그걸로(스크린샷용), 없으면 시스템 설정을 따라간다
const forced = new URLSearchParams(location.search).get('theme')
const dark = matchMedia('(prefers-color-scheme: dark)')
const paint = () => document.documentElement.classList.toggle('dark', forced ? forced === 'dark' : dark.matches)
paint()
if (!forced) dark.addEventListener('change', paint)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
