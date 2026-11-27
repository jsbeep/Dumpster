import { cx } from '@dumpster/blocks'
import type { GraphIndex, TreeRow } from '@dumpster/schema'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, CornerUpLeft } from 'lucide-react'
import { descendants, type LinkMark } from '../core/links'
import { shownTree } from '../core/treeRows'
import { collapseY } from '../ui/motion'
import { DocLink } from '../ui/DocLink'
import { dotClass, type DotShape, type DotState } from '../ui/dots'
import { activeOf, type View } from '../core/view'

// 컬렉션 트리 한 개 (design.md §3 "트리 표시") — 행 모양은 mongolive 사이드바 트리(DatabaseTree)
//   점 모양 = 글 종류 (일반 / 분기점 / 매니페스트), 칠·고리 = 어느 칸에 열려 있나 (11-27 초록 → 무채색 강조색)
//   흐름 글 = 꽉 찬 점 + 행 바탕 + 굵게, 펼친 탭 = 꽉 찬 점 + 고리 + `연관`, 띠에 있는 탭 = 고리만
//   점에 마우스를 올리면 범례 (TooltipLayer가 data-legend를 보고 ui/dots의 DotLegend를 띄운다)
//   흐름 글·펼친 탭 글의 조상 갈래는 접어 둬도 항상 펼친다
// 줄(git graph식)은 칸마다 16px — 세로줄·가로줄을 진짜 span으로 그린다
// 점의 속(속 빈 점)과 고리 틈은 --dot-bg = 그 행의 바탕색 (행 바탕이 바뀌면 같이 바뀐다 — 불투명 색만)

const styles = {
  row: 'group relative flex h-7 max-[720px]:h-9 items-center gap-0.5 rounded-md pr-1 text-[13px] transition-colors',
  rowIdle: '[--dot-bg:var(--side)] hover:bg-side-hover hover:[--dot-bg:var(--side-hover)]',
  rowSel: 'bg-selected [--dot-bg:rgb(var(--c-selected))]',
  rowHl: 'ring-[1.5px] ring-inset ring-accent-400',
  link: 'flex min-w-0 flex-1 items-stretch self-stretch pl-1',
  // 글자색·굵기는 셋 중 하나만 (cx는 겹치는 클래스를 정리하지 않는다 — 겹치면 CSS 순서로 엉뚱한 게 이김)
  title: 'min-w-0 flex-1 self-center truncate px-1.5',
  titleIdle: 'text-slate-600',
  titleSel: 'font-bold text-slate-900',
  titleAct: 'font-semibold text-slate-900',
  cell: 'relative w-4 shrink-0',
  v: 'absolute left-[7px] border-l-[1.5px] border-slate-300', // 세로줄
  h: 'absolute top-[calc(50%-0.75px)] border-t-[1.5px] border-slate-300', // 가로줄
  badge: 'shrink-0 whitespace-nowrap px-1 text-[11px] font-semibold text-slate-500',
  mark: 'grid h-5 w-5 shrink-0 place-items-center text-slate-500',
  from: 'flex max-w-[44%] items-center gap-1 overflow-hidden whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11.5px] text-slate-500 transition-colors hover:bg-hover hover:text-slate-900',
  fold: 'flex h-5 shrink-0 items-center gap-px rounded px-1 text-[11px] tabular-nums text-slate-400 transition-colors hover:bg-hover hover:text-slate-900',
  sep: 'mx-2 mb-1 mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400',
} as const

interface Props {
  ix: GraphIndex
  collectionId: string
  view: View
  marks: Map<string, LinkMark>
  hl: (string | null)[] // 파란 테두리: 본문 링크·띠에 마우스를 올린 글, 트리에서 보이기 한 글
  folds: string[] // 이 컬렉션에서 접은 분기점
  onFold: (docId: string) => void
  onOpen: (docId: string) => void
}

