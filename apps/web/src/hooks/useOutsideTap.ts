import { useEffect, type RefObject } from 'react'

// 펼친 사이드바(폰 서랍 · 떠 있는 사이드바) 밖을 누르면 닫기 — 칸 위에 막을 깔지 않는다 (11-28 사용자: 펼쳐져도 뒤 칸 스크롤은 그대로).
//   누르기는 click(캡처, 문서)으로만 본다: 스크롤·끌기·휠은 click이 안 생겨 뒤 칸이 그대로 굴러가고,
//   누른 건 닫기로만 쓰고 삼킨다 — 뒤 칸 링크가 열리지 않게 (전에 막이 하던 일). React보다 먼저 받으려고 document 캡처.
//   사이드바 상자와 같은 세로줄(x)이면 안쪽으로 친다 — 폰 서랍은 위·아래 끝 12px 틈이 그림자라(pane/styles frame.drawer) 상자 밖이다
export function useOutsideTap(ref: RefObject<HTMLElement>, on: boolean, close: () => void) {
  useEffect(() => {
    if (!on) return
    const h = (e: MouseEvent) => {
      const el = ref.current
      if (!el || el.contains(e.target as Node)) return
      const r = el.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX < r.right) return
      e.preventDefault()
      e.stopPropagation()
      close()
    }
    document.addEventListener('click', h, true)
    return () => document.removeEventListener('click', h, true)
  }, [ref, on, close])
}
