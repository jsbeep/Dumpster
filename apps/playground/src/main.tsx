import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

// ?theme=dark — 첫 그림부터 다크로 (스크린샷용, 깜빡임 없이)
if (new URLSearchParams(location.search).get('theme') === 'dark') document.documentElement.classList.add('dark')

// 헤드리스 Firefox 스크린샷은 load 이벤트에 찍는다 — 그 전에 다 그려 두려고 동기 렌더
const root = createRoot(document.getElementById('root')!)
flushSync(() =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
