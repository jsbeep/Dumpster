// 라이트·다크 — 우선순위: 주소 ?theme=dark|light(스크린샷용, 이번 페이지만) → 사이드바 버튼으로 고른 것 → 시스템 설정
const KEY = 'dumpster-theme'
type Theme = 'light' | 'dark'

const isTheme = (t: unknown): t is Theme => t === 'light' || t === 'dark'
let forced: Theme | null = (() => {
  const t = new URLSearchParams(location.search).get('theme')
  return isTheme(t) ? t : null
})()
const media = matchMedia('(prefers-color-scheme: dark)')

function stored(): Theme | null {
  try {
    const t = localStorage.getItem(KEY)
    return isTheme(t) ? t : null
  } catch {
    return null
  }
}

export const isDark = () => (forced ?? stored() ?? (media.matches ? 'dark' : 'light')) === 'dark'

export function paintTheme() {
  document.documentElement.classList.toggle('dark', isDark())
}

export function toggleTheme(): boolean {
  const next: Theme = isDark() ? 'light' : 'dark'
  forced = null
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // 저장이 막힌 창(사생활 보호 등) — 이번 페이지에서만 바뀐다
    forced = next
  }
  paintTheme()
  return next === 'dark'
}

// 시스템 설정이 바뀌면 (고른 게 없을 때만 의미 있음) 다시 칠하고 알린다
export function onSystemTheme(cb: () => void): () => void {
  const h = () => {
    paintTheme()
    cb()
  }
  media.addEventListener('change', h)
  return () => media.removeEventListener('change', h)
}
