import type { GraphIndex } from '@dumpster/schema'
import { AnimatePresence, m } from 'framer-motion'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Clock,
  FolderTree,
  Hash,
  Maximize2,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { linkMarks } from './links'
import { searchDocs } from './search'
import { SITE } from './site'
import { collapseY, QUICK } from './motion'
import { isDark, onSystemTheme, toggleTheme } from './theme'
import { Tree } from './Tree'
import { cn, DocLink, md } from './ui'
import { FULL_DEFAULT, RAIL_WIDTH, clampFullWidth, snapMode, type SidebarMode, type SidebarState } from './useSidebar'
import type { View } from './view'

// 왼쪽 사이드바 — mongolive components/layout/Sidebar.tsx의 모양·동작을 그대로 잇는다
//   세 단계(useSidebar): 완전 접힘 / 아이콘 레일 / 전체
//   전체: [로고(=접기) 헌옷수거함(=첫 화면)/jsbeep ☾] · 검색 · [컬렉션|최근|태그] · ── · 목록 (검색어가 있으면 찾은 글)
//   레일: 아이콘만. 검색·목록 아이콘을 누르면 그걸로 펼친다. 맨 아래 = 테마 · 완전히 접기
//   접힘: 화면 왼쪽 끝 당김 핸들 — 늘 얇게 보이고 마우스가 다가가면 커진다. 누르면 접기 전 단계로, 끌면 끄는 만큼
//   로고 버튼: 평소엔 '헌', 올리면 무엇이 될지(전체 → 접기 아이콘, 레일 → 펼치기 아이콘)
//   너비: 오른쪽 틈을 끌면 너비에 따라 단계가 바뀐다. 더블클릭 = 기본 너비
//   떠 있는 화면(좁은 창·두 칸)에선 레일까지만 붙고, 전체는 칸 위에 떠서 열린다(바깥 누르기·Esc·글 고르기 → 레일)
//   폰(≤720px, 11-27): 단계 없음. 칸 머리 ☰ → App이 사이드바+칸을 통째로 밀어 꺼낸다(서랍) — 여기선 전체 내용만 그린다
// 11-27 평평한 판: 카드·그림자 없이 사이드바 바탕색만. 칸 쪽 경계선은 첫 칸의 왼쪽 선이 맡는다
// 기록 밖 화면 상태(목록 탭·펼친 컬렉션·접은 갈래)는 여기서만 갖는다.
// 지금 보는 칸의 글(focusDoc)이 바뀌면 그 글의 컬렉션을 펼치고, 컬렉션이 바뀌었으면 다른 건 접는다

const HANDLE = 8 // 끌기 손잡이 너비 — 사이드바와 칸의 경계선 위에 반씩 걸친다

