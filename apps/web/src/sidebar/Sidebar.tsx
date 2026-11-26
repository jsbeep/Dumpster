import type { GraphIndex } from '@dumpster/schema'
import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { stepRow } from '../core/treeRows'
import type { View } from '../core/view'
import { isTyping, useKeyDown } from '../hooks/useKeys'
import { QUICK } from '../ui/motion'
import { PullHandle } from './PullHandle'
import { Rail } from './Rail'
import { SidebarList } from './SidebarList'
import { useDrag } from './useDrag'
import { FULL_DEFAULT, RAIL_WIDTH, clampFullWidth, snapMode, type SidebarMode, type SidebarState } from './useSidebar'
import { useSidebarList, type RevealRequest } from './useSidebarList'

// 왼쪽 사이드바 껍데기 — mongolive components/layout/Sidebar.tsx의 모양·동작을 그대로 잇는다. 내용은 SidebarList(전체)·Rail(레일)
//   세 단계(useSidebar): 완전 접힘 / 아이콘 레일 / 전체
//   접힘: 화면 왼쪽 끝 당김 핸들(PullHandle)
//   너비: 오른쪽 틈을 끌면 너비에 따라 단계가 바뀐다(useDrag). 더블클릭 = 기본 너비
//   떠 있는 화면(좁은 창·두 칸)에선 레일까지만 붙고, 전체는 칸 위에 떠서 열린다(바깥 누르기·Esc·글 고르기 → 레일)
//   j/k: 트리에서 다음/이전 글 — 지금 보는 칸의 글 줄에서 한 줄 아래/위를 누른 것과 같다(흐름 칸 교체). 기록은 덮어씀(scan).
//        사이드바가 접혔거나 최근·태그 탭이어도 트리(접은 갈래 반영) 기준
//   폰(≤720px, 11-27): 단계 없음. 칸 머리 ☰ → App이 사이드바+칸을 통째로 밀어 꺼낸다(서랍) — 여기선 전체 내용만 그린다
// 11-27 평평한 판: 카드·그림자 없이 사이드바 바탕색만. 칸 쪽 경계선은 첫 칸의 왼쪽 선이 맡는다

const HANDLE = 8 // 끌기 손잡이 너비 — 사이드바와 칸의 경계선 위에 반씩 걸친다

const styles = {
  card: 'relative flex h-full flex-col overflow-hidden bg-side',
  cardFloating: 'relative flex h-full flex-col overflow-hidden border-r border-line bg-side shadow-pop',
  handle: 'group absolute inset-y-0 z-[60] flex cursor-col-resize touch-none justify-center outline-none',
  handleLineIdle: 'w-[2px] bg-transparent transition-colors group-hover:bg-slate-400 group-focus-visible:bg-slate-500',
  handleLineActive: 'w-[2px] bg-slate-500',
} as const

const dockedWidthOf = (mode: SidebarMode, fullWidth: number) => (mode === 'full' ? fullWidth : mode === 'rail' ? RAIL_WIDTH : 0)

interface Props {
  sidebar: SidebarState
  phone: boolean // 폰 서랍 — 전체 내용만, 폭 drawerWidth
  drawerWidth: number
  onDrawerClose: () => void
  ix: GraphIndex
  view: View
  focusDoc: string | null
  hl: (string | null)[]
  reveal: RevealRequest | null
  onOpen: (docId: string) => void
  onScan: (docId: string) => void // j/k — 흐름 칸 교체, 기록 덮어씀
  onHome: () => void
}

