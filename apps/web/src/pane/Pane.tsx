import { cx, type BlockOf } from '@dumpster/blocks'
import { m } from 'framer-motion'
import { forwardRef, useRef } from 'react'
import type { Store } from '../core/data'
import type { Action, Slot, View } from '../core/view'
import type { PendingHeading, Pulse } from '../hooks/useView'
import { paneVariants, QUICK } from '../ui/motion'
import { PresenceBoundary } from '../ui/PresenceBoundary'
import type { Zoom } from '../Lightbox'
import { Article, Gone } from './Article'
import { FindBar, useFind } from './Find'
import { PaneHeader } from './PaneHeader'
import { frame } from './styles'
import { Toc } from './Toc'
import { useDoc } from './useDoc'
import { scrollToAnchor, useHeadingJump, useScrollMemory, useScrollSpy } from './useScroll'
import { useWidthFollow } from './useWidthFollow'

// 칸 하나 — 흐름 칸이든 연관 칸이든 같은 모양 (design.md §3 "칸"). 여기선 조립만 한다:
//   머리 PaneHeader · 찾기 줄(열었을 때) FindBar · 본문 Article(없으면 Gone) · 오른쪽 위 목차 Toc · 반짝(flash)
//   글 불러오기 useDoc · 읽던 자리·읽는 위치·헤딩 이동 useScroll · 칸 폭 바뀔 때 본문 따라가기 useWidthFollow
// 칸 자체가 AnimatePresence의 직접 자식이라 ref를 넘긴다 (popLayout이 재야 함)

interface Props {
  store: Store
  slot: Slot
  docId: string
  view: View
  dir: number // 들어오는 방향 (motion custom)
  half: boolean // 두 칸일 때 흐름 칸 — 폭을 반으로 묶는다
  onMenu?: () => void // 폰: 머리 왼쪽 ☰ → 사이드바가 칸을 밀며 나온다
  z: number // 왼쪽 칸일수록 위 (mongolive 밀러 컬럼 99 - 순서) — 들어오는 칸이 흐름 칸 밑에서 빠져나온다
  phone: boolean
  crumbs: boolean // 사이드바 트리가 화면에 없음 (폰·좁은 창·접은 사이드바) → 본문 맨 위를 브레드크럼으로
  focused: boolean // 지금 보는 칸 — 칸이 둘일 때 "흐름"/"연관" 글자가 진하게
  flash: Pulse | null
  pending: PendingHeading | null
  dispatch: (action: Action, anchor?: string) => void
  onReveal: (docId: string) => void
  onZoom: (z: Zoom) => void
}

export const Pane = forwardRef<HTMLElement, Props>(function Pane(p, ref) {
  const { store, slot, view, dispatch } = p
  const ix = store.index
  const doc = useDoc(store, p.docId)
  const meta = ix.docsById.get(p.docId)
  const title = doc?.title ?? meta?.title ?? ''
  const heads = (doc?.blocks.filter((b) => b.type === 'heading') ?? []) as BlockOf<'heading'>[]
  const hasRel = view.tabs.length > 0

  const scrollRef = useRef<HTMLDivElement>(null)
  const { spy, onScroll: spyScroll } = useScrollSpy(scrollRef, heads)
  const keep = useScrollMemory(scrollRef, p.docId, !!doc)
  const onScroll = () => {
    spyScroll()
    keep()
  }
  useHeadingJump(scrollRef, p.pending, slot, doc)
  const jump = (anchor: string) => scrollToAnchor(scrollRef.current, anchor)
  const find = useFind(p.focused, !!doc)
  const { setCard, innerRef, articleRef, unfreeze } = useWidthFollow(ref)

  return (
    <m.section
      ref={setCard}
      onLayoutAnimationComplete={unfreeze}
      custom={p.dir}
      variants={paneVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={QUICK}
      layout
      style={{ zIndex: p.z }}
      className={cx(frame.card, p.half ? frame.half : frame.grow, !p.phone && frame.edge)}
      data-slot={slot}
      data-focus={(p.focused && hasRel) || undefined}
      aria-label={`${slot === 'main' ? '흐름' : '연관'}: ${title}`}
    >
      {/* 안쪽 motion 요소가 칸의 퇴장을 붙잡지 않게 — 본문은 열린 뒤에 도착한다 (PresenceBoundary 설명) */}
      <PresenceBoundary>
        {/* 칸 크기가 바뀌는 동안(layout) 카드는 transform으로 늘고 준다 — 안쪽은 layout="position"이라
            framer가 반대로 보정해서 글자가 늘어나 보이지 않는다. 안쪽은 바로 새 폭으로 그려지고 카드가 잘라 보여 준다 */}
        {/* 안쪽 감싸개도 칸과 같은 움직임 값 — 따로 두면 framer 기본(0.45초)으로 돌아, 칸 왼쪽 끝이 옮겨 갈 때(연관 칸)
            칸이 멈춘 뒤에도 본문이 미끄러졌다 */}
        <m.div ref={innerRef} layout="position" transition={QUICK} className="flex min-h-0 flex-1 flex-col">
          <PaneHeader
            ix={ix}
            view={view}
            slot={slot}
            docId={p.docId}
            title={title}
            showTitle={spy.title}
            canFind={!!doc}
            phone={p.phone}
            focused={p.focused}
            onMenu={p.onMenu}
            onFind={find.open}
            onReveal={p.onReveal}
            dispatch={dispatch}
          />
          {find.n > 0 && doc && <FindBar slot={slot} rootRef={articleRef} scrollRef={scrollRef} ready={doc} focusN={find.n} onClose={find.close} />}
          <div className="relative flex min-h-0 flex-1">
            <div className={frame.scroll} ref={scrollRef} onScroll={onScroll} data-scroll>
              {doc ? (
                <Article ix={ix} doc={doc} slot={slot} view={view} crumbs={p.crumbs} articleRef={articleRef} dispatch={dispatch} onJump={jump} onReveal={p.onReveal} onZoom={p.onZoom} />
              ) : doc === null || !meta ? (
                <Gone />
              ) : null}
            </div>
            {heads.length >= 2 && <Toc heads={heads} current={spy.heading} onGo={jump} />}
          </div>
        </m.div>
        {p.flash?.slot === slot && (
          <m.div
            key={p.flash.n}
            className="pointer-events-none absolute inset-0 z-20 ring-2 ring-inset ring-accent-500"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 1, times: [0, 0.4, 1] }}
            data-flash
          />
        )}
      </PresenceBoundary>
    </m.section>
  )
})