const styles = {
  card: 'relative flex h-full flex-col overflow-hidden bg-side',
  cardFloating: 'relative flex h-full flex-col overflow-hidden border-r border-line bg-side shadow-pop',
  brand: 'mx-3 mt-2 flex h-12 shrink-0 items-center gap-2.5',
  brandRail: 'mt-2 flex h-12 shrink-0 items-center justify-center',
  // 로고 = 글자색·바탕색을 뒤집은 네모 (라이트 = 검정 바탕, 다크 = 흰 바탕)
  logo: 'group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[13px] font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400',
  // 제목 = 첫 화면 버튼
  brandName: 'group/title min-w-0 flex-1 rounded-md text-left outline-none',
  brandTitle: 'truncate text-sm font-semibold tracking-tight text-slate-900 transition-colors group-hover/title:text-slate-500',
  brandSub: 'truncate text-[11px] text-slate-500',
  headBtn: 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-side-hover hover:text-slate-900',
  search: 'h-8 w-full rounded-md border border-line bg-page pl-8 pr-8 text-[13px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400',
  searchIcon: 'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400',
  searchClear: 'absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 transition-colors hover:bg-hover hover:text-slate-900',
  seg: 'mx-3 mt-2 flex shrink-0 gap-0.5 rounded-md bg-side-hover p-[3px]',
  segBtn: 'flex h-7 flex-1 items-center justify-center rounded-[5px] text-[12.5px] font-medium transition-colors',
  segIdle: 'text-slate-500 hover:text-slate-900',
  segOn: 'bg-page text-slate-900 shadow-sm',
  divider: 'mx-3 my-2.5 h-px shrink-0 bg-line',
  body: 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3',
  railList: 'flex flex-col items-center gap-1',
  railBtn: 'inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-side-hover hover:text-slate-900',
  railBtnActive: 'inline-flex h-9 w-9 items-center justify-center rounded-md bg-selected text-slate-900 transition-colors',
  iconBtn: 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-selected hover:text-slate-900',
  // 줄에 마우스를 올려야 보이는 버튼 — display를 iconBtn과 따로 (inline-flex와 hidden이 겹치면 순서로 갈림)
  rowAction: 'hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-selected hover:text-slate-900 group-hover:inline-flex group-focus-within:inline-flex',
  // 컬렉션 줄 (mongolive ConnectionsTree 행)
  collRow: 'group flex h-8 w-full shrink-0 items-center gap-1.5 rounded-md pr-1 text-left text-[13px] transition-colors hover:bg-side-hover',
  collLabel: 'min-w-0 flex-1 truncate font-semibold',
  count: 'shrink-0 pr-1 font-mono text-[11px] tabular-nums text-slate-400',
  item: 'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 transition-colors',
  itemIdle: 'hover:bg-side-hover',
  itemOn: 'bg-selected',
  itemTitle: 'truncate text-[13px] font-medium text-slate-700',
  mark: 'rounded-sm bg-amber-100 text-inherit',
  itemMeta: 'flex gap-1.5 text-[11px] tabular-nums text-slate-400',
  sectionHead: 'mx-2 mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400',
  tag: 'rounded border px-2 py-0.5 text-[12px] transition-colors',
  tagIdle: 'border-line text-slate-600 hover:bg-side-hover',
  tagOn: 'border-transparent bg-selected font-medium text-slate-900',
  handle: 'group absolute inset-y-0 z-[60] flex cursor-col-resize touch-none justify-center outline-none',
  handleLineIdle: 'w-[2px] bg-transparent transition-colors group-hover:bg-slate-400 group-focus-visible:bg-slate-500',
  handleLineActive: 'w-[2px] bg-slate-500',
} as const

type SideTab = 'collections' | 'recent' | 'tags'
const TABS: { tab: SideTab; icon: LucideIcon; label: string }[] = [
  { tab: 'collections', icon: FolderTree, label: '컬렉션' },
  { tab: 'recent', icon: Clock, label: '최근' },
  { tab: 'tags', icon: Hash, label: '태그' },
]

export interface RevealRequest {
  id: string
  n: number
}

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
  onHome: () => void
}

// ── 목록 (전체 단계의 내용) ─────────────────────────────────────────────────

interface ListState {
  query: string
  setQuery: (q: string) => void
  tab: SideTab
  setTab: (t: SideTab) => void
  tag: string | null
  setTag: (t: string | null) => void
  open: Set<string>
  toggleOpen: (cid: string) => void
  only: string | null
  setOnly: (cid: string | null) => void
  folds: Record<string, string[]>
  toggleFold: (cid: string, id: string) => void
}

function Logo({ hoverIcon: HoverIcon, label, onClick }: { hoverIcon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.logo} onClick={onClick} aria-label={label} data-tt={label}>
      <span className="group-hover:hidden group-focus-visible:hidden" aria-hidden>
        {SITE.mark}
      </span>
      <HoverIcon size={16} className="hidden group-hover:block group-focus-visible:block" aria-hidden />
    </button>
  )
}

// 테마 — 아이콘 하나 (전체: 머리 오른쪽, 레일: 맨 아래)
function ThemeToggle({ className }: { className: string }) {
  const [dark, setDark] = useState(isDark)
  useEffect(() => onSystemTheme(() => setDark(isDark())), [])
  const label = dark ? '라이트 모드' : '다크 모드'
  const Icon = dark ? Sun : Moon
  return (
    <button type="button" className={className} onClick={() => setDark(toggleTheme())} aria-label={label} data-tt={label}>
      <Icon size={16} />
    </button>
  )
}

