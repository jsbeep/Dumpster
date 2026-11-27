import { useCallback, useEffect, useRef, useState } from 'react'
import type { Store } from '../core/data'
import { hashOf, parseHash } from '../core/route'
import type { GraphIndex } from '@dumpster/schema'
import { activeOf, freshDocs, isView, reduce, routeOf, shownDocs, viewOfRoute, type Action, type Slot, type View } from '../core/view'
import { forget, saveNow, seed, type ScrollMap } from './scrollMemory'

// 칸 상태 훅 — reduce(순수 함수) 결과를 화면·브라우저 기록에 옮긴다 (design.md §3 "칸")
//   view : 기록에 들어가는 칸 상태 (history.state.view, 주소엔 흐름 글 + 펼친 탭만)
//   slot : 지금 보는 칸 — 사이드바 컬렉션·트리 ↙/↗의 기준. 기록 밖 state지만 뒤로가기 때 같이 돌아오게 history.state에도 적는다
//   flash: 이미 보이는 글로 가려 할 때 그 칸만 반짝
//   pending: 글이 칸에 놓인 뒤 할 일(Land) — 그 글이 놓인 칸이 본문을 받은 뒤 한 번만 (pane/useScroll useLanding)
//   dir  : 새 글이 칸에 들어오는 방향 (1 = 오른쪽에서, -1 = 왼쪽에서, 0 = 제자리) — 칸 애니메이션용
// 기록 한 칸 = { view, slot, scroll } — scroll은 그 기록에서 보이던 글들의 칸 안 자리 (hooks/scrollMemory).
//   새 기록을 쌓기 직전에 지금 기록의 scroll을 적고, 처음 여는 글의 기억은 지운다(맨 위부터).
//   뒤로/앞으로로 칸에 새로 들어오는 글은 그 기록의 scroll로 (계속 보이던 칸은 그대로)

export interface Pulse {
  slot: Slot
  n: number // 같은 칸이 또 반짝일 때도 바뀌게 (key로 써서 애니메이션을 다시 튼다)
}
// 글을 연 뒤 칸 안에서 할 일 — dispatch의 두 번째 인자
export interface Land {
  anchor?: string // 그 헤딩까지 (헤딩 링크 [[글#헤딩]] · 사이드바 본문 찾기)
  find?: string // 칸 안 찾기를 이 검색어로 켬 (사이드바 찾기칸에서 고른 글)
  linkTo?: string // 이 글을 가리키는 블록까지 + 잠깐 칠함 (글 끝 '이 글을 가리키는 글')
}
export interface Landing extends Pulse, Land {
  doc: string // 그 칸에 놓인 글 — 같은 칸의 나가는 칸(다른 글)은 안 받는다
}

export interface Dir {
  main: number
  rel: number
}
const STILL: Dir = { main: 0, rel: 0 }

// 이전 글·조상 글(브레드크럼의 분기점)로 가면 왼쪽에서, 그 밖(다음 글·새 탭·바로가기)은 오른쪽에서. 탭 사이 이동은 탭 순서대로
function directionOf(ix: GraphIndex, a: View, action: Action, b: View): Dir {
  const back = (from: string | null, to: string | null) => (from && to && (ix.prevOf.get(from) === to || ix.ancestors(from).includes(to)) ? -1 : 1)
  let main = 0
  let rel = 0
  if (a.main !== b.main) main = action.type === 'step' ? back(a.main, b.main) : action.type === 'promote' ? 1 : 0
  const ra = activeOf(a)
  const rb = activeOf(b)
  if (rb && rb !== ra) {
    const i = a.tabs.indexOf(rb)
    rel = i >= 0 ? Math.sign(i - a.active) : action.type === 'step' ? back(ra, rb) : 1
  }
  return { main, rel }
}

interface Saved {
  view: View
  slot: Slot
  scroll?: ScrollMap
}

// 같은 기록을 고쳐 쓸 때 scroll을 잃지 않게 — 지금 기록 위에 덮는다
const current = (): Partial<Saved> => (history.state && typeof history.state === 'object' ? (history.state as Partial<Saved>) : {})

// 처음 상태: 기록에 남은 칸(새로고침·뒤로 와서 다시 연 탭) → 없으면 주소. 옛 임시 ID는 지금 ID로
function initialView(store: Store): View {
  const saved = (history.state as Partial<Saved> | null)?.view
  if (isView(saved)) return saved
  const route = parseHash(location.hash)
  const fix = (id: string | null) => (id ? (store.resolveId(id) ?? id) : null)
  return viewOfRoute({ main: fix(route.main), rel: fix(route.rel) })
}
const savedSlot = (v: View): Slot => {
  const s = (history.state as Partial<Saved> | null)?.slot
  return s === 'rel' && v.tabs.length ? 'rel' : 'main'
}

