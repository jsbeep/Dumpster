import { BlockRenderer, type BlockOf } from '@dumpster/blocks'
import type { Doc, GraphIndex } from '@dumpster/schema'
import { AnimatePresence, m } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  CornerUpLeft,
  Folder,
  GitBranch,
  Link2,
  PanelLeftClose,
  PanelRightClose,
  SquareArrowUpRight,
  X,
} from 'lucide-react'
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Store } from './data'
import { backlinks, branchInfo, outLinks, sameCollection, seeAlso } from './links'
import { paneVariants, popIn, SPRING_COLUMN } from './motion'
import { PresenceBoundary } from './PresenceBoundary'
import { cn, DocLink, ymd } from './ui'
import type { PendingHeading, Pulse } from './useView'
import { activeOf, type Action, type Slot, type View } from './view'

// 칸 하나 — 흐름 칸이든 연관 칸이든 같은 모양 (design.md §3 "칸"). 카드·머리 모양은 mongolive 밀러 컬럼
//   머리: [‹ 폰 뒤로] 흐름|연관 n/m [바로가기] (스크롤하면 제목) [모두 닫기] [접기] [×]
//   본문: 컬렉션 이름(→ 트리에서 보기) · 이어진 곳 · 제목 · 날짜·태그·↙↗ 개수 · 블록 · 이전/다음 카드 · 연결 목록
//   오른쪽 위: 목차 줄 → 마우스를 올리면(폰은 누르면) 목록
// 칸 자체가 AnimatePresence의 직접 자식이라 ref를 넘긴다 (popLayout이 재야 함)

export const styles = {
  card: 'relative flex min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-panel @container',
  header: 'flex h-11 shrink-0 items-center gap-0.5 border-b border-slate-100 px-2',
  lane: 'shrink-0 whitespace-nowrap px-1.5 text-[11.5px] font-semibold text-slate-400',
  laneFocus: 'text-emerald-700',
  iconBtn: 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700',
  textBtn: 'h-7 shrink-0 whitespace-nowrap rounded-md px-2 text-[12px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700',
  headTitle: 'min-w-0 flex-1 truncate px-1.5 text-[13px] font-semibold text-slate-700',
  back: 'flex h-7 max-w-[46%] shrink-0 items-center gap-1 rounded-md pl-1 pr-2 text-[12.5px] text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  scroll: 'relative min-h-0 flex-1 overflow-y-auto overscroll-contain',
  page: 'mx-auto max-w-[760px] pb-16 pl-[22px] pr-10 @[560px]:px-11 @[560px]:pb-[72px]',
  kick: '-ml-1.5 mt-3.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12.5px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700',
  cfrom: 'mt-1.5 flex w-fit max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[12.5px] text-slate-500 transition-colors hover:text-slate-700',
  title: 'mt-2 text-[24px] font-bold leading-[1.3] tracking-[-0.02em] text-slate-900 [text-wrap:balance] @[560px]:text-[28px]',
  meta: 'mb-[26px] mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] tabular-nums text-slate-500',
  chip: 'inline-flex h-6 items-center gap-1 rounded-full pl-[7px] pr-[9px] text-[12px] font-semibold',
  gone: 'm-auto p-6 text-center text-[14px] text-slate-500',
} as const

export interface Zoom {
  src: string
  alt: string
}

interface Props {
  store: Store
  slot: Slot
  docId: string
  view: View
  dir: number // 들어오는 방향 (motion custom)
  phone: boolean
  focused: boolean // 지금 보는 칸 — 칸이 둘일 때 "흐름"/"연관" 글자가 초록
  flash: Pulse | null
  pending: PendingHeading | null
  dispatch: (action: Action, anchor?: string) => void
  onReveal: (docId: string) => void
  onZoom: (z: Zoom) => void
}