// 찾은 제목에서 검색어 자리 칠하기 (띄어쓰기 없이 맞은 건 칠하지 않음)
function Marked({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase()
  const i = q ? text.toLowerCase().indexOf(q) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className={styles.mark}>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function FullContent(
  p: Props & { list: ListState; bodyRef: RefObject<HTMLDivElement>; focusSearch: number; onSearchFocused: () => void; onCollapse: () => void; onPick: (id: string) => void },
) {
  const { ix, view, list } = p
  const searchRef = useRef<HTMLInputElement>(null)
  // 레일의 검색 아이콘으로 펼쳤으면 검색칸에 바로
  useEffect(() => {
    if (!p.focusSearch) return
    searchRef.current?.focus()
    p.onSearchFocused() // 한 번만 — 다음에 펼칠 땐 검색칸에 안 감
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focusSearch])
  const hits = useMemo(() => searchDocs(ix, list.query), [ix, list.query])
  const searching = list.query.trim() !== ''
  const marks = useMemo(() => linkMarks(ix, p.focusDoc), [ix, p.focusDoc])
  const count = (cid: string) => ix.docsByCollection.get(cid)?.length ?? 0
  const tree = (cid: string) => (
    <Tree
      ix={ix}
      collectionId={cid}
      view={view}
      marks={marks}
      hl={p.hl}
      folds={list.folds[cid] ?? []}
      onFold={(id) => list.toggleFold(cid, id)}
      onOpen={p.onPick}
    />
  )

  let body: ReactNode
  if (searching) {
    body = hits.length ? (
      hits.map(({ doc, alias }) => (
        <DocLink key={doc.id} id={doc.id} onGo={() => p.onPick(doc.id)} className={cn(styles.item, view.main === doc.id ? styles.itemOn : styles.itemIdle)} data-hit>
          <span className={styles.itemTitle}>
            <Marked text={doc.title} query={list.query} />
          </span>
          <span className={styles.itemMeta}>
            <span className="truncate">{ix.collectionsById.get(doc.collectionId)?.title}</span>
            {alias && (
              <span className="truncate">
                별칭 <Marked text={alias} query={list.query} />
              </span>
            )}
          </span>
        </DocLink>
      ))
    ) : (
      <p className="px-2 py-1.5 text-[12px] text-slate-400" data-no-hit>
        맞는 제목이 없어요
      </p>
    )
  } else if (list.tab === 'collections') {
    const k = list.only ? ix.collectionsById.get(list.only) : undefined
    if (k) {
      body = (
        <div data-coll={k.id} data-open>
          <div className={styles.collRow}>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch pl-0.5 text-left" onClick={() => list.setOnly(null)} data-tt="모든 컬렉션 보기">
              <ChevronLeft size={14} className="ml-1 shrink-0 text-slate-400" aria-hidden />
              <span className={cn(styles.collLabel, 'text-slate-900')} data-coll-title>
                {k.title}
              </span>
            </button>
            <span className={styles.count}>{count(k.id)}</span>
            <button type="button" className={styles.iconBtn} onClick={() => list.setOnly(null)} aria-label="모든 컬렉션 보기" data-tt="모든 컬렉션 보기">
              <Minimize2 size={13} />
            </button>
          </div>
          {k.path.length > 1 && <p className="px-2 text-[11px] text-slate-400">{k.path.slice(0, -1).join(' / ')}</p>}
          {k.description && <p className="mb-2 mt-1 px-2 text-[12px] leading-relaxed text-slate-500">{k.description}</p>}
          {tree(k.id)}
        </div>
      )
    } else {
      const mainCid = view.main ? ix.docsById.get(view.main)?.collectionId : null
      body = ix.graph.collections.map((c) => {
        const isOpen = list.open.has(c.id)
        return (
          <div key={c.id} data-coll={c.id} data-open={isOpen || undefined} style={{ paddingLeft: (c.path.length - 1) * 14 }}>
            <div className={styles.collRow}>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch pl-0.5 text-left"
                onClick={() => list.toggleOpen(c.id)}
                aria-expanded={isOpen}
              >
                <ChevronDown size={14} className={cn('ml-1 shrink-0 text-slate-400 transition-transform', !isOpen && '-rotate-90')} aria-hidden />
                <span className={cn(styles.collLabel, mainCid === c.id ? 'text-slate-900' : 'text-slate-600')} data-coll-title>
                  {c.title}
                </span>
              </button>
              <span className={cn(styles.count, 'group-hover:hidden group-focus-within:hidden')}>{count(c.id)}</span>
              <button
                type="button"
                className={styles.rowAction}
                onClick={() => {
                  list.setOnly(c.id)
                  if (p.bodyRef.current) p.bodyRef.current.scrollTop = 0
                }}
                aria-label={`${c.title}만 보기`}
                data-tt="이 컬렉션만 보기"
              >
                <Maximize2 size={13} />
              </button>
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <m.div key="tree" {...collapseY} className="overflow-hidden pb-1">
                  {tree(c.id)}
                </m.div>
              )}
            </AnimatePresence>
          </div>
        )
      })
    }
  } else if (list.tab === 'recent') {
    body = <Recent ix={ix} main={view.main} onOpen={p.onPick} />
  } else {
    body = <Tags ix={ix} main={view.main} tag={list.tag} setTag={list.setTag} onOpen={p.onPick} />
  }

  return (
    <>
      <div className={styles.brand}>
        <Logo hoverIcon={PanelLeftClose} label={p.phone ? '목록 닫기' : '아이콘만 보기'} onClick={p.phone ? p.onDrawerClose : p.onCollapse} />
        <button type="button" className={styles.brandName} onClick={p.onHome} data-tt="첫 화면" data-home>
          <p className={styles.brandTitle}>{SITE.title}</p>
          <p className={styles.brandSub}>{SITE.author}</p>
        </button>
        <ThemeToggle className={styles.headBtn} />
      </div>
      <div className="relative mx-3 mt-1 shrink-0">
        <Search size={14} className={styles.searchIcon} aria-hidden />
        <input
          ref={searchRef}
          type="search"
          className={cn(styles.search, '[&::-webkit-search-cancel-button]:hidden')}
          placeholder="제목 찾기"
          aria-label="제목 찾기"
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits[0]) p.onPick(hits[0].doc.id)
            if (e.key === 'Escape' && list.query) {
              e.stopPropagation() // 떠 있는 사이드바의 Esc(닫기)보다 먼저 — 검색어부터 지운다
              list.setQuery('')
            }
          }}
          data-search
        />
        {list.query && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => {
              list.setQuery('')
              searchRef.current?.focus()
            }}
            aria-label="검색어 지우기"
            data-tt="검색어 지우기"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className={styles.seg} role="group" aria-label="목록 보기">
        {TABS.map(({ tab, label }) => (
          <button
            key={tab}
            type="button"
            aria-pressed={!searching && list.tab === tab}
            className={cn(styles.segBtn, !searching && list.tab === tab ? styles.segOn : styles.segIdle)}
            onClick={() => {
              list.setQuery('')
              list.setTab(tab)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.divider} />
      <div className={styles.body} ref={p.bodyRef}>
        {body}
      </div>
    </>
  )
}

function RailContent({ tab, onExpand, onHide, onSearch, onTab }: { tab: SideTab; onExpand: () => void; onHide: () => void; onSearch: () => void; onTab: (t: SideTab) => void }) {
  return (
    <>
      <div className={styles.brandRail}>
        <Logo hoverIcon={PanelLeftOpen} label="사이드바 펼치기" onClick={onExpand} />
      </div>
      <nav className={cn(styles.railList, 'pt-3')} aria-label="목록 보기">
        <button type="button" className={styles.railBtn} onClick={onSearch} aria-label="제목 찾기" data-tt="제목 찾기">
          <Search size={16} />
        </button>
        {TABS.map(({ tab: t, icon: Icon, label }) => (
          <button key={t} type="button" className={t === tab ? styles.railBtnActive : styles.railBtn} onClick={() => onTab(t)} aria-label={label} data-tt={label}>
            <Icon size={16} />
          </button>
        ))}
      </nav>
      <div className="flex-1" />
      <div className={cn(styles.railList, 'pb-3')}>
        <ThemeToggle className={styles.railBtn} />
        <div className="my-1 h-px w-6 bg-line" />
        <button type="button" className={styles.railBtn} onClick={onHide} aria-label="사이드바 숨기기" data-tt="사이드바 숨기기 — 왼쪽 끝에서 다시 꺼낸다">
          <ChevronsLeft size={16} />
        </button>
      </div>
    </>
  )
}

function Recent({ ix, main, onOpen }: { ix: GraphIndex; main: string | null; onOpen: (id: string) => void }) {
  const list = useMemo(
    () => [...ix.graph.docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title, 'ko')).slice(0, 16),
    [ix],
  )
  return (
    <>
      {list.map((d) => (
        <DocLink key={d.id} id={d.id} onGo={() => onOpen(d.id)} className={cn(styles.item, main === d.id ? styles.itemOn : styles.itemIdle)} data-recent>
          <span className={styles.itemTitle}>{d.title}</span>
          <span className={styles.itemMeta}>
            <span className="truncate">{ix.collectionsById.get(d.collectionId)?.title}</span>
            <span>{md(d.updatedAt)}</span>
          </span>
        </DocLink>
      ))}
    </>
  )
}

function Tags(p: { ix: GraphIndex; main: string | null; tag: string | null; setTag: (t: string | null) => void; onOpen: (id: string) => void }) {
  const { ix, tag } = p
  const tags = useMemo(() => {
    const count = new Map<string, number>()
    for (const d of ix.graph.docs) for (const t of d.tags) count.set(t, (count.get(t) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [ix])
  const list = tag ? ix.graph.docs.filter((d) => d.tags.includes(tag)).sort((a, b) => a.title.localeCompare(b.title, 'ko')) : []
  return (
    <>
      <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-1.5">
        {tags.map(([t, n]) => (
          <button key={t} type="button" className={cn(styles.tag, tag === t ? styles.tagOn : styles.tagIdle)} aria-pressed={tag === t} onClick={() => p.setTag(tag === t ? null : t)}>
            #{t}
            <span className="ml-1 tabular-nums text-slate-400">{n}</span>
          </button>
        ))}
      </div>
      {tag && (
        <>
          <p className={styles.sectionHead}>#{tag}</p>
          {list.map((d) => (
            <DocLink key={d.id} id={d.id} onGo={() => p.onOpen(d.id)} className={cn(styles.item, p.main === d.id ? styles.itemOn : styles.itemIdle)}>
              <span className={styles.itemTitle}>{d.title}</span>
              <span className={styles.itemMeta}>{ix.collectionsById.get(d.collectionId)?.title}</span>
            </DocLink>
          ))}
        </>
      )}
    </>
  )
}

// ── 끌기 (mongolive 그대로) ──────────────────────────────────────────────────

// 손잡이를 끄는 동안의 '날 것' 너비. 4px 넘게 움직여야 끌기로 친다 — 그 전에 놓으면 onClick
function useDrag(onCommit: (raw: number) => void, onClick?: () => void) {
  const dragRef = useRef<{ startX: number; startWidth: number; pointerId: number; moved: boolean } | null>(null)
  const [raw, setRaw] = useState<number | null>(null)
  const dragging = raw !== null

  useEffect(() => {
    if (!dragging) return
    const { cursor, userSelect } = document.body.style
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = cursor
      document.body.style.userSelect = userSelect
    }
  }, [dragging])

  const start = (startWidth: number) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startWidth, pointerId: e.pointerId, moved: false }
  }
  const handlers = {
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const dx = e.clientX - drag.startX
      if (!drag.moved && Math.abs(dx) < 4) return
      drag.moved = true
      setRaw(drag.startWidth + dx)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null
      setRaw(null)
      if (drag.moved) onCommit(drag.startWidth + (e.clientX - drag.startX))
      else onClick?.()
    },
    onPointerCancel: () => {
      dragRef.current = null
      setRaw(null)
    },
  }
  return { raw, dragging, start, handlers }
}

