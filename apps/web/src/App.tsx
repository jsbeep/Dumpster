import { AnimatePresence, LayoutGroup, LazyMotion, MotionConfig, domMax, m } from 'framer-motion'
import { useCallback, useEffect, useState, type MouseEvent, type PointerEvent } from 'react'
import { loadStore, type Store } from './data'
import { Home } from './Home'
import { Pane, type Zoom } from './Pane'
import { parseHash } from './route'
import { Sidebar, type RevealRequest } from './Sidebar'
import { FlowSpine, Stack } from './Strips'
import { TooltipLayer } from './TooltipLayer'
import { SPRING_SOFT } from './motion'
import { cn } from './ui'
import { useSidebar } from './useSidebar'
import { useView } from './useView'
import { activeOf } from './view'

// 탐색기 화면 = 사이드바 + 흐름 칸 + [왼쪽 띠] 연관 칸 [오른쪽 띠] (design.md §3 "칸")
// 겉모양·움직임은 mongolive를 잇는다: 그라데이션 바탕 위 카드(m-3), 사이드바 카드 | 틈 8px | 칸 영역 카드 안에 칸 카드들(p-3 gap-3)

export function App() {
  const [store, setStore] = useState<Store | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadStore().then(setStore, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  return (
    <LazyMotion features={domMax} strict>
      {/* 움직임 줄이기(OS 설정)면 위치·크기 애니메이션을 끈다 */}
      <MotionConfig reducedMotion="user">
        {store ? (
          <Explorer store={store} />
        ) : (
          <div className="flex h-full items-center justify-center font-sans">
            <p className={cn('text-[14px]', error ? 'text-rose-700' : 'text-slate-400')}>{error ?? '불러오는 중…'}</p>
          </div>
        )}
        <TooltipLayer />
      </MotionConfig>
    </LazyMotion>
  )
}

// 창 폭 구간 — 폭이 바뀔 때마다가 아니라 구간이 바뀔 때만 다시 그린다
function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const q = matchMedia(query)
    const h = () => setOn(q.matches)
    q.addEventListener('change', h)
    return () => q.removeEventListener('change', h)
  }, [query])
  return on
}

let revealN = 0

function Explorer({ store }: { store: Store }) {
  const ix = store.index
  const { view, slot, flash, pending, dir, dispatch, focusSlot } = useView(store)
  const phone = useMedia('(max-width: 720px)')
  const narrow = useMedia('(max-width: 1023px)') // mongolive와 같은 기준 — 사이드바 전체가 칸 위에 뜬다
  const twoPaneNarrow = useMedia('(max-width: 1099px)') // 칸이 둘이면 이보다 좁을 때도 뜬다 (design.md §3)
  const hasRel = view.tabs.length > 0
  const sidebar = useSidebar(narrow || (hasRel && !view.collapsed && twoPaneNarrow))
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

  // 트리에서 그 글 보이기 — 사이드바가 접혀 있으면 펼치고, 행을 잠깐 파란 테두리로
  const revealDoc = useCallback((id: string) => {
    setReveal({ id, n: ++revealN })
    setRowFlash(id)
  }, [])
  useEffect(() => {
    if (!rowFlash) return
    const t = setTimeout(() => setRowFlash(null), 1200)
    return () => clearTimeout(t)
  }, [rowFlash])

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [zoom])

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
  const paneProps = { store, view, phone, flash, pending, dispatch, onReveal: revealDoc, onZoom: setZoom }

  return (
    <div className="flex h-full flex-col font-sans text-slate-900 antialiased">
      <div className="relative m-3 flex min-h-0 flex-1">
        <Sidebar
          sidebar={sidebar}
          ix={ix}
          view={view}
          focusDoc={focusDoc}
          hl={[hover, rowFlash]}
          reveal={reveal}
          onOpen={(id) => dispatch({ type: 'open', id })}
          onHome={() => dispatch({ type: 'home' })}
        />
        <main
          className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-panel"
          onPointerDown={onPanesDown}
          onMouseOver={onPanesOver}
          onMouseLeave={() => setHover(null)}
        >
          <LayoutGroup>
            <div className="flex h-full w-full gap-3 overflow-hidden p-3" data-panes={hasRel ? 'two' : 'one'}>
              <AnimatePresence initial={false} mode="popLayout">
                {!view.main ? (
                  <Home key="home" ix={ix} z={Z.main} onOpen={(id) => dispatch({ type: 'open', id })} />
                ) : (
                  [
                    coll === 'main' && hasRel ? (
                      <FlowSpine key="spine" z={Z.main} title={ix.docsById.get(view.main)?.title ?? '없는 글'} dispatch={dispatch} />
                    ) : phone && hasRel ? null : (
                      <Pane key={`main:${view.main}`} slot="main" docId={view.main} dir={dir.main} z={Z.main} focused={slot === 'main'} {...paneProps} />
                    ),
                    leftTabs > 0 && <Stack key="stack-left" ix={ix} view={view} side="left" z={Z.left} phone={phone} dispatch={dispatch} />,
                    hasRel && active && coll !== 'rel' && (
                      <Pane key={`rel:${active}`} slot="rel" docId={active} dir={dir.rel} z={Z.rel} focused={slot === 'rel'} {...paneProps} />
                    ),
                    rightTabs > 0 && <Stack key="stack-right" ix={ix} view={view} side="right" z={Z.right} phone={phone} dispatch={dispatch} />,
                  ]
                )}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </main>
      </div>

      {/* 그림 크게 — 화면에 맞춰 키움 (작은 그림도 본문보다 크게). 누르기·Esc로 닫음 */}
      <AnimatePresence>
        {zoom && (
          <m.div
            className="fixed inset-0 z-[200] flex cursor-zoom-out flex-col items-center justify-center gap-2.5 bg-black/80 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoom(null)}
            role="dialog"
            aria-label="그림 크게 보기"
            data-zoom
          >
            <m.img
              src={zoom.src}
              alt={zoom.alt}
              className="min-h-0 w-full flex-1 basis-0 object-contain"
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              transition={SPRING_SOFT}
            />
            {zoom.alt && !zoom.alt.startsWith('Pasted image') && <p className="text-center text-[13px] text-neutral-200">{zoom.alt}</p>}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
