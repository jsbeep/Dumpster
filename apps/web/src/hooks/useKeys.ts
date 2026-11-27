import { useEffect, useLayoutEffect, useRef } from 'react'

// 키보드 — 창에 keydown 하나씩. 지금 쓰는 곳:
//   Esc  : 그림 크게 → 폰 서랍 닫기 (Explorer) · 떠 있는 사이드바 → 레일 (Sidebar)
//          입력칸의 Esc(검색어 지우기·찾기 닫기)는 그 칸이 먼저 받아 stopPropagation — 창까지 안 온다
//   Ctrl/⌘+F : 지금 보는 칸에서 찾기 (pane/Find useFind)
//   j / k : 트리에서 다음/이전 글 (Sidebar) — 글자 자리(e.code)로 봐서 한글 자판이어도 된다
//   / · Ctrl/⌘+K : 사이드바 찾기칸으로 (Sidebar)

// 글자를 치는 중(입력칸·편집 가능한 곳)이면 한 글자 단축키는 넘긴다
export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
}

// on일 때만 창에 붙는다. handler는 매번 새로 만들어도 된다 (늘 최신 것을 부름)
export function useKeyDown(handler: (e: KeyboardEvent) => void, on = true) {
  const ref = useRef(handler)
  useLayoutEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!on) return
    const h = (e: KeyboardEvent) => ref.current(e)
    addEventListener('keydown', h)
    return () => removeEventListener('keydown', h)
  }, [on])
}