// 완전 접힘 — 화면 왼쪽 끝 당김 핸들 (아이폰 PiP를 옆으로 치워 둔 모양)
function PullHandle({ drag, onRestore }: { drag: ReturnType<typeof useDrag>; onRestore: () => void }) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    let frame = 0
    const onMove = (e: globalThis.PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setNear(e.clientX < 56))
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  const big = near || drag.dragging
  return (
    <button
      type="button"
      className="fixed left-0 top-1/2 z-[95] flex h-28 w-6 -translate-y-1/2 touch-none items-center outline-none"
      aria-label="사이드바 꺼내기"
      data-tt={drag.dragging ? undefined : '사이드바 꺼내기 — 끌어서 꺼내도 된다'}
      onPointerDown={drag.start(0)}
      {...drag.handlers}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRestore()
        }
      }}
    >
      <m.span
        className="flex items-center justify-center overflow-hidden rounded-r-md border border-l-0 border-line bg-side text-slate-500 shadow-pop"
        initial={false}
        animate={big ? { width: 20, height: 72, opacity: 1 } : { width: 5, height: 48, opacity: 0.85 }}
        transition={QUICK}
      >
        {big && <ChevronRight size={14} aria-hidden />}
      </m.span>
    </button>
  )
}

const dockedWidthOf = (mode: SidebarMode, fullWidth: number) => (mode === 'full' ? fullWidth : mode === 'rail' ? RAIL_WIDTH : 0)