export function Sidebar(p: Props) {
  const { sidebar, ix } = p
  const { mode, isOverlay, width, setMode } = sidebar

  // 목록 상태 — '트리에서 보기'가 오면 (폰이 아니고) 전체로 연다
  const { list, bodyRef } = useSidebarList(ix, p.focusDoc, p.reveal, () => {
    if (!p.phone && mode !== 'full') setMode('full')
  })
  const [focusSearch, setFocusSearch] = useState(0)

  // 떠 있는 전체: Esc → 레일
  const overlayOpen = isOverlay && mode === 'full'
  useKeyDown((e) => {
    if (e.key === 'Escape') setMode('rail')
  }, overlayOpen)

  // j/k — 트리에서 지금 글 줄의 다음/이전 줄
  useKeyDown((e) => {
    if ((e.code !== 'KeyJ' && e.code !== 'KeyK') || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || !p.focusDoc) return
    const next = stepRow(ix, p.view, list.folds, p.focusDoc, e.code === 'KeyJ' ? 1 : -1)
    if (!next) return
    e.preventDefault()
    p.onScan(next)
  }, !!p.focusDoc)

  // 붙어 있는 가장자리 끌기 / 접혔을 때 당김 핸들 끌기 — 둘 다 놓으면 너비로 단계를 정한다
  const edgeDrag = useDrag(sidebar.commitDrag)
  const pullDrag = useDrag(sidebar.commitDrag, sidebar.restore)
  const rawWidth = edgeDrag.raw ?? pullDrag.raw
  const dragging = rawWidth !== null
  const shownMode: SidebarMode = rawWidth !== null ? snapMode(rawWidth) : mode
  const dockedMode: SidebarMode = isOverlay && shownMode === 'full' ? 'rail' : shownMode
  const fullWidth = rawWidth !== null ? clampFullWidth(rawWidth) : width
  const dockedWidth = dockedWidthOf(dockedMode, fullWidth)

  // 접히는 애니메이션이 끝날 때까지 마지막 내용을 남겨 둔다 (바로 내리면 빈 카드가 줄어든다)
  const lastVisibleRef = useRef<Exclude<SidebarMode, 'collapsed'>>(dockedMode === 'collapsed' ? 'rail' : dockedMode)
  if (dockedMode !== 'collapsed') lastVisibleRef.current = dockedMode
  const contentMode = lastVisibleRef.current
  const [mounted, setMounted] = useState(dockedMode !== 'collapsed')
  // 열고 닫히는 동안만 잘라낸다 — 늘 자르면 경계선에 걸친 끌기 손잡이 반쪽이 잘리고, 안 자르면 펼치는 동안 내용이 칸 위로 삐져나온다
  const [animating, setAnimating] = useState(false)
  const firstRunRef = useRef(true)
  useEffect(() => {
    if (dockedMode !== 'collapsed') setMounted(true)
    if (firstRunRef.current) {
      firstRunRef.current = false
      return
    }
    if (!dragging) setAnimating(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockedWidth])
  useEffect(() => {
    if (!dragging && dockedMode === 'collapsed' && !animating) setMounted(false)
  }, [dragging, dockedMode, animating])

  // 떠 있는 화면에서 글을 고르면 떠 있던 목록은 레일로
  const pick = (id: string) => {
    p.onOpen(id)
    if (overlayOpen) setMode('rail')
  }
  const home = () => {
    p.onHome()
    if (overlayOpen) setMode('rail')
  }
  const full = (
    <SidebarList
      ix={ix}
      view={p.view}
      focusDoc={p.focusDoc}
      hl={p.hl}
      list={list}
      bodyRef={bodyRef}
      phone={p.phone}
      focusSearch={focusSearch}
      onSearchFocused={() => setFocusSearch(0)}
      onClose={p.phone ? p.onDrawerClose : () => setMode('rail')}
      onPick={pick}
      onHome={home}
    />
  )

  // 폰: 서랍 — 사이드바+칸 묶음을 App이 옆으로 민다. 여기선 제 폭으로 전체 내용만
  if (p.phone) {
    return (
      <aside className="h-full shrink-0 border-r border-line" style={{ width: p.drawerWidth }} aria-label="사이드바" data-sidebar="drawer">
        <div className={styles.card}>{full}</div>
      </aside>
    )
  }

  return (
    <>
      {/* 바깥은 너비만 움직이고(0 ↔ 너비), 안쪽은 고정 너비 — 바뀌는 동안 내용이 찌그러지지 않는다 */}
      <m.div
        className="relative h-full shrink-0"
        initial={false}
        animate={{ width: dockedMode === 'collapsed' ? 0 : dockedWidth }}
        transition={dragging ? { duration: 0 } : QUICK}
        onAnimationComplete={() => {
          setAnimating(false)
          if (dockedMode === 'collapsed' && !dragging) setMounted(false)
        }}
        style={{ overflow: animating || dockedMode === 'collapsed' ? 'hidden' : 'visible' }}
      >
        {mounted && (
          <aside className="relative h-full" style={{ width: dockedWidthOf(contentMode, fullWidth) }} aria-label="사이드바" data-sidebar={contentMode}>
            <div className={styles.card}>
              {contentMode === 'full' && !overlayOpen ? (
                full
              ) : (
                <Rail
                  tab={list.tab}
                  onExpand={() => setMode('full')}
                  onHide={() => setMode('collapsed')}
                  onSearch={() => {
                    setFocusSearch((n) => n + 1)
                    setMode('full')
                  }}
                  onTab={(t) => {
                    list.setTab(t)
                    setMode('full')
                  }}
                />
              )}
            </div>
            {(dockedMode !== 'collapsed' || edgeDrag.dragging) && !isOverlay && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="사이드바 너비"
                aria-valuenow={dockedWidth}
                tabIndex={0}
                className={styles.handle}
                style={{ right: -HANDLE / 2, width: HANDLE }}
                data-tt={dragging ? undefined : '끌어서 너비 바꾸기 · 더블클릭 = 기본 너비'}
                onPointerDown={edgeDrag.start(dockedWidth)}
                {...edgeDrag.handlers}
                onDoubleClick={() => {
                  sidebar.commitWidth(FULL_DEFAULT)
                  setMode('full')
                }}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                  e.preventDefault()
                  sidebar.commitDrag(dockedWidth + (e.key === 'ArrowRight' ? 24 : -24))
                }}
              >
                <span className={dragging ? styles.handleLineActive : styles.handleLineIdle} />
              </div>
            )}
          </aside>
        )}
      </m.div>

      {mode === 'collapsed' && !edgeDrag.dragging && <PullHandle drag={pullDrag} onRestore={sidebar.restore} />}

      {/* 떠 있는 화면: 전체는 칸 위에 뜬다 */}
      <AnimatePresence>
        {overlayOpen && (
          <>
            <m.div
              key="backdrop"
              className="absolute inset-0 z-[100] bg-black/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={QUICK}
              onClick={() => setMode('rail')}
            />
            <m.aside
              key="panel"
              className="absolute inset-y-0 left-0 z-[100] max-w-[calc(100%-2rem)]"
              style={{ width }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={QUICK}
              aria-label="사이드바"
              data-sidebar="floating"
            >
              <div className={styles.cardFloating}>{full}</div>
            </m.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
