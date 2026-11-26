import type { GraphIndex, TreeRow } from '@dumpster/schema'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, CornerUpLeft } from 'lucide-react'
import { descendants, type LinkMark } from './links'
import { collapseY } from './motion'
import { cn, DocLink } from './ui'
import { activeOf, type View } from './view'

// 컬렉션 트리 한 개 (design.md §3 "트리 표시") — 행 모양은 mongolive 사이드바 트리(DatabaseTree)
//   점 모양 = 글 종류 (일반 / 분기점 / 매니페스트), 색·테두리 = 어느 칸에 열려 있나
//   흐름 글 = 꽉 찬 초록 + 행 바탕, 펼친 탭 = 꽉 찬 초록 + 큰 테두리 + `연관` 배지, 띠에 있는 탭 = 큰 테두리만
//   흐름 글·펼친 탭 글의 조상 갈래는 접어 둬도 항상 펼친다
// 줄(git graph식)은 칸마다 16px — 세로줄·가로줄을 진짜 span으로 그린다

const styles = {
  row: 'group relative flex h-7 items-center gap-0.5 rounded-md pr-1 text-[13px] transition-colors',
  rowIdle: 'hover:bg-slate-100',
  rowSel: 'bg-selected',
  rowHl: 'ring-[1.5px] ring-inset ring-sky-600',
  link: 'flex min-w-0 flex-1 items-stretch self-stretch pl-1',
  // 글자색·굵기는 셋 중 하나만 (cn은 겹치는 클래스를 정리하지 않는다 — 겹치면 CSS 순서로 엉뚱한 게 이김)
  title: 'min-w-0 flex-1 self-center truncate px-1.5',
  titleIdle: 'text-slate-600',
  titleSel: 'font-medium text-emerald-700',
  titleAct: 'font-semibold text-slate-900',
  cell: 'relative w-4 shrink-0',
  v: 'absolute left-[7px] border-l-[1.5px] border-slate-300', // 세로줄
  h: 'absolute top-[calc(50%-0.75px)] border-t-[1.5px] border-slate-300', // 가로줄
  // 점: 모양(원/둥근 네모) · 칠(속 빈/꽉 찬 초록/진회색) · 고리를 각각 하나씩만 고른다
  dot: 'absolute left-[3.25px] top-[calc(50%-4.75px)] z-[1] h-[9.5px] w-[9.5px] border-2',
  dotRound: 'rounded-full',
  dotSquare: 'rounded-[3px]', // 매니페스트
  fillIdle: 'border-slate-400 bg-white',
  fillFork: 'border-slate-700 bg-white', // 분기점
  fillMan: 'border-slate-700 bg-slate-700',
  fillSel: 'border-emerald-600 bg-emerald-600', // 흐름 글 · 펼친 탭
  // 탭에 있는 글 = 초록 고리 (사이드바 카드 바탕색 틈 1.5px + 고리 1.5px)
  dotOpen: 'shadow-[0_0_0_1.5px_rgb(var(--c-white)),0_0_0_3px_rgb(var(--c-emerald-600))]',
  badge: 'shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-1.5 text-[11px] font-semibold text-emerald-700',
  mark: 'grid h-5 w-5 shrink-0 place-items-center rounded-md',
  markIn: 'bg-sky-50 text-sky-700',
  markOut: 'bg-amber-50 text-amber-700',
  from: 'flex max-w-[44%] items-center gap-1 overflow-hidden whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11.5px] text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-700',
  fold: 'flex h-5 shrink-0 items-center gap-px rounded px-1 text-[11px] tabular-nums text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700',
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
  const tree = ix.tree(collectionId)
  const cur = activeOf(view)
  const inTabs = new Set(view.tabs)
  const sel = view.main && ix.docsById.get(view.main)?.collectionId === collectionId ? view.main : null

  const anc = new Set<string>()
  for (const id of [view.main, cur]) {
    if (id && ix.docsById.get(id)?.collectionId === collectionId) for (const a of ix.ancestors(id)) anc.add(a)
  }
  const collapsed = new Set(folds.filter((x) => !anc.has(x)))
  const hidden = new Set([...collapsed].flatMap((x) => descendants(ix, x)))

  const row = (r: TreeRow) => {
    const d = ix.docsById.get(r.docId)
    if (!d) return null
    const isSel = sel === r.docId
    const isAct = cur === r.docId
    const isFolded = collapsed.has(r.docId)
    const isHl = hl.includes(r.docId)
    const up = r.branch === 'none' && !r.root
    const down = r.forks > 0 && !isFolded
    const mk = marks.get(r.docId)
    const from = r.continuesFrom ? ix.docsById.get(r.continuesFrom) : undefined
    const fromCol = from && ix.collectionsById.get(from.collectionId)
    return (
      <m.div key={r.docId} {...collapseY} className="overflow-hidden">
        <div
          className={cn(styles.row, isSel ? styles.rowSel : styles.rowIdle, isHl && styles.rowHl)}
          data-row={r.docId}
          data-sel={isSel || undefined}
          data-act={isAct || undefined}
          data-hl={isHl || undefined}
        >
          <DocLink id={r.docId} onGo={() => onOpen(r.docId)} className={styles.link}>
            <span className="flex shrink-0">
              {r.guides.map((g, i) => (
                <span key={i} className={styles.cell}>
                  {g && <span className={cn(styles.v, 'inset-y-0')} />}
                </span>
              ))}
              {r.branch !== 'none' && (
                <span className={styles.cell}>
                  <span className={cn(styles.v, 'top-0', r.branch === 'mid' ? 'bottom-0' : 'h-1/2')} />
                  <span className={cn(styles.h, 'left-[7px] right-0')} />
                </span>
              )}
              <span className={styles.cell}>
                {r.branch !== 'none' && <span className={cn(styles.h, 'left-0 w-2')} />}
                {(up || down) && <span className={cn(styles.v, up && down ? 'inset-y-0' : up ? 'top-0 h-1/2' : 'bottom-0 top-1/2')} />}
                <span
                  data-dot={isSel || isAct ? 'sel' : inTabs.has(r.docId) ? 'open' : ''}
                  className={cn(
                    styles.dot,
                    d.kind === 'manifest' ? styles.dotSquare : styles.dotRound,
                    isSel || isAct ? styles.fillSel : d.kind === 'manifest' ? styles.fillMan : r.forks > 1 ? styles.fillFork : styles.fillIdle,
                    inTabs.has(r.docId) && styles.dotOpen,
                  )}
                />
              </span>
            </span>
            <span className={cn(styles.title, isSel ? styles.titleSel : isAct ? styles.titleAct : styles.titleIdle)} data-row-title>
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
            <span className={styles.badge} data-badge data-tt="연관 칸에 펼친 글">
              연관
            </span>
          )}
          {mk?.in && (
            <span className={cn(styles.mark, styles.markIn)} data-mark="in" data-tt="보고 있는 글을 가리키는 글">
              <ArrowDownLeft size={13} aria-hidden />
            </span>
          )}
          {mk?.out && (
            <span className={cn(styles.mark, styles.markOut)} data-mark="out" data-tt="보고 있는 글이 가리키는 글">
              <ArrowUpRight size={13} aria-hidden />
            </span>
          )}
          {r.forks > 1 && !anc.has(r.docId) && (
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

  const orphans = tree.orphans.filter((r) => !hidden.has(r.docId))
  return (
    <AnimatePresence initial={false}>
      {tree.rows.filter((r) => !hidden.has(r.docId)).map(row)}
      {orphans.length > 0 && (
        <div key="sep" className={styles.sep}>
          따로 읽는 글
          <span className="flex-1 border-t border-dashed border-slate-200" />
        </div>
      )}
      {orphans.map(row)}
    </AnimatePresence>
  )
}