// ── 사이드바 ──────────────────────────────────────────────────────────────────

export function Sidebar(p: Props) {
  const { sidebar, ix, focusDoc } = p
  const { mode, isOverlay, width, setMode } = sidebar

  // 목록 상태
  const [query, setQuery] = useState('')
  const [focusSearch, setFocusSearch] = useState(0)
  const [tab, setTab] = useState<SideTab>('collections')
  const [tag, setTag] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [only, setOnly] = useState<string | null>(null)
  const [folds, setFolds] = useState<Record<string, string[]>>({})
  const lastCid = useRef<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const scrollTo = useRef<string | null>(null) // 다 그린 뒤 트리에서 보이게 할 글
  const list: ListState = {
    query,
    setQuery,
    tab,
    setTab,
    tag,
    setTag,
    open,
    toggleOpen: (cid) =>
      setOpen((s) => {
        const n = new Set(s)
        if (!n.delete(cid)) n.add(cid)
        return n
      }),
    only,
    setOnly,
    folds,
    toggleFold: (cid, id) =>
      setFolds((f) => {
        const l = f[cid] ?? []
        return { ...f, [cid]: l.includes(id) ? l.filter((x) => x !== id) : [...l, id] }
      }),
  }

  // 지금 보는 글의 컬렉션 펼치기
  useEffect(() => {
    const cid = focusDoc ? ix.docsById.get(focusDoc)?.collectionId : undefined
    if (!cid) return
    if (cid !== lastCid.current) {
      setOpen(new Set([cid]))
      lastCid.current = cid
    } else setOpen((s) => (s.has(cid) ? s : new Set(s).add(cid)))
    setOnly((o) => (o && o !== cid ? cid : o))
    scrollTo.current = focusDoc
  }, [ix, focusDoc])

  // 칸 위 컬렉션 이름 · 바로가기 → 트리에서 그 글 보이기 (접혀 있으면 꺼낸다)
  useEffect(() => {
    if (!p.reveal) return
    const cid = ix.docsById.get(p.reveal.id)?.collectionId
    if (!cid) return
    setTab('collections')
    setQuery('')
    setOpen((s) => (s.has(cid) ? s : new Set(s).add(cid)))
    setOnly((o) => (o && o !== cid ? cid : o))
    scrollTo.current = p.reveal.id
    if (!p.phone && mode !== 'full') setMode('full')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ix, p.reveal])

  // 그린 뒤: 보일 글의 행이 목록 밖이면 1/3 지점으로
  useEffect(() => {
    const id = scrollTo.current
    const sb = bodyRef.current
    if (!id || !sb) return
    const row = sb.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)
    if (!row) return
    scrollTo.current = null
    const r = row.getBoundingClientRect()
    const b = sb.getBoundingClientRect()
    if (r.top < b.top || r.bottom > b.bottom) sb.scrollTop += r.top - b.top - b.height / 3
  })

  // 떠 있는 전체: Esc → 레일
  const overlayOpen = isOverlay && mode === 'full'
  useEffect(() => {
    if (!overlayOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMode('rail')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen, setMode])

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
    <FullContent {...p} list={list} bodyRef={bodyRef} focusSearch={focusSearch} onSearchFocused={() => setFocusSearch(0)} onCollapse={() => setMode('rail')} onPick={pick} onHome={home} />
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
                <RailContent
                  tab={tab}
                  onExpand={() => setMode('full')}
                  onHide={() => setMode('collapsed')}
                  onSearch={() => {
                    setFocusSearch((n) => n + 1)
                    setMode('full')
                  }}
                  onTab={(t) => {
                    setTab(t)
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
