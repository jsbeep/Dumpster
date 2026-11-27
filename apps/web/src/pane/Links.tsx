import { cx } from '@dumpster/blocks'
import type { Doc, GraphIndex } from '@dumpster/schema'
import { ArrowDownLeft, ArrowUpRight, Link2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { backlinks, outLinks, sameCollection, seeAlso } from '../core/links'
import { activeOf, type Action, type Slot, type View } from '../core/view'
import type { Land } from '../hooks/useView'
import { DocLink } from '../ui/DocLink'

// 글 끝 연결 목록 — 어느 칸에서 눌러도 연관 칸 새 탭. 없는 글(비공개 포함)은 원문 이름만 회색으로
// '이 글을 가리키는 글'은 열린 글에서 이 글을 가리키는 블록까지 스크롤 + 잠깐 칠함 (useScroll useLanding · linkTo)
// 묶음 헤딩 id(links-in/out/sa-{slot})는 본문 위 ↙↗ 개수 버튼이 스크롤해 오는 자리

const rr = {
  row: 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5',
  live: 'transition-colors hover:bg-hover',
  dead: 'cursor-not-allowed',
  t: 'min-w-0 flex-1 truncate text-[14.5px]',
  m: 'whitespace-nowrap text-[12px] text-slate-400',
} as const

export function Links({ ix, doc, slot, view, dispatch }: { ix: GraphIndex; doc: Doc; slot: Slot; view: View; dispatch: (action: Action, land?: Land) => void }) {
  const cur = activeOf(view)
  const bl = backlinks(ix, doc.id)
  const ol = outLinks(ix, doc.id)
  const sa = seeAlso(ix, doc.id)
  if (!bl.length && !ol.length && !sa.length) return null

  const where = (id: string) =>
    id === view.main ? (slot === 'rel' ? '이어읽는 글' : '') : id === cur ? (slot === 'main' ? '건너읽는 글' : '') : view.tabs.includes(id) ? '접힌 글' : ''
  const row = (id: string, land?: Land) => {
    const d = ix.docsById.get(id)
    if (!d) return null
    const w = where(id)
    return (
      <DocLink key={id} id={id} onGo={() => dispatch({ type: 'link', id }, land)} className={cx(rr.row, rr.live)} data-rr>
        <span className={cx(rr.t, 'text-slate-900')}>{d.title}</span>
        {w && <span className="whitespace-nowrap text-[12px] font-medium text-slate-500">{w}</span>}
        {!sameCollection(ix, id, doc.id) && <span className={rr.m}>{ix.collectionsById.get(d.collectionId)?.title}</span>}
      </DocLink>
    )
  }
  const edgeRow = (e: { target: string | null; targetLabel: string }) =>
    e.target && ix.docsById.has(e.target) ? (
      row(e.target)
    ) : (
      <span key={`?${e.targetLabel}`} className={cx(rr.row, rr.dead)} data-tt="없는 글" data-dead>
        <span className={cx(rr.t, 'text-slate-400')}>{e.targetLabel}</span>
        <span className={rr.m}>없는 글</span>
      </span>
    )
  const group = (id: string, icon: ReactNode, h: string, count: number, body: ReactNode) => (
    <div>
      <h3 id={id} className="mb-1 flex scroll-mt-3 items-center gap-1.5 text-[12.5px] font-semibold text-slate-500">
        {icon}
        {h} <span className="font-medium tabular-nums text-slate-400">{count}</span>
      </h3>
      {body}
    </div>
  )
  return (
    <section className="flex flex-col gap-[18px]" data-links>
      {bl.length > 0 && group(`links-in-${slot}`, <ArrowDownLeft size={13} aria-hidden />, '이 글을 가리키는 글', bl.length, bl.map((id) => row(id, { linkTo: doc.id })))}
      {ol.length > 0 && group(`links-out-${slot}`, <ArrowUpRight size={13} aria-hidden />, '이 글이 가리키는 글', ol.length, ol.map(edgeRow))}
      {sa.length > 0 && group(`links-sa-${slot}`, <Link2 size={13} aria-hidden />, '함께 볼 글', sa.length, sa.map(edgeRow))}
    </section>
  )
}