// 본문은 getDoc(async)으로만 — graph.json을 글마다 나누게 돼도 화면은 그대로 (design.md 11-26)
function useDoc(store: Store, id: string): Doc | null | undefined {
  const [doc, setDoc] = useState<Doc | null | undefined>(undefined) // undefined = 받는 중
  useEffect(() => {
    let alive = true
    store.getDoc(id).then((d) => alive && setDoc(d))
    return () => {
      alive = false
    }
  }, [store, id])
  return doc
}

const SPY_TOP = 48 // 칸 위에서 이만큼 안에 들어온 헤딩 = 지금 읽는 곳

function scrollToEl(el: Element) {
  const sc = el.closest('[data-scroll]')
  if (!sc) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  sc.scrollTo({
    top: el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 12,
    behavior: reduced ? 'auto' : 'smooth',
  })
}

export const Pane = forwardRef<HTMLElement, Props>(function Pane(p, ref) {
  const { store, slot, view, dispatch } = p
  const ix = store.index
  const doc = useDoc(store, p.docId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [spy, setSpy] = useState<{ heading: string | null; title: boolean }>({ heading: null, title: false })
  const handled = useRef(0)

  const heads = (doc?.blocks.filter((b) => b.type === 'heading') ?? []) as BlockOf<'heading'>[]

  // 읽는 위치 → 목차 줄·칸 위 제목
  const raf = useRef(0)
  const onScroll = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const sc = scrollRef.current
      if (!sc) return
      const top = sc.getBoundingClientRect().top
      let heading: string | null = null
      for (const h of heads) {
        const el = sc.querySelector(`#${CSS.escape(h.anchor)}`)
        if (el && el.getBoundingClientRect().top - top <= SPY_TOP) heading = h.anchor
      }
      const t = sc.querySelector<HTMLElement>('[data-title]')
      const title = !!t && sc.scrollTop > t.offsetTop + t.offsetHeight - 8
      setSpy((s) => (s.heading === heading && s.title === title ? s : { heading, title }))
    })
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // 헤딩 링크([[글#헤딩]]) → 이 칸에 놓였으면 그 헤딩까지
  useEffect(() => {
    const pend = p.pending
    if (!pend || pend.slot !== slot || !doc || handled.current === pend.n) return
    handled.current = pend.n
    const el = scrollRef.current?.querySelector(`#${CSS.escape(pend.anchor)}`)
    if (el) scrollToEl(el)
  }, [p.pending, doc, slot])

  const scrollToAnchor = (anchor: string) => {
    const el = scrollRef.current?.querySelector(`#${CSS.escape(anchor)}`)
    if (el) scrollToEl(el)
  }

  const onOpenDoc = useCallback((id: string, heading?: string) => dispatch({ type: 'link', id }, heading), [dispatch])

  const meta = ix.docsById.get(p.docId)
  const n = view.tabs.length
  const hasRel = n > 0
  const backTo = slot === 'rel' ? (view.active > 0 ? view.tabs[view.active - 1] : view.main) : null
  const title = doc?.title ?? meta?.title ?? ''

  const header = (
    <div className={styles.header}>
      {backTo && p.phone && (
        <button type="button" className={styles.back} onClick={() => dispatch({ type: 'back' })} data-tt="이 탭 닫고 한 단계 전 글로">
          <ChevronLeft size={15} className="shrink-0" aria-hidden />
          <span className="truncate">{ix.docsById.get(backTo)?.title}</span>
        </button>
      )}
      {hasRel && !p.phone && (
        <span className={cn(styles.lane, p.focused && styles.laneFocus)} data-lane>
          {slot === 'main' ? '흐름' : '연관'}
          {slot === 'rel' && n > 1 && <span className="ml-1 font-medium tabular-nums">{`${view.active + 1}/${n}`}</span>}
        </span>
      )}
      {slot === 'rel' && (
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => {
            dispatch({ type: 'promote' })
            p.onReveal(p.docId)
          }}
          aria-label="흐름 칸으로 옮기기"
          data-tt="흐름 칸으로 — 이 글을 흐름 칸에 열고 트리에서 보이기"
        >
          <SquareArrowUpRight size={16} />
        </button>
      )}
      <m.span className={styles.headTitle} initial={false} animate={{ opacity: spy.title ? 1 : 0 }} transition={{ duration: 0.15 }} data-head-title={spy.title || undefined}>
        {title}
      </m.span>
      {slot === 'rel' ? (
        <>
          {n > 1 && (
            <button type="button" className={styles.textBtn} onClick={() => dispatch({ type: 'closeAll' })} data-tt="연관 탭을 모두 닫기">
              모두 닫기
            </button>
          )}
          {!p.phone && (
            <button type="button" className={styles.iconBtn} onClick={() => dispatch({ type: 'collapse', slot: 'rel' })} aria-label="연관 칸 접기" data-tt="연관 칸 접기">
              <PanelRightClose size={16} />
            </button>
          )}
          <button type="button" className={styles.iconBtn} onClick={() => dispatch({ type: 'close', index: view.active })} aria-label="이 탭 닫기" data-tt="이 탭 닫기">
            <X size={16} />
          </button>
        </>
      ) : (
        hasRel &&
        !p.phone && (
          <button type="button" className={styles.iconBtn} onClick={() => dispatch({ type: 'collapse', slot: 'main' })} aria-label="흐름 칸 접기" data-tt="흐름 칸 접기">
            <PanelLeftClose size={16} />
          </button>
        )
      )}
    </div>
  )

  let page: ReactNode = null
  if (doc === null || (doc === undefined && !meta)) {
    page = (
      <p className={styles.gone}>
        <b className="mb-1.5 block text-[18px] text-slate-900" data-title>
          없는 글
        </b>
        지워졌거나 공개를 내린 글이에요.
      </p>
    )
  } else if (doc) {
    const col = ix.collectionsById.get(doc.collectionId)
    const prevId = ix.prevOf.get(doc.id)
    const prev = prevId ? ix.docsById.get(prevId) : undefined
    const crossPrev = prev && prev.collectionId !== doc.collectionId ? prev : undefined
    const bl = backlinks(ix, doc.id)
    const ol = outLinks(ix, doc.id)
    page = (
      <article
        className={cn(styles.page, '[&_figure_img]:cursor-zoom-in')}
        onClick={(e) => {
          // 본문 그림 누르면 크게 (북마크 카드 그림은 링크라 제외)
          const img = (e.target as HTMLElement).closest('img')
          if (img && img.closest('figure') && !img.closest('a')) p.onZoom({ src: img.currentSrc || img.src, alt: img.alt })
        }}
      >
        <button type="button" className={styles.kick} onClick={() => p.onReveal(doc.id)} data-tt="사이드바 트리에서 보기">
          <Folder size={13} className="shrink-0" aria-hidden />
          <span className="truncate">{col?.path.join(' › ')}</span>
        </button>
        {crossPrev && (
          <DocLink id={crossPrev.id} onGo={() => dispatch({ type: 'step', slot, id: crossPrev.id })} className={styles.cfrom} data-cfrom>
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
        <div className={styles.meta}>
          <span>{ymd(doc.createdAt)}</span>
          {doc.tags.map((t) => (
            <span key={t} className="text-emerald-700">
              #{t}
            </span>
          ))}
          {(bl.length > 0 || ol.length > 0) && (
            <span className="inline-flex gap-1.5">
              {bl.length > 0 && (
                <button type="button" className={cn(styles.chip, 'bg-sky-50 text-sky-700')} onClick={() => scrollToAnchor(`links-in-${slot}`)} data-tt={`이 글을 가리키는 글 ${bl.length}개`}>
                  <ArrowDownLeft size={13} aria-hidden />
                  {bl.length}
                </button>
              )}
              {ol.length > 0 && (
                <button type="button" className={cn(styles.chip, 'bg-amber-50 text-amber-700')} onClick={() => scrollToAnchor(`links-out-${slot}`)} data-tt={`이 글이 가리키는 글 ${ol.length}개`}>
                  <ArrowUpRight size={13} aria-hidden />
                  {ol.length}
                </button>
              )}
            </span>
          )}
        </div>
        <BlockRenderer blocks={doc.blocks} onOpenDoc={onOpenDoc} />
        <footer className="mt-11 flex flex-col gap-7 border-t border-slate-200 pt-6">
          <Pager ix={ix} doc={doc} slot={slot} dispatch={dispatch} />
          <Links ix={ix} doc={doc} slot={slot} view={view} dispatch={dispatch} />
        </footer>
      </article>
    )
  }

  return (
    <m.section
      ref={ref}
      custom={p.dir}
      variants={paneVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={SPRING_COLUMN}
      layout
      className={styles.card}
      data-slot={slot}
      data-focus={(p.focused && hasRel) || undefined}
      aria-label={`${slot === 'main' ? '흐름' : '연관'}: ${title}`}
    >
      {/* 안쪽 motion 요소가 칸의 퇴장을 붙잡지 않게 — 본문은 열린 뒤에 도착한다 (PresenceBoundary 설명) */}
      <PresenceBoundary>
        {header}
        <div className="relative flex min-h-0 flex-1">
          <div className={styles.scroll} ref={scrollRef} onScroll={onScroll} data-scroll>
            {page}
          </div>
          {heads.length >= 2 && <Toc heads={heads} current={spy.heading} onGo={scrollToAnchor} />}
        </div>
        {p.flash?.slot === slot && (
          <m.div
            key={p.flash.n}
            className="pointer-events-none absolute inset-0 z-20 rounded-2xl ring-2 ring-inset ring-emerald-600"
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

const TOC_W = [18, 13, 9, 7, 6, 6]
const headText = (h: BlockOf<'heading'>) => h.inlines.map((x) => x.text).join('')

// 목차 — 마우스를 올리면 열리고(조금 늦게 닫힘), 누르기로도 연다(폰)
function Toc({ heads, current, onGo }: { heads: BlockOf<'heading'>[]; current: string | null; onGo: (anchor: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const closeT = useRef(0)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  useEffect(() => () => clearTimeout(closeT.current), [])
  const minLv = Math.min(...heads.map((h) => h.level))
  return (
    <nav
      className="absolute right-3 top-4 z-10"
      aria-label="목차"
      ref={ref}
      onMouseEnter={() => {
        clearTimeout(closeT.current)
        setOpen(true)
      }}
      onMouseLeave={() => {
        closeT.current = window.setTimeout(() => setOpen(false), 150)
      }}
    >
      <button type="button" className="flex flex-col items-end gap-[7px] rounded-lg px-1.5 py-2" onClick={() => setOpen((o) => !o)} aria-label="목차" aria-expanded={open} data-toc-bars>
        {heads.map((h) => (
          <i key={h.anchor} className={cn('block h-0.5 rounded-sm', h.anchor === current ? 'bg-slate-700' : 'bg-slate-300')} style={{ width: TOC_W[h.level - minLv] }} />
        ))}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            {...popIn}
            className="absolute right-0 top-0 max-h-[min(62vh,480px)] w-[min(264px,calc(100cqw-32px))] origin-top-right overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevated"
            data-toc-panel
          >
            {heads.map((h) => (
              <button
                key={h.anchor}
                type="button"
                className={cn(
                  'block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors hover:bg-slate-100 hover:text-slate-900',
                  h.anchor === current ? 'font-semibold text-slate-900' : 'text-slate-500',
                )}
                style={{ paddingLeft: 10 + (h.level - minLv) * 14 }}
                onClick={() => {
                  setOpen(false)
                  onGo(h.anchor)
                }}
                data-toc-item
                data-on={h.anchor === current || undefined}
              >
                {headText(h)}
              </button>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

const pg = {
  card: 'flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-slate-50',
  k: 'flex items-center gap-1.5 text-[12.5px] text-slate-500',
  t: 'line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900',
  xc: 'w-fit whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-px text-[11.5px] text-slate-500',
} as const

// 이전/다음 — 지금 칸 안에서 (흐름 칸이면 흐름 글, 연관 칸이면 펼친 탭만 바뀜). 다음 글이 여럿이면 갈래 목록
function Pager({ ix, doc, slot, dispatch }: { ix: GraphIndex; doc: Doc; slot: Slot; dispatch: Props['dispatch'] }) {
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
      <DocLink id={nx.id} onGo={step(nx.id)} className={cn(pg.card, 'items-end text-right')} data-pg="next">
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
      <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-slate-200 px-2 pb-2 pt-2.5">
        <span className={cn(pg.k, 'justify-end px-2 pb-1')}>
          다음 · 갈래 {nexts.length}
          <GitBranch size={14} aria-hidden />
        </span>
        {nexts.map((nx, k) => {
          const cross = nx.collectionId !== doc.collectionId
          const info = cross ? null : branchInfo(ix, nx.id)
          return (
            <DocLink key={nx.id} id={nx.id} onGo={step(nx.id)} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100" data-pg="branch">
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
    right = <span className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-[13px] text-slate-400">이 갈래의 마지막 글</span>
  }

  return (
    <nav className="grid grid-cols-1 gap-3 @[470px]:grid-cols-2" aria-label="이전·다음 글">
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

const rr = {
  row: 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-100',
  t: 'min-w-0 flex-1 truncate text-[14.5px] text-slate-900',
  m: 'whitespace-nowrap text-[12px] text-slate-400',
} as const

// 글 끝 연결 목록 — 어느 칸에서 눌러도 연관 칸 새 탭. 없는 글(비공개 포함)은 원문 이름만 회색으로
function Links({ ix, doc, slot, view, dispatch }: { ix: GraphIndex; doc: Doc; slot: Slot; view: View; dispatch: Props['dispatch'] }) {
  const cur = activeOf(view)
  const bl = backlinks(ix, doc.id)
  const ol = outLinks(ix, doc.id)
  const sa = seeAlso(ix, doc.id)
  if (!bl.length && !ol.length && !sa.length) return null

  const where = (id: string) =>
    id === view.main ? (slot === 'rel' ? '흐름 칸' : '') : id === cur ? (slot === 'main' ? '연관 칸' : '') : view.tabs.includes(id) ? '탭에 있음' : ''
  const row = (id: string) => {
    const d = ix.docsById.get(id)
    if (!d) return null
    const w = where(id)
    return (
      <DocLink key={id} id={id} onGo={() => dispatch({ type: 'link', id })} className={rr.row} data-rr>
        <span className={rr.t}>{d.title}</span>
        {w && <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-px text-[11.5px] text-emerald-700">{w}</span>}
        {!sameCollection(ix, id, doc.id) && <span className={rr.m}>{ix.collectionsById.get(d.collectionId)?.title}</span>}
      </DocLink>
    )
  }
  const edgeRow = (e: { target: string | null; targetLabel: string }) =>
    e.target && ix.docsById.has(e.target) ? (
      row(e.target)
    ) : (
      <span key={`?${e.targetLabel}`} className={cn(rr.row, 'cursor-not-allowed hover:bg-transparent')} data-tt="없는 글">
        <span className={cn(rr.t, 'text-slate-400')}>{e.targetLabel}</span>
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
      {bl.length > 0 && group(`links-in-${slot}`, <ArrowDownLeft size={13} aria-hidden />, '이 글을 가리키는 글', bl.length, bl.map(row))}
      {ol.length > 0 && group(`links-out-${slot}`, <ArrowUpRight size={13} aria-hidden />, '이 글이 가리키는 글', ol.length, ol.map(edgeRow))}
      {sa.length > 0 && group(`links-sa-${slot}`, <Link2 size={13} aria-hidden />, '함께 볼 글', sa.length, sa.map(edgeRow))}
    </section>
  )
}
