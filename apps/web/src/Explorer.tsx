import { AnimatePresence, LayoutGroup, m } from 'framer-motion'
import { useCallback, useEffect, useState, type MouseEvent, type PointerEvent } from 'react'
import type { Store } from './core/data'
import { parseHash } from './core/route'
import { slideOf } from './core/slide'
import { activeOf, type Action } from './core/view'
import { Home } from './Home'
import { useDrawerWidth, useMedia } from './hooks/useMedia'
import { useKeyDown } from './hooks/useKeys'
import { useView, type Land } from './hooks/useView'
import { Lightbox, type Zoom } from './Lightbox'
import { Pane } from './pane/Pane'
import { Sidebar } from './sidebar/Sidebar'
import { useSidebar } from './sidebar/useSidebar'
import type { RevealRequest } from './sidebar/useSidebarList'
import { FlowSpine, Stack } from './Strips'
import { QUICK } from './ui/motion'
import { SITE } from './ui/site'
import { slide } from './ui/viewTransition'

// 탐색기 화면 = 사이드바 + 흐름 칸 + [왼쪽 띠] 연관 칸 [오른쪽 띠] (design.md §3 "칸")
// 11-27 평평한 판: 바탕 그라데이션·카드·틈 없이 사이드바 | 칸 | 띠 | 칸을 1px 선으로 붙인다 (선 = 각 칸·띠의 왼쪽 테두리)
// 폰(≤720px): 칸 하나 + 문서 스크롤, 칸 움직임 없음(B3 11-27). 사이드바는 서랍 — ☰을 누르면 칸이 오른쪽으로 밀리며 나온다(iOS처럼). 밀린 칸을 누르면 닫힘
// 여기서 갖는 화면 상태: 폰 서랍 열림 · 마우스 올린 글(트리에서 짚기) · 트리에서 보이기 요청 · 그림 크게

let revealN = 0

// 폰 서랍 미끄러짐 — CSS transition (11-27). framer의 x는 JS가 프레임마다 transform을 쓰는데(메인 스레드),
// iOS 저전력 모드는 JS 애니메이션을 30fps로 묶어 버벅였다. CSS transition + cubic-bezier는 브라우저가 GPU 쪽에서 돌린다 (Chirpy와 같은 방식).
// 곡선·길이는 ui/motion QUICK과 같게. linear()·스프링은 iOS에서 GPU로 못 넘겨 다시 30fps가 된다
const DRAWER_SLIDE = 'transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none'

