import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { paintTheme } from './ui/theme'
import './index.css'

paintTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
