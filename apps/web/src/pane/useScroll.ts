import { docHref, type BlockOf } from '@dumpster/blocks'
import { useIsPresent } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Slot } from '../core/view'
import { recall, remember } from '../hooks/scrollMemory'
import type { Landing } from '../hooks/useView'

// 칸 안 스크롤 — 읽던 자리 기억 · 읽는 위치 재기 · 글을 연 뒤 갈 곳(헤딩 · 가리키는 블록 · 찾기)
// 헤딩 id = anchor라 두 칸에 같은 헤딩이 있으면 id가 겹친다 → 늘 칸(스크롤 상자) 안에서 찾는다

const SPY_TOP = 48 // 칸 위에서 이만큼 안에 들어온 헤딩 = 지금 읽는 곳

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// 그 요소가 칸 맨 위(12px 틈)에 오게. 움직임 줄이기(OS 설정)거나 instant면 바로
export function scrollToEl(el: Element, instant = false) {
  const sc = el.closest('[data-scroll]')
  if (!sc) return
  sc.scrollTo({
    top: el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 12,
    behavior: instant || reducedMotion() ? 'auto' : 'smooth',
  })
}

export function scrollToAnchor(sc: HTMLElement | null, anchor: string, instant = false) {
  const el = sc?.querySelector(`#${CSS.escape(anchor)}`)
  if (el) scrollToEl(el, instant)
}

// 이 글을 가리키는 블록 — 본문([data-body])에서 그 글로 가는 첫 링크·임베드를 품은 문단·항목·칸.
// 칸 위에서 1/3쯤에 놓고(블록이 칸보다 길면 맨 위) 찾기 칠하기 색으로 잠깐 칠했다 지운다. 칠하기는 Web Animations —
// React가 그린 DOM(클래스·노드)은 안 건드린다. 본문에 링크가 없으면(함께 볼 글·갈래로만 이어짐) 아무것도 안 한다 → 맨 위
const TEXT_BLOCK = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption, dt, dd, summary'
function landOnLink(root: HTMLElement, sc: HTMLElement, id: string) {
  const a = root.querySelector(`[data-body] a[href="${docHref(id)}"]`)
  if (!a) return
  const body = a.closest('[data-body]')!
  const near = a.closest(TEXT_BLOCK)
  const el = near && body.contains(near) ? near : a
  for (let d = el.parentElement?.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true // 접힌 콜아웃
  const r = el.getBoundingClientRect()
  const box = sc.getBoundingClientRect()
  const off = r.height > box.height * 0.6 ? 12 : box.height / 3
  sc.scrollTo({ top: r.top - box.top + sc.scrollTop - off, behavior: reducedMotion() ? 'auto' : 'smooth' })
  const amber = getComputedStyle(document.documentElement).getPropertyValue('--c-amber-200').trim()
  const on = { backgroundColor: `rgb(${amber} / 0.7)`, boxShadow: `0 0 0 5px rgb(${amber} / 0.7)`, borderRadius: '3px' }
  const off0 = { backgroundColor: `rgb(${amber} / 0)`, boxShadow: `0 0 0 5px rgb(${amber} / 0)`, borderRadius: '3px' }
  el.animate([on, { ...on, offset: 0.45 }, off0], { duration: 2200, easing: 'ease-out' })
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

// 글을 연 뒤 할 일(hooks/useView Land) — 이 칸에 이 글로 놓였으면 본문이 도착한 뒤 한 번만:
//   anchor: 그 헤딩까지 · find: 칸 안 찾기를 그 검색어로 켬(본문 찾기면 헤딩에 바로 가 둔 뒤 — 찾기는 '지금 보이는 곳부터'
//   첫 일치를 고르니, 부드럽게 가는 도중이면 헤딩 위쪽 일치를 고른다) · linkTo: 그 글을 가리키는 블록까지 + 잠깐 칠함
// 받은 요청 번호는 모듈에 하나 — 칸은 글마다 새로 마운트되니(탭 갔다 오기) 칸 안에서 세면 같은 요청을 또 받는다
let landed = 0
export function useLanding(
  scrollRef: RefObject<HTMLElement>,
  articleRef: RefObject<HTMLElement>,
  pending: Landing | null,
  slot: Slot,
  docId: string,
  ready: unknown,
  openFind: (query: string, focus: boolean) => void,
) {
  useEffect(() => {
    if (!pending || pending.slot !== slot || pending.doc !== docId || !ready || pending.n <= landed) return
    landed = pending.n
    const sc = scrollRef.current
    if (pending.find !== undefined) {
      if (pending.anchor) scrollToAnchor(sc, pending.anchor, true)
      openFind(pending.find, false)
    } else if (pending.anchor) scrollToAnchor(sc, pending.anchor)
    if (pending.linkTo && articleRef.current && sc) landOnLink(articleRef.current, sc, pending.linkTo)
  }, [pending, ready, slot, docId, scrollRef, articleRef, openFind])
}