export function Explorer({ store }: { store: Store }) {
  const ix = store.index
  const { view, slot, flash, pending, dir, dispatch, focusSlot } = useView(store)
  const phone = useMedia('(max-width: 720px)')
  const narrow = useMedia('(max-width: 1023px)') // mongolive와 같은 기준 — 사이드바 전체가 칸 위에 뜬다
  const twoPaneNarrow = useMedia('(max-width: 1099px)') // 칸이 둘이면 이보다 좁을 때도 뜬다 (design.md §3)
  const hasRel = view.tabs.length > 0
  const sidebar = useSidebar(narrow || (hasRel && !view.collapsed && twoPaneNarrow))
  const [drawer, setDrawer] = useState(false) // 폰 서랍 열림
  const drawerW = useDrawerWidth(phone)
  const [hover, setHover] = useState<string | null>(null) // 본문 링크·띠·글 끝 목록에 마우스 → 트리에서 그 글 자리
  const [reveal, setReveal] = useState<RevealRequest | null>(null)
  const [rowFlash, setRowFlash] = useState<string | null>(null)
  const [zoom, setZoom] = useState<Zoom | null>(null)

  const focusDoc = slot === 'rel' && hasRel ? activeOf(view) : view.main

  // 브라우저 탭 제목 = 지금 보는 글 — 방문 기록·북마크·공유에 글 제목이 남는다
  useEffect(() => {
    const t = focusDoc ? ix.docsById.get(focusDoc)?.title : undefined
    document.title = t ? `${t} — ${SITE.title}` : SITE.title
  }, [focusDoc, ix])
  const coll = phone ? null : view.collapsed
  const active = activeOf(view)
  // 띠에 들어갈 탭이 있는 쪽만 (왼쪽 = 펼친 탭 앞쪽 + 연관 칸을 접었으면 펼친 탭, 오른쪽 = 뒤쪽)
  const leftTabs = hasRel && !phone ? view.active + (coll === 'rel' ? 1 : 0) : 0
  const rightTabs = hasRel && !phone ? view.tabs.length - view.active - 1 : 0
  const drawerOpen = phone && drawer

  // 폰이 아니게 되면 서랍은 닫힌 것으로
  useEffect(() => {
    if (!phone) setDrawer(false)
  }, [phone])

  // 트리에서 그 글 보이기 — 사이드바가 접혀 있으면 펼치고(폰은 서랍을 열고), 행을 잠깐 테두리로
  const revealDoc = useCallback(
    (id: string) => {
      setReveal({ id, n: ++revealN })
      setRowFlash(id)
      if (phone) setDrawer(true)
    },
    [phone],
  )
  useEffect(() => {
    if (!rowFlash) return
    const t = setTimeout(() => setRowFlash(null), 1200)
    return () => clearTimeout(t)
  }, [rowFlash])

  // Esc — 그림 크게 → 폰 서랍 순서로 닫는다
  useKeyDown((e) => {
    if (e.key !== 'Escape') return
    if (zoom) setZoom(null)
    else setDrawer(false)
  }, !!zoom || drawerOpen)

  // 칸을 누르면 그 칸이 지금 보는 칸 → 사이드바가 그 글의 컬렉션으로 (기록엔 안 쌓임)
  // 글로 가는 링크·버튼은 빼고 — 누르면 바로 다른 글이 열려서 사이드바가 한 번 더 바뀐다 (다른 컬렉션이 펴졌다 다시 접힘)
  const onPanesDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('a[href^="#/d/"], [data-hl]')) return
    const pane = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]')
    const s = pane?.dataset.slot
    if ((s === 'main' || s === 'rel') && pane!.dataset.spine === undefined) focusSlot(s)
  }
  const onPanesOver = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-hl], a[href^="#/d/"]')
    const id = el ? (el.dataset.hl ?? parseHash(el.getAttribute('href') ?? '').main) : null
    setHover((h) => (h === id ? h : id))
  }

  // 겹칠 때 위에 오는 순서: 왼쪽 칸일수록 위 (mongolive 밀러 컬럼 99 - 순서). 흐름 칸이 늘 맨 위
  const Z = { main: 40, left: 30, rel: 20, right: 10 }
  const onMenu = phone ? () => setDrawer(true) : undefined
  // 사이드바 트리가 화면에 없으면(폰 서랍·떠 있는 사이드바·레일·접힘) 칸 본문 맨 위가 브레드크럼 (P4.4)
  const crumbs = phone || sidebar.isOverlay || sidebar.mode !== 'full'
  // 폰: 보이는 글이 바뀌는 동작(이전/다음·링크·‹·탭 닫기)은 미끄러뜨린다 — core/slide 방향, ui/viewTransition (View Transitions API)
  // 서랍에서 고르기·첫 화면은 칸 dispatch를 안 거쳐서 슬라이드 없음
  const phoneDispatch = useCallback(
    (action: Action, land?: Land) => {
      const dir = slideOf(ix, view, action)
      if (dir) slide(dir, () => dispatch(action, land))
      else dispatch(action, land)
    },
    [ix, view, dispatch],
  )
  const paneProps = { store, view, phone, crumbs, flash, pending, dispatch: phone ? phoneDispatch : dispatch, onReveal: revealDoc, onZoom: setZoom, onMenu }
  // 두 칸이 나란히면 흐름 칸은 반 — 띠가 몇 개든 흐름 칸 폭은 그대로, 띠는 연관 쪽에서만 빠진다
  const half = !phone && hasRel && !coll

  const sidebarEl = (
    <Sidebar
      sidebar={sidebar}
      phone={phone}
      drawerWidth={drawerW}
      onDrawerOpen={() => setDrawer(true)}
      onDrawerClose={() => setDrawer(false)}
      ix={ix}
      store={store}
      view={view}
      focusDoc={focusDoc}
      hl={[hover, rowFlash]}
      reveal={reveal}
      onOpen={(id, land) => {
        dispatch({ type: 'open', id, solo: phone }, land)
        setDrawer(false)
      }}
      onScan={(id) => dispatch({ type: 'open', id, scan: true })}
      onHome={() => {
        dispatch({ type: 'home' })
        setDrawer(false)
      }}
    />
  )
  const home = <Home key="home" ix={ix} z={Z.main} phone={phone} onMenu={onMenu} onOpen={(id) => dispatch({ type: 'open', id })} />

  // 폰 (B3 11-27): 칸 하나 + 문서 스크롤, 칸 움직임 없음 (사용자: 폰은 단순하게). 칸 머리는 화면 위에 붙는다(sticky, pane/styles frame).
  //   서랍 = 화면에 고정된 사이드바가 왼쪽에서 들어오고, 같은 움직임(CSS transition, DRAWER_SLIDE)으로 칸 묶음이 서랍 폭만큼 오른쪽으로 밀린다
  //   (사용자: 이 움직임은 좋았다 — 남김). 밀린 칸은 어두운 막, 누르면 닫힘. 밀려서 화면 밖으로 나간 부분은 overflow-x-clip으로 잘라
  //   가로 스크롤이 안 생기게(clip은 스크롤 상자를 안 만들어 칸 머리 sticky가 산다). 닫혀 있어도 그려 둔다 — 찾기어·트리 스크롤이 남게.
  //   탭이 있으면 펼친 탭, 없으면 흐름 글 (design.md §3 폰)
  if (phone) {
    const shown = hasRel && active ? ['rel', active] as const : view.main ? ['main', view.main] as const : null
    return (
      <div className="relative min-h-dvh overflow-x-clip bg-page font-sans text-slate-900 antialiased">
        <div className={`relative ${DRAWER_SLIDE}`} style={{ transform: drawer ? `translateX(${drawerW}px)` : 'none' }}>
          <main className="relative min-w-0" onPointerDown={onPanesDown} data-panes="one">
            {shown ? (
              <Pane key={`${shown[0]}:${shown[1]}`} slot={shown[0]} docId={shown[1]} dir={0} half={false} z={Z.main} focused {...paneProps} />
            ) : (
              home
            )}
          </main>
          <AnimatePresence>
            {drawerOpen && (
              <m.div
                key="scrim"
                className="absolute inset-0 z-[90] touch-none bg-black/25"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={QUICK}
                onClick={() => setDrawer(false)}
                aria-hidden
                data-scrim
              />
            )}
          </AnimatePresence>
        </div>
        <div className={`fixed inset-y-0 left-0 z-[100] ${DRAWER_SLIDE}`} style={{ width: drawerW, transform: `translateX(${drawer ? 0 : -drawerW}px)` }}>
          {sidebarEl}
        </div>
        <Lightbox zoom={zoom} onClose={() => setZoom(null)} />
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-hidden bg-page font-sans text-slate-900 antialiased">
      <div className="flex h-full w-full">
        {sidebarEl}
        <main className="relative min-w-0 flex-1 overflow-hidden" onPointerDown={onPanesDown} onMouseOver={onPanesOver} onMouseLeave={() => setHover(null)}>
          <LayoutGroup>
            <div className="flex h-full w-full overflow-hidden" data-panes={hasRel ? 'two' : 'one'}>
              <AnimatePresence initial={false} mode="popLayout">
                {!view.main
                  ? home
                  : [
                      coll === 'main' && hasRel ? (
                        <FlowSpine key="spine" z={Z.main} title={ix.docsById.get(view.main)?.title ?? '없는 글'} dispatch={dispatch} />
                      ) : (
                        <Pane key={`main:${view.main}`} slot="main" docId={view.main} dir={dir.main} half={half} z={Z.main} focused={slot === 'main'} {...paneProps} />
                      ),
                      leftTabs > 0 && <Stack key="stack-left" ix={ix} view={view} side="left" z={Z.left} phone={phone} dispatch={dispatch} />,
                      hasRel && active && coll !== 'rel' && (
                        <Pane key={`rel:${active}`} slot="rel" docId={active} dir={dir.rel} half={false} z={Z.rel} focused={slot === 'rel'} {...paneProps} />
                      ),
                      rightTabs > 0 && <Stack key="stack-right" ix={ix} view={view} side="right" z={Z.right} phone={phone} dispatch={dispatch} />,
                    ]}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </main>
      </div>

      <Lightbox zoom={zoom} onClose={() => setZoom(null)} />
    </div>
  )
}
