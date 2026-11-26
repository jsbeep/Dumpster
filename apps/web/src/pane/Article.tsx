import { BlockRenderer, cx } from '@dumpster/blocks'
import type { Doc, GraphIndex } from '@dumpster/schema'
import { ArrowDownLeft, ArrowUpRight, CornerUpLeft } from 'lucide-react'
import { useCallback, type RefObject } from 'react'
import { backlinks, outLinks } from '../core/links'
import type { Action, Slot, View } from '../core/view'
import type { Zoom } from '../Lightbox'
import { DocLink } from '../ui/DocLink'
import { ymd } from '../ui/format'
import { Crumbs } from './Crumbs'
import { Links } from './Links'
import { Pager } from './Pager'
import { frame } from './styles'

// 칸 본문: 컬렉션 이름(→ 트리에서 보기, 트리가 안 보이면 브레드크럼 — Crumbs) · 이어진 곳 · 제목 · 날짜·태그·↙↗ 개수 · 블록 · 이전/다음 카드 · 연결 목록

const styles = {
  cfrom: 'mt-1.5 flex w-fit max-w-full items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12.5px] text-slate-500 transition-colors hover:text-slate-900',
  title: 'mt-2 text-[24px] font-bold leading-[1.3] tracking-[-0.02em] text-slate-900 [text-wrap:balance] @[560px]:text-[28px]',
  meta: 'mb-[26px] mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] tabular-nums text-slate-500',
  // ↙↗ 개수 — 알약 대신 글자 + 아이콘
  count: 'inline-flex items-center gap-0.5 rounded px-1 -mx-1 font-medium text-slate-500 transition-colors hover:bg-hover hover:text-slate-900',
  gone: 'm-auto p-6 text-center text-[14px] text-slate-500',
} as const

interface Props {
  ix: GraphIndex
  doc: Doc
  slot: Slot
  view: View
  crumbs: boolean // 사이드바 트리가 화면에 없음 → 맨 위 줄을 브레드크럼으로
  articleRef: RefObject<HTMLElement> // 칸 폭 따라가기(useWidthFollow)·찾기가 재는 본문
  dispatch: (action: Action, anchor?: string) => void
  onJump: (anchor: string) => void // 이 칸 안의 그 id까지 스크롤
  onReveal: (docId: string) => void
  onZoom: (z: Zoom) => void
}

export function Article({ ix, doc, slot, view, crumbs, articleRef, dispatch, onJump, onReveal, onZoom }: Props) {
  const onOpenDoc = useCallback((id: string, heading?: string) => dispatch({ type: 'link', id }, heading), [dispatch])
  const prevId = ix.prevOf.get(doc.id)
  const prev = prevId ? ix.docsById.get(prevId) : undefined
  const crossPrev = prev && prev.collectionId !== doc.collectionId ? prev : undefined
  const bl = backlinks(ix, doc.id)
  const ol = outLinks(ix, doc.id)

  return (
    <article
      ref={articleRef}
      className={cx(frame.page, '[&_figure_img]:cursor-zoom-in')}
      onClick={(e) => {
        // 본문 그림 누르면 크게 (북마크 카드 그림은 링크라 제외)
        const img = (e.target as HTMLElement).closest('img')
        if (img && img.closest('figure') && !img.closest('a')) onZoom({ src: img.currentSrc || img.src, alt: img.alt })
      }}
    >
      <Crumbs ix={ix} doc={doc} trail={crumbs} onReveal={onReveal} onStep={(id) => dispatch({ type: 'step', slot, id })} />
      {crossPrev && (
        <DocLink id={crossPrev.id} onGo={() => dispatch({ type: 'step', slot, id: crossPrev.id })} className={styles.cfrom} data-cfrom data-nofind>
          <CornerUpLeft size={13} className="shrink-0" aria-hidden />
          <span className="truncate">
            <b className="font-semibold text-slate-700">
              {ix.collectionsById.get(crossPrev.collectionId)?.title} › {crossPrev.title}
            </b>
            에서 이어짐
          </span>
        </DocLink>
      )}
      <h1 className={styles.title} data-title>
        {doc.title}
      </h1>
      <div className={styles.meta} data-nofind>
        <span>{ymd(doc.createdAt)}</span>
        {doc.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
        {bl.length > 0 && (
          <button type="button" className={styles.count} onClick={() => onJump(`links-in-${slot}`)} data-tt={`이 글을 가리키는 글 ${bl.length}개`} data-count="in">
            <ArrowDownLeft size={14} aria-hidden />
            {bl.length}
          </button>
        )}
        {ol.length > 0 && (
          <button type="button" className={styles.count} onClick={() => onJump(`links-out-${slot}`)} data-tt={`이 글이 가리키는 글 ${ol.length}개`} data-count="out">
            <ArrowUpRight size={14} aria-hidden />
            {ol.length}
          </button>
        )}
      </div>
      <BlockRenderer blocks={doc.blocks} onOpenDoc={onOpenDoc} />
      <footer className="mt-11 flex flex-col gap-7 border-t border-line pt-6">
        <Pager ix={ix} doc={doc} slot={slot} dispatch={dispatch} />
        <Links ix={ix} doc={doc} slot={slot} view={view} dispatch={dispatch} />
      </footer>
    </article>
  )
}

// 지워졌거나 공개를 내린 글 (주소로 바로 들어왔을 때 등)
export function Gone() {
  return (
    <p className={styles.gone}>
      <b className="mb-1.5 block text-[18px] text-slate-900" data-title>
        없는 글
      </b>
      지워졌거나 공개를 내린 글이에요.
    </p>
  )
}
