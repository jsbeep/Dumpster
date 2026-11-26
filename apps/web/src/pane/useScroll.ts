import type { BlockOf } from '@dumpster/blocks'
import { useIsPresent } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Slot } from '../core/view'
import { recall, remember } from '../hooks/scrollMemory'
import type { PendingHeading } from '../hooks/useView'

// 칸 안 스크롤 — 읽던 자리 기억 · 읽는 위치 재기 · 헤딩까지 가기
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

// 읽던 자리 (hooks/scrollMemory) — 본문이 도착해 그려지면 한 번 그 자리로, 스크롤할 때마다 기억.
// 칸은 글마다 새로 마운트된다(key = 칸:글) — 그래서 '칸이 새로 그려질 때'가 곧 '다시 열 때'.
// 처음 여는 글은 useView가 기억을 지워 둬서 0(맨 위). 돌아온 뒤 스크롤 이벤트가 한 번 와서 목차 줄·칸 위 제목도 맞춰진다.
// 그 자리가 지금 폭에서 없으면(칸이 좁아져 글이 짧아짐 — @container 여백·제목 크기) 갈 수 있는 끝까지 — 브라우저 뒤로가기와 같다.
// 나가는 중인 칸(AnimatePresence 퇴장)은 적지 않는다 — 빠지는 동안 폭이 바뀌어 줄어든 값이 기억을 덮어쓸 수 있다
export function useScrollMemory(scrollRef: RefObject<HTMLElement>, docId: string, ready: boolean) {
  const present = useIsPresent()
  const restored = useRef(false)
  useLayoutEffect(() => {
    if (!ready || restored.current) return
    restored.current = true
    const y = recall(docId)
    if (y && scrollRef.current) scrollRef.current.scrollTop = y
  }, [ready, docId, scrollRef])
  return () => {
    // 돌아가기 전(본문이 오기 전)의 스크롤은 적지 않는다 — 빈 칸의 0이 기억을 덮어쓰지 않게
    if (present && restored.current && scrollRef.current) remember(docId, scrollRef.current.scrollTop)
  }
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
