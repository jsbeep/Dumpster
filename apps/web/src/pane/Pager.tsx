import { cx } from '@dumpster/blocks'
import type { Doc, GraphIndex } from '@dumpster/schema'
import { ArrowLeft, ArrowRight, GitBranch } from 'lucide-react'
import type { ReactNode } from 'react'
import { branchInfo } from '../core/links'
import type { Action, Slot } from '../core/view'
import { DocLink } from '../ui/DocLink'

// 이전/다음 — 지금 칸 안에서 (흐름 칸이면 흐름 글, 연관 칸이면 펼친 탭만 바뀜). 다음 글이 여럿이면 갈래 목록

const pg = {
  card: 'flex min-w-0 flex-col gap-1 rounded-lg border border-line px-4 py-3 transition-colors hover:border-slate-300 hover:bg-hover',
  k: 'flex items-center gap-1.5 text-[12.5px] text-slate-500',
  t: 'line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900',
  xc: 'w-fit whitespace-nowrap text-[11.5px] text-slate-400', // 다른 컬렉션 — 알약 대신 흐린 글자
} as const

export function Pager({ ix, doc, slot, dispatch }: { ix: GraphIndex; doc: Doc; slot: Slot; dispatch: (action: Action) => void }) {
  const prevId = ix.prevOf.get(doc.id)
  const prev = prevId ? ix.docsById.get(prevId) : undefined
  const nexts = ix.nextOf.get(doc.id) ?? []
  if (!prev && !nexts.length) return null
  const step = (id: string) => () => dispatch({ type: 'step', slot, id })
  const colTitle = (cid: string) => ix.collectionsById.get(cid)?.title

  let right: ReactNode = null
  if (nexts.length === 1) {
    const nx = nexts[0]
    right = (
      <DocLink id={nx.id} onGo={step(nx.id)} className={cx(pg.card, 'items-end text-right')} data-pg="next">
        <span className={pg.k}>
          다음
          <ArrowRight size={14} aria-hidden />
        </span>
        <span className={pg.t}>{nx.title}</span>
        {nx.collectionId !== doc.collectionId && <span className={pg.xc}>{colTitle(nx.collectionId)}로 넘어감</span>}
      </DocLink>
    )
  } else if (nexts.length > 1) {
    right = (
      <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line px-2 pb-2 pt-2.5">
        <span className={cx(pg.k, 'justify-end px-2 pb-1')}>
          다음 · 갈래 {nexts.length}
          <GitBranch size={14} aria-hidden />
        </span>
        {nexts.map((nx, k) => {
          const cross = nx.collectionId !== doc.collectionId
          const info = cross ? null : branchInfo(ix, nx.id)
          return (
            <DocLink key={nx.id} id={nx.id} onGo={step(nx.id)} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-hover" data-pg="branch">
              <span className="shrink-0 font-mono text-[13px] leading-none text-slate-400">{k < nexts.length - 1 ? '├' : '└'}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-900" data-pg-title>
                {nx.title}
              </span>
              {info ? (
                <>
                  <span className="whitespace-nowrap text-[12px] tabular-nums text-slate-400">
                    {info.count}편{info.forks > 0 && ` · 분기 ${info.forks}`}
                  </span>
                  {info.exits.map((x) => (
                    <span key={x} className={pg.xc}>
                      → {colTitle(x)}
                    </span>
                  ))}
                </>
              ) : (
                <span className={pg.xc}>{colTitle(nx.collectionId)}로 넘어감</span>
              )}
            </DocLink>
          )
        })}
      </div>
    )
  } else if (prev) {
    right = <span className="flex items-center justify-center rounded-lg border border-dashed border-line px-4 py-3 text-[13px] text-slate-400">이 갈래의 마지막 글</span>
  }

  return (
    <nav className="grid grid-cols-1 items-start gap-3 @[470px]:grid-cols-[repeat(2,minmax(0,360px))] @[470px]:justify-between" aria-label="이전·다음 글">
      {prev ? (
        <DocLink id={prev.id} onGo={step(prev.id)} className={pg.card} data-pg="prev">
          <span className={pg.k}>
            <ArrowLeft size={14} aria-hidden />
            이전
          </span>
          <span className={pg.t}>{prev.title}</span>
          {prev.collectionId !== doc.collectionId && <span className={pg.xc}>{colTitle(prev.collectionId)}</span>}
        </DocLink>
      ) : (
        <span className="hidden @[470px]:block" />
      )}
      {right}
    </nav>
  )
}
