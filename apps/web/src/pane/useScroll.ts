import type { BlockOf } from '@dumpster/blocks'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Slot } from '../core/view'
import type { PendingHeading } from '../hooks/useView'

// 칸 안 스크롤 — 읽는 위치 재기 · 헤딩까지 가기
// 헤딩 id = anchor라 두 칸에 같은 헤딩이 있으면 id가 겹친다 → 늘 칸(스크롤 상자) 안에서 찾는다

const SPY_TOP = 48 // 칸 위에서 이만큼 안에 들어온 헤딩 = 지금 읽는 곳

// 그 요소가 칸 맨 위(12px 틈)에 오게. 움직임 줄이기(OS 설정)면 바로
export function scrollToEl(el: Element) {
  const sc = el.closest('[data-scroll]')
  if (!sc) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  sc.scrollTo({
    top: el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 12,
    behavior: reduced ? 'auto' : 'smooth',
  })
}

export function scrollToAnchor(sc: HTMLElement | null, anchor: string) {
  const el = sc?.querySelector(`#${CSS.escape(anchor)}`)
  if (el) scrollToEl(el)
}

export interface Spy {
  heading: string | null // 목차 줄에서 진하게 할 헤딩
  title: boolean // 제목이 위로 지나감 → 칸 머리에 제목 + 밑줄
}

// 읽는 위치 → 목차 줄·칸 위 제목. 스크롤마다 rAF 하나로 모아 잰다
export function useScrollSpy(scrollRef: RefObject<HTMLElement>, heads: BlockOf<'heading'>[]) {
  const [spy, setSpy] = useState<Spy>({ heading: null, title: false })
  const raf = useRef(0)
  const onScroll = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const sc = scrollRef.current
      if (!sc) return
      const top = sc.getBoundingClientRect().top
      let heading: string | null = null
      for (const h of heads) {
        const el = sc.querySelector(`#${CSS.escape(h.anchor)}`)
        if (el && el.getBoundingClientRect().top - top <= SPY_TOP) heading = h.anchor
      }
      const t = sc.querySelector<HTMLElement>('[data-title]')
      const title = !!t && sc.scrollTop > t.offsetTop + t.offsetHeight - 8
      setSpy((s) => (s.heading === heading && s.title === title ? s : { heading, title }))
    })
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  return { spy, onScroll }
}

// 헤딩 링크([[글#헤딩]]) → 이 칸에 놓였으면 본문이 도착한 뒤 그 헤딩까지 (요청마다 한 번)
export function useHeadingJump(scrollRef: RefObject<HTMLElement>, pending: PendingHeading | null, slot: Slot, ready: unknown) {
  const handled = useRef(0)
  useEffect(() => {
    if (!pending || pending.slot !== slot || !ready || handled.current === pending.n) return
    handled.current = pending.n
    scrollToAnchor(scrollRef.current, pending.anchor)
  }, [pending, ready, slot, scrollRef])
}
