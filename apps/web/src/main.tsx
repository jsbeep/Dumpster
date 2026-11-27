import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { paintTheme } from './ui/theme'
import './index.css'

paintTheme()
// 스크롤 자리는 앱이 글마다 기억한다(hooks/scrollMemory) — 폰은 문서가 스크롤돼서 브라우저도 뒤로가기 때 제 기억으로 옮기려 든다
history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