let pulseN = 0

export function useView(store: Store) {
  const [view, setView] = useState<View>(() => {
    const v = initialView(store)
    seed(current().scroll, shownDocs(v)) // 새로고침 — 그 기록의 자리로
    return v
  })
  const [slot, setSlot] = useState<Slot>(() => savedSlot(view))
  const [flash, setFlash] = useState<Pulse | null>(null)
  const [pending, setPending] = useState<Landing | null>(null)
  const [dir, setDir] = useState<Dir>(STILL)

  // 핸들러가 옛 view를 붙잡지 않게 — dispatch는 한 번만 만들고 최신 값은 ref에서 읽는다
  const viewRef = useRef(view)
  const slotRef = useRef(slot)

  // 처음 한 번: 주소를 지금 칸 모양으로 맞추고(옛 ID·잘못된 주소 정리) 기록에 칸을 적는다
  // 페이지를 떠날 때(새로고침 포함) 지금 자리를 적어 둔다
  useEffect(() => {
    const v = viewRef.current
    history.replaceState({ ...current(), view: v, slot: slotRef.current } satisfies Saved, '', hashOf(routeOf(v)))
    addEventListener('pagehide', saveNow)
    return () => removeEventListener('pagehide', saveNow)
  }, [])

  // 뒤로·앞으로 · 주소창에서 직접 고친 주소
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const saved = e.state as Partial<Saved> | null
      let v: View
      if (isView(saved?.view)) v = saved.view
      else {
        const r = parseHash(location.hash)
        const fix = (id: string | null) => (id ? (store.resolveId(id) ?? id) : null)
        v = viewOfRoute({ main: fix(r.main), rel: fix(r.rel) })
        history.replaceState({ view: v, slot: 'main' } satisfies Saved, '', hashOf(routeOf(v)))
      }
      const s: Slot = saved?.slot === 'rel' && v.tabs.length ? 'rel' : 'main'
      // 칸에 새로 들어오는 글만 그 기록의 자리로
      const prev = viewRef.current
      const entering = [v.main !== prev.main ? v.main : null, activeOf(v) !== activeOf(prev) ? activeOf(v) : null]
      seed(saved?.scroll, entering.filter((x): x is string => x !== null))
      viewRef.current = v
      slotRef.current = s
      setDir(STILL)
      setView(v)
      setSlot(s)
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [store])

  // 반짝임은 1초 뒤 지운다 — 남겨 두면 칸이 다시 그려질 때 또 반짝인다
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1000)
    return () => clearTimeout(t)
  }, [flash])

  const dispatch = useCallback((action: Action, land?: Land) => {
    const before = viewRef.current
    const r = reduce(before, action)
    const v = r.view
    const s: Slot = !v.tabs.length ? 'main' : (r.slot ?? slotRef.current)
    if (r.history !== 'none') {
      if (r.history === 'push') saveNow() // 떠나는 기록에 지금 자리를 적고
      forget(freshDocs(before, v)) // 처음 여는 글은 맨 위부터
      if (r.history === 'push') {
        history.pushState({ view: v, slot: s } satisfies Saved, '', hashOf(routeOf(v)))
      } else history.replaceState({ ...current(), view: v, slot: s } satisfies Saved, '', hashOf(routeOf(v)))
    } else if (s !== slotRef.current) {
      history.replaceState({ ...current(), view: v, slot: s } satisfies Saved, '')
    }
    if (v !== before) setDir(directionOf(store.index, before, action, v))
    viewRef.current = v
    slotRef.current = s
    setView(v)
    setSlot(s)
    if (r.flash) setFlash({ slot: r.flash, n: ++pulseN })
    const doc = r.slot === 'main' ? v.main : r.slot === 'rel' ? activeOf(v) : null
    if (land && r.slot && doc) setPending({ ...land, slot: r.slot, doc, n: ++pulseN })
  }, [store])

  // 칸을 누르면 그 칸이 지금 보는 칸 (기록은 안 쌓고 지금 기록의 slot만 고친다)
  const focusSlot = useCallback((s: Slot) => {
    if (s === slotRef.current || !viewRef.current.tabs.length) return
    slotRef.current = s
    setSlot(s)
    history.replaceState({ ...current(), view: viewRef.current, slot: s } satisfies Saved, '')
  }, [])

  return { view, slot, flash, pending, dir, dispatch, focusSlot }
}