export function Tree({ ix, collectionId, view, marks, hl, folds, onFold, onOpen }: Props) {
  const cur = activeOf(view)
  const inTabs = new Set(view.tabs)
  const sel = view.main && ix.docsById.get(view.main)?.collectionId === collectionId ? view.main : null
  const { rows, orphans, folded, pinned } = shownTree(ix, collectionId, view, folds)

  const row = (r: TreeRow) => {
    const d = ix.docsById.get(r.docId)
    if (!d) return null
    const isSel = sel === r.docId
    const isAct = cur === r.docId
    const isFolded = folded.has(r.docId)
    const isHl = hl.includes(r.docId)
    const up = r.branch === 'none' && !r.root
    const down = r.forks > 0 && !isFolded
    const mk = marks.get(r.docId)
    const from = r.continuesFrom ? ix.docsById.get(r.continuesFrom) : undefined
    const fromCol = from && ix.collectionsById.get(from.collectionId)
    const shape: DotShape = d.kind === 'manifest' ? 'man' : r.forks > 1 ? 'fork' : 'idle'
    const state: DotState = isSel ? 'sel' : isAct ? 'act' : inTabs.has(r.docId) ? 'open' : ''
    return (
      <m.div key={r.docId} {...collapseY} className="overflow-hidden">
        <div
          className={cx(styles.row, isSel ? styles.rowSel : styles.rowIdle, isHl && styles.rowHl)}
          data-row={r.docId}
          data-sel={isSel || undefined}
          data-act={isAct || undefined}
          data-hl={isHl || undefined}
        >
          <DocLink id={r.docId} onGo={() => onOpen(r.docId)} className={styles.link}>
            <span className="flex shrink-0">
              {r.guides.map((g, i) => (
                <span key={i} className={styles.cell}>
                  {g && <span className={cx(styles.v, 'inset-y-0')} />}
                </span>
              ))}
              {r.branch !== 'none' && (
                <span className={styles.cell}>
                  <span className={cx(styles.v, 'top-0', r.branch === 'mid' ? 'bottom-0' : 'h-1/2')} />
                  <span className={cx(styles.h, 'left-[7px] right-0')} />
                </span>
              )}
              <span className={styles.cell} data-legend={`${shape} ${state}`.trim()} data-tt-align="left">
                {r.branch !== 'none' && <span className={cx(styles.h, 'left-0 w-2')} />}
                {(up || down) && <span className={cx(styles.v, up && down ? 'inset-y-0' : up ? 'top-0 h-1/2' : 'bottom-0 top-1/2')} />}
                <span data-dot={isSel || isAct ? 'sel' : inTabs.has(r.docId) ? 'open' : ''} className={dotClass(shape, state)} />
              </span>
            </span>
            <span className={cx(styles.title, isSel ? styles.titleSel : isAct ? styles.titleAct : styles.titleIdle)} data-row-title>
              {d.title}
            </span>
          </DocLink>
          {from && (
            <DocLink id={from.id} onGo={() => onOpen(from.id)} className={styles.from} data-tt={`${fromCol?.path.join(' › ') ?? ''} › ${from.title}에서 이어짐`}>
              <CornerUpLeft size={12} className="shrink-0" aria-hidden />
              <span className="truncate">{from.title}</span>
            </DocLink>
          )}
          {isAct && (
            <span className={styles.badge} data-badge data-tt="건너읽기 칸에 펼친 글">
              건너읽기
            </span>
          )}
          {mk?.in && (
            <span className={styles.mark} data-mark="in" data-tt="보고 있는 글을 가리키는 글">
              <ArrowDownLeft size={13} aria-hidden />
            </span>
          )}
          {mk?.out && (
            <span className={styles.mark} data-mark="out" data-tt="보고 있는 글이 가리키는 글">
              <ArrowUpRight size={13} aria-hidden />
            </span>
          )}
          {r.forks > 1 && !pinned.has(r.docId) && (
            <button
              type="button"
              className={styles.fold}
              onClick={() => onFold(r.docId)}
              aria-label={isFolded ? '갈래 펼치기' : '갈래 접기'}
              data-fold
              data-tt={isFolded ? '갈래 펼치기' : '갈래 접기'}
            >
              {isFolded && `+${descendants(ix, r.docId).length}`}
              {isFolded ? <ChevronRight size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
          )}
        </div>
      </m.div>
    )
  }

  return (
    <AnimatePresence initial={false}>
      {rows.map(row)}
      {orphans.length > 0 && (
        <div key="sep" className={styles.sep}>
          따로 읽는 글
          <span className="flex-1 border-t border-dashed border-line" />
        </div>
      )}
      {orphans.map(row)}
    </AnimatePresence>
  )
}
