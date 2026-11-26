import { AnimatePresence, LayoutGroup, m } from 'framer-motion'
import { useCallback, useEffect, useState, type MouseEvent, type PointerEvent } from 'react'
import type { Store } from './core/data'
import { parseHash } from './core/route'
import { activeOf } from './core/view'
import { Home } from './Home'
import { useDrawerWidth, useMedia } from './hooks/useMedia'
import { useKeyDown } from './hooks/useKeys'
import { useView } from './hooks/useView'
import { Lightbox, type Zoom } from './Lightbox'
import { Pane } from './pane/Pane'
import { Sidebar } from './sidebar/Sidebar'
import { useSidebar } from './sidebar/useSidebar'
import type { RevealRequest } from './sidebar/useSidebarList'
import { FlowSpine, Stack } from './Strips'
import { QUICK } from './ui/motion'

// 탐색기 화면 = 사이드바 + 흐름 칸 + [왼쪽 띠] 연관 칸 [오른쪽 띠] (design.md §3 "칸")
// 11-27 평평한 판: 바탕 그라데이션·카드·틈 없이 사이드바 | 칸 | 띠 | 칸을 1px 선으로 붙인다 (선 = 각 칸·띠의 왼쪽 테두리)
// 폰(≤720px): 사이드바는 서랍 — ☰을 누르면 사이드바+칸 묶음이 통째로 오른쪽으로 밀리며 나온다(iOS처럼). 밀린 칸을 누르면 닫힘
// 여기서 갖는 화면 상태: 폰 서랍 열림 · 마우스 올린 글(트리에서 짚기) · 트리에서 보이기 요청 · 그림 크게

let revealN = 0

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
  const paneProps = { store, view, phone, crumbs, flash, pending, dispatch, onReveal: revealDoc, onZoom: setZoom, onMenu }
  // 두 칸이 나란히면 흐름 칸은 반 — 띠가 몇 개든 흐름 칸 폭은 그대로, 띠는 연관 쪽에서만 빠진다
  const half = !phone && hasRel && !coll

  return (
    <div className="relative h-full overflow-hidden bg-page font-sans text-slate-900 antialiased">
      {/* 폰: 사이드바(서랍 폭)+칸을 한 줄로 놓고 서랍 폭만큼 왼쪽으로 밀어 둔다 — 열면 0으로 */}
      <m.div
        className="flex h-full"
        style={{ width: phone ? `calc(100% + ${drawerW}px)` : '100%' }}
        initial={false}
        animate={{ x: phone && !drawer ? -drawerW : 0 }}
        transition={QUICK}
      >
        <Sidebar
          sidebar={sidebar}
          phone={phone}
          drawerWidth={drawerW}
          onDrawerClose={() => setDrawer(false)}
          ix={ix}
          view={view}
          focusDoc={focusDoc}
          hl={[hover, rowFlash]}
          reveal={reveal}
          onOpen={(id) => {
            dispatch({ type: 'open', id })
            setDrawer(false)
          }}
          onScan={(id) => dispatch({ type: 'open', id, scan: true })}
          onHome={() => {
            dispatch({ type: 'home' })
            setDrawer(false)
          }}
        />
        <main className="relative min-w-0 flex-1 overflow-hidden" onPointerDown={onPanesDown} onMouseOver={onPanesOver} onMouseLeave={() => setHover(null)}>
          <LayoutGroup>
            <div className="flex h-full w-full overflow-hidden" data-panes={hasRel ? 'two' : 'one'}>
              <AnimatePresence initial={false} mode="popLayout">
                {!view.main ? (
                  <Home key="home" ix={ix} z={Z.main} phone={phone} onMenu={onMenu} onOpen={(id) => dispatch({ type: 'open', id })} />
                ) : (
                  [
                    coll === 'main' && hasRel ? (
                      <FlowSpine key="spine" z={Z.main} title={ix.docsById.get(view.main)?.title ?? '없는 글'} dispatch={dispatch} />
                    ) : phone && hasRel ? null : (
                      <Pane key={`main:${view.main}`} slot="main" docId={view.main} dir={dir.main} half={half} z={Z.main} focused={slot === 'main'} {...paneProps} />
                    ),
                    leftTabs > 0 && <Stack key="stack-left" ix={ix} view={view} side="left" z={Z.left} phone={phone} dispatch={dispatch} />,
                    hasRel && active && coll !== 'rel' && (
                      <Pane key={`rel:${active}`} slot="rel" docId={active} dir={dir.rel} half={false} z={Z.rel} focused={slot === 'rel'} {...paneProps} />
                    ),
                    rightTabs > 0 && <Stack key="stack-right" ix={ix} view={view} side="right" z={Z.right} phone={phone} dispatch={dispatch} />,
                  ]
                )}
              </AnimatePresence>
            </div>
          </LayoutGroup>
          {/* 폰 서랍이 열렸을 때 밀린 칸 — 누르면 닫힘 */}
          <AnimatePresence>
            {drawerOpen && (
              <m.div
                key="scrim"
                className="absolute inset-0 z-[90] bg-black/25"
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
        </main>
      </m.div>

      <Lightbox zoom={zoom} onClose={() => setZoom(null)} />
    </div>
  )
}
