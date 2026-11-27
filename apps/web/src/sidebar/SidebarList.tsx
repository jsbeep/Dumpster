import { cx } from '@dumpster/blocks'
import type { GraphIndex } from '@dumpster/schema'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronDown, ChevronLeft, Maximize2, Minimize2, PanelLeftClose, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import type { Store } from '../core/data'
import { linkMarks } from '../core/links'
import type { View } from '../core/view'
import type { Land } from '../hooks/useView'
import { DocLink } from '../ui/DocLink'
import { IconButton } from '../ui/IconButton'
import { collapseNow, collapseY } from '../ui/motion'
import { SITE } from '../ui/site'
import { Recent } from './Recent'
import { item, Logo, TABS, ThemeToggle } from './shared'
import { Tags } from './Tags'
import { Tree } from './Tree'
import { useSearch } from './useSearch'
import type { ListState } from './useSidebarList'

// 사이드바 전체 단계의 내용 (붙어 있을 때·떠 있을 때·폰 서랍 모두 이것)
//   [로고(=접기) 헌옷수거함(=첫 화면)/jsbeep ☾] · 찾기칸 · [컬렉션|최근|태그] · ── · 목록
//   검색어가 있으면 목록 대신 찾은 글: 제목·별칭으로 찾은 글 → "본문에서"(두 글자부터, 걸린 줄 + 헤딩 · 누르면 그 헤딩까지)
//   / · Ctrl/⌘+K = 찾기칸으로 (Sidebar)

const styles = {
  brand: 'mx-3 mt-2 flex h-12 shrink-0 items-center gap-2.5',
  // 제목 = 첫 화면 버튼
  brandName: 'group/title min-w-0 flex-1 rounded-md text-left outline-none',
  brandTitle: 'truncate text-sm font-semibold tracking-tight text-slate-900 transition-colors group-hover/title:text-slate-500',
  brandSub: 'truncate text-[11px] text-slate-500',
  // 폰: 16px 밑이면 iOS 사파리가 입력칸을 누를 때 화면을 확대해 버린다
  search: 'h-8 max-[720px]:h-10 w-full rounded-md border border-line bg-page pl-8 pr-8 text-[13px] max-[720px]:text-base text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400',
  searchIcon: 'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400',
  seg: 'mx-3 mt-2 flex shrink-0 gap-0.5 rounded-md bg-side-hover p-[3px]',
  segBtn: 'flex h-7 max-[720px]:h-9 flex-1 items-center justify-center rounded-[5px] text-[12.5px] font-medium transition-colors',
  segIdle: 'text-slate-500 hover:text-slate-900',
  segOn: 'bg-page text-slate-900 shadow-sm',
  divider: 'mx-3 my-2.5 h-px shrink-0 bg-line',
  body: 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 pb-3', // 끝까지 굴려도 뒤(폰은 문서)가 안 따라 굴러감
  // 컬렉션 줄 (mongolive ConnectionsTree 행)
  collRow: 'group flex h-8 max-[720px]:h-10 w-full shrink-0 items-center gap-1.5 rounded-md pr-1 text-left text-[13px] transition-colors hover:bg-side-hover',
  collBtn: 'flex min-w-0 flex-1 items-center gap-1.5 self-stretch pl-0.5 text-left',
  collLabel: 'min-w-0 flex-1 truncate font-semibold',
  count: 'shrink-0 pr-1 font-mono text-[11px] tabular-nums text-slate-400',
  mark: 'rounded-sm bg-amber-100 text-inherit',
  kbd: 'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[10px] leading-4 text-slate-400 peer-focus:hidden',
  group: 'px-2 pb-1 text-[11px] font-medium text-slate-400',
  snippet: 'truncate text-[12px] text-slate-500',
  empty: 'px-2 py-1.5 text-[12px] text-slate-400',
} as const

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

interface Props {
  ix: GraphIndex
  store: Store // 본문 찾기용 평문 (getSearchText)
  view: View
  focusDoc: string | null // 트리 ↙↗ 표시의 기준
  hl: (string | null)[] // 트리에서 테두리로 짚을 글
  list: ListState
  bodyRef: RefObject<HTMLDivElement>
  phone: boolean
  focusSearch: number // 늘어나면 검색칸에 글자 커서 (레일의 검색 아이콘 · / · Ctrl/⌘+K)
  onSearchFocused: () => void
  onClose: () => void // 로고: 폰이면 서랍 닫기, 아니면 레일로
  onPick: (id: string, land?: Land) => void // 찾기 결과면 land = 검색어(칸 안 찾기를 켬) + 본문에서 걸린 헤딩
  onHome: () => void
}

export function SidebarList(p: Props) {
  const { ix, view, list } = p
  const searchRef = useRef<HTMLInputElement>(null)
  // 레일의 검색 아이콘·단축키로 왔으면 검색칸에 바로. 이미 적힌 검색어는 골라 둔다(바로 치면 새 검색어)
  // preventScroll: 폰 서랍·떠 있는 목록은 밀려 들어오는 중이라, 그냥 focus하면 브라우저가 바깥 상자를 스크롤해 버린다
  useEffect(() => {
    if (!p.focusSearch) return
    searchRef.current?.focus({ preventScroll: true })
    searchRef.current?.select()
    p.onSearchFocused() // 한 번만 — 다음에 펼칠 땐 검색칸에 안 감
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focusSearch])
  const { titleHits, bodyHits, wantBody, bodyWaiting } = useSearch(ix, p.store, list.query)
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
      still={p.phone}
    />
  )

  let body: ReactNode
  if (searching) {
    const rowClass = (id: string) => cx(item.row, view.main === id ? item.on : item.idle)
    body = (
      <>
        {titleHits.map(({ doc, alias }) => (
          <DocLink key={doc.id} id={doc.id} onGo={() => p.onPick(doc.id, { find: list.query.trim() })} className={rowClass(doc.id)} data-hit>
            <span className={item.title}>
              <Marked text={doc.title} query={list.query} />
            </span>
            <span className={item.meta}>
              <span className="truncate">{ix.collectionsById.get(doc.collectionId)?.title}</span>
              {alias && (
                <span className="truncate">
                  별칭 <Marked text={alias} query={list.query} />
                </span>
              )}
            </span>
          </DocLink>
        ))}
        {bodyHits.length > 0 && (
          <p className={cx(styles.group, titleHits.length ? 'pt-3' : 'pt-1')} data-body-group>
            본문에서
          </p>
        )}
        {bodyHits.map(({ doc, anchor, heading, snippet, count }) => (
          <DocLink key={doc.id} id={doc.id} onGo={() => p.onPick(doc.id, { anchor: anchor ?? undefined, find: list.query.trim() })} className={rowClass(doc.id)} data-body-hit={anchor ?? ''}>
            <span className={item.title}>{doc.title}</span>
            <span className={styles.snippet}>
              {snippet.before}
              <mark className={styles.mark}>{snippet.match}</mark>
              {snippet.after}
            </span>
            <span className={item.meta}>
              <span className="truncate">{heading !== null ? `› ${heading}` : ix.collectionsById.get(doc.collectionId)?.title}</span>
              {count > 1 && <span className="ml-auto shrink-0">{count}곳</span>}
            </span>
          </DocLink>
        ))}
        {!titleHits.length && !bodyHits.length && !bodyWaiting && (
          <p className={styles.empty} data-no-hit>
            {wantBody ? '맞는 글이 없어요' : '맞는 제목이 없어요 · 본문은 두 글자부터'}
          </p>
        )}
      </>
    )
  } else if (list.tab === 'collections') {
    const k = list.only ? ix.collectionsById.get(list.only) : undefined
    if (k) {
      body = (
        <div data-coll={k.id} data-open>
          <div className={styles.collRow}>
            <button type="button" className={styles.collBtn} onClick={() => list.setOnly(null)} data-tt="모든 컬렉션 보기">
              <ChevronLeft size={14} className="ml-1 shrink-0 text-slate-400" aria-hidden />
              <span className={cx(styles.collLabel, 'text-slate-900')} data-coll-title>
                {k.title}
              </span>
            </button>
            <span className={styles.count}>{count(k.id)}</span>
            <IconButton label="모든 컬렉션 보기" size="sm" tone="row" onClick={() => list.setOnly(null)}>
              <Minimize2 size={13} />
            </IconButton>
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
        // 폰은 마우스 올리기가 없어 '이 컬렉션만 보기'가 안 보였다 → 열린 컬렉션 줄엔 개수 대신 늘 (PC에서 마우스 올린 모양, 11-27)
        const pin = p.phone && isOpen
        return (
          <div key={c.id} data-coll={c.id} data-open={isOpen || undefined} style={{ paddingLeft: (c.path.length - 1) * 14 }}>
            <div className={styles.collRow}>
              <button type="button" className={styles.collBtn} onClick={() => list.toggleOpen(c.id)} aria-expanded={isOpen}>
                <ChevronDown size={14} className={cx('ml-1 shrink-0 text-slate-400 transition-transform', !isOpen && '-rotate-90')} aria-hidden />
                <span className={cx(styles.collLabel, mainCid === c.id ? 'text-slate-900' : 'text-slate-600')} data-coll-title>
                  {c.title}
                </span>
              </button>
              <span className={cx(styles.count, pin ? 'hidden' : 'group-hover:hidden group-focus-within:hidden')}>{count(c.id)}</span>
              <IconButton
                label={`${c.title}만 보기`}
                tip="이 컬렉션만 보기"
                size={pin ? 'lg' : 'sm'}
                tone="row"
                reveal={!pin}
                onClick={() => {
                  list.setOnly(c.id)
                  if (p.bodyRef.current) p.bodyRef.current.scrollTop = 0
                }}
              >
                <Maximize2 size={13} />
              </IconButton>
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <m.div key="tree" {...(p.phone ? collapseNow : collapseY)} className="overflow-hidden pb-1">
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
        <Logo hoverIcon={PanelLeftClose} label={p.phone ? '목록 닫기' : '아이콘만 보기'} onClick={p.onClose} />
        <button type="button" className={styles.brandName} onClick={p.onHome} data-tt="첫 화면" data-home>
          <p className={styles.brandTitle}>{SITE.title}</p>
          <p className={styles.brandSub}>{SITE.author}</p>
        </button>
        <ThemeToggle size="lg" />
      </div>
      <div className="relative mx-3 mt-1 shrink-0">
        <Search size={14} className={styles.searchIcon} aria-hidden />
        <input
          ref={searchRef}
          type="search"
          className={cx(styles.search, 'peer [&::-webkit-search-cancel-button]:hidden')}
          placeholder="제목·본문 찾기"
          aria-label="제목·본문 찾기"
          aria-keyshortcuts="/ Control+K Meta+K"
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const find = list.query.trim()
              if (titleHits[0]) p.onPick(titleHits[0].doc.id, { find })
              else if (bodyHits[0]) p.onPick(bodyHits[0].doc.id, { anchor: bodyHits[0].anchor ?? undefined, find })
            }
            if (e.key === 'Escape' && list.query) {
              e.stopPropagation() // 떠 있는 사이드바의 Esc(닫기)보다 먼저 — 검색어부터 지운다
              list.setQuery('')
            }
          }}
          data-search
        />
        {!list.query && !p.phone && (
          <kbd className={styles.kbd} aria-hidden>
            /
          </kbd>
        )}
        {list.query && (
          <IconButton
            label="검색어 지우기"
            size="xs"
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
            onClick={() => {
              list.setQuery('')
              searchRef.current?.focus()
            }}
          >
            <X size={13} />
          </IconButton>
        )}
      </div>
      <div className={styles.seg} role="group" aria-label="목록 보기">
        {TABS.map(({ tab, label }) => (
          <button
            key={tab}
            type="button"
            aria-pressed={!searching && list.tab === tab}
            className={cx(styles.segBtn, !searching && list.tab === tab ? styles.segOn : styles.segIdle)}
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
