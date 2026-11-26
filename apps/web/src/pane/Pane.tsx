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
  Menu,
  PanelLeftClose,
  PanelRightClose,
  Search,
  SquareArrowUpRight,
  X,
} from 'lucide-react'
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Store } from '../core/data'
import { FindBar } from './Find'
import { backlinks, branchInfo, outLinks, sameCollection, seeAlso } from '../core/links'
import { paneVariants, popIn, QUICK } from '../ui/motion'
import { PresenceBoundary } from '../ui/PresenceBoundary'
import { DocLink } from '../ui/DocLink'
import { ymd } from '../ui/format'
import { cx } from '@dumpster/blocks'
import type { PendingHeading, Pulse } from '../hooks/useView'
import { activeOf, type Action, type Slot, type View } from '../core/view'

// 칸 하나 — 흐름 칸이든 연관 칸이든 같은 모양 (design.md §3 "칸"). 11-27 평평한 판: 카드 없이 왼쪽 1px 선으로 이웃과 나뉜다
//   머리: [☰ 폰 목록] [‹ 폰 뒤로] 흐름|연관 n/m [바로가기] (스크롤하면 제목 + 밑줄) [찾기] [모두 닫기] [접기] [×]
//   찾기 줄(열었을 때): 이 글 안에서만 찾기 (Find.tsx)
//   본문: 컬렉션 이름(→ 트리에서 보기) · 이어진 곳 · 제목 · 날짜·태그·↙↗ 개수 · 블록 · 이전/다음 카드 · 연결 목록
//   오른쪽 위: 목차 줄 → 마우스를 올리면(폰은 누르면) 목록
// 칸 자체가 AnimatePresence의 직접 자식이라 ref를 넘긴다 (popLayout이 재야 함)

export const styles = {
  // 폭: 두 칸이면 흐름 칸은 반으로 묶고(띠는 연관 쪽에서만 빠진다) 나머지는 남는 폭 — width 클래스는 부르는 쪽이 하나만 고른다
  card: 'relative flex min-w-0 flex-col overflow-hidden bg-page @container',
  edge: 'border-l border-line', // 왼쪽 이웃(사이드바·칸·띠)과 나누는 선. 폰은 한 칸이라 없음
  grow: 'flex-1 basis-0',
  half: 'w-1/2 flex-none',
  header: 'flex h-11 shrink-0 items-center gap-0.5 border-b px-2 transition-colors',
  lane: 'shrink-0 whitespace-nowrap px-1.5 text-[11.5px] font-semibold',
  laneIdle: 'text-slate-400',
  laneFocus: 'text-slate-900',
  iconBtn: 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-hover hover:text-slate-900',
  textBtn: 'h-7 shrink-0 whitespace-nowrap rounded-md px-2 text-[12px] text-slate-500 transition-colors hover:bg-hover hover:text-slate-900',
  headTitle: 'min-w-0 flex-1 truncate px-1.5 text-[13px] font-semibold text-slate-700',
  back: 'flex h-7 max-w-[46%] shrink-0 items-center gap-1 rounded-md pl-1 pr-2 text-[12.5px] text-slate-500 hover:bg-hover hover:text-slate-900',
  scroll: 'relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
  page: 'mx-auto max-w-[760px] pb-16 pl-[22px] pr-10 @[560px]:px-11 @[560px]:pb-[72px]',
  kick: '-ml-1.5 mt-3.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12.5px] text-slate-500 transition-colors hover:bg-hover hover:text-slate-900',
  cfrom: 'mt-1.5 flex w-fit max-w-full items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12.5px] text-slate-500 transition-colors hover:text-slate-900',
  title: 'mt-2 text-[24px] font-bold leading-[1.3] tracking-[-0.02em] text-slate-900 [text-wrap:balance] @[560px]:text-[28px]',
  meta: 'mb-[26px] mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] tabular-nums text-slate-500',
  // ↙↗ 개수 — 알약 대신 글자 + 아이콘
  count: 'inline-flex items-center gap-0.5 rounded px-1 -mx-1 font-medium text-slate-500 transition-colors hover:bg-hover hover:text-slate-900',
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
  half: boolean // 두 칸일 때 흐름 칸 — 폭을 반으로 묶는다
  onMenu?: () => void // 폰: 머리 왼쪽 ☰ → 사이드바가 칸을 밀며 나온다
  z: number // 왼쪽 칸일수록 위 (mongolive 밀러 컬럼 99 - 순서) — 들어오는 칸이 흐름 칸 밑에서 빠져나온다
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
const EDGE = 12 // 칸 폭이 바뀌는 도중 본문 글자와 칸 테두리 사이에 남길 최소 틈

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

  // 이 글에서 찾기 — 돋보기, 또는 지금 보는 칸에서 Ctrl/⌘+F. 찾기 칸에 글자 커서가 있으면 그 Ctrl+F는 브라우저에 맡긴다
  const [find, setFind] = useState(0) // 0 = 닫힘, 그 밖 = 열 때마다 늘어남 (찾기 칸에 커서)
  const openFind = () => setFind((n) => n + 1)
  useEffect(() => {
    if (!p.focused || !doc) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return
      if ((document.activeElement as HTMLElement | null)?.dataset.findInput !== undefined) return
      e.preventDefault()
      openFind()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [p.focused, doc])

  // ── 칸 폭이 바뀔 때 (탭 열기·닫기·접기·띠) — iOS push/pop 전환처럼 ──
  // 애니메이션 동안 본문 폭 = 옛 폭과 새 폭 중 좁은 쪽 → 본문이 칸보다 넓어 양옆이 잘려 보이는 순간이 없다
  //   넓어질 때: 옛(좁은) 폭·여백으로 묶었다가 움직이는 도중에 풀어서 한 번 줄바꿈 — 끝나고 툭 바뀌지 않게.
  //             푸는 때 = 칸이 70%쯤 넓어졌고 새 폭 글자가 칸 안에 들어갈 때 (여백만 잘리는 건 안 보이니 봐줌)
  //   좁아질 때: 묶지 않음 — 처음부터 새(좁은) 폭으로 줄바꿈
  // 가운데 따라가기: 본문은 첫 프레임부터 '끝 자리'(새 칸 가운데)에 놓이고 칸의 보이는 가장자리만 움직인다 →
  //   애니메이션 동안 그림마다 칸의 '보이는 상자' 가운데를 재서 본문을 거기로 옮긴다 (아래 startFollow). 칸 애니메이션이 끝나면 멈춘다
  //   안 된 방법: 본문 layout="position"(옛/새 상자의 왼쪽 끝을 맞춰서 (옛 폭 − 새 폭)/2 어긋남),
  //   따로 돈 스프링 x(칸 layout 애니메이션이 몇 프레임 늦게 시작해서 어긋남)
  // 묶기는 그리기 전(useLayoutEffect)에 — 커밋 직후 첫 화면부터 옛 폭
  const cardRef = useRef<HTMLElement | null>(null)
  const articleRef = useRef<HTMLElement | null>(null)
  const box = useRef<{ card: number; w: number; pl: string; pr: string } | null>(null)
  const frozen = useRef(false)
  const releaseAt = useRef(Infinity) // 칸의 보이는 폭이 이만큼 되면 묶기를 푼다
  const unfreezeT = useRef(0)
  const remember = () => {
    const a = articleRef.current
    const c = cardRef.current
    if (!a || !c) return
    const cs = getComputedStyle(a)
    box.current = { card: c.offsetWidth, w: a.offsetWidth, pl: cs.paddingLeft, pr: cs.paddingRight }
  }
  const innerRef = useRef<HTMLDivElement | null>(null)
  const followX = useRef(0)
  const watcher = useRef<MutationObserver | null>(null)
  const stopFollow = () => {
    watcher.current?.disconnect()
    watcher.current = null
    followX.current = 0
    if (articleRef.current) articleRef.current.style.transform = ''
  }
  // 칸의 보이는 상자(transform 포함) 가운데로 본문을 옮긴다. 묶여 있고 칸이 충분히 넓어졌으면 먼저 풀고 잰다 (같은 그림)
  const follow = () => {
    const a = articleRef.current
    const c = cardRef.current
    if (!a || !c) return stopFollow()
    const cr = c.getBoundingClientRect()
    if (frozen.current && cr.width >= releaseAt.current) release()
    const ar = a.getBoundingClientRect()
    const natural = (ar.left + ar.right) / 2 - followX.current
    followX.current = (cr.left + cr.right) / 2 - natural
    a.style.transform = `translateX(${followX.current}px)`
  }
  // framer가 칸·안쪽 감싸개의 transform을 쓸 때마다 따라간다 (MutationObserver = 쓴 직후 마이크로태스크, 그리기 전).
  //   framer는 프레임 루프 말고도 다시 그리기(커밋) 직후 마이크로태스크에서 transform을 바로 쓴다 — 첫 프레임, 그리고
  //   애니메이션 도중 다른 칸의 본문이 도착해 다시 그릴 때. 프레임 루프(postRender)에 걸었더니 그 그림을 놓쳐 한 프레임씩 튀었다
  const startFollow = () => {
    if (!watcher.current) {
      const w = new MutationObserver(() => follow())
      for (const el of [cardRef.current, innerRef.current]) if (el) w.observe(el, { attributes: true, attributeFilter: ['style'] })
      watcher.current = w
    }
    follow()
  }
  const release = () => {
    releaseAt.current = Infinity
    const a = articleRef.current
    if (!frozen.current || !a) return
    frozen.current = false
    for (const k of ['width', 'maxWidth', 'marginLeft', 'marginRight', 'paddingLeft', 'paddingRight'] as const) a.style[k] = ''
    remember()
  }
  // 칸 애니메이션 끝 — 따라가기를 멈추고, 아직 묶여 있으면 (도중에 들어갈 자리가 안 났으면) 여기서 푼다
  const unfreeze = () => {
    clearTimeout(unfreezeT.current)
    stopFollow()
    release()
  }
  useLayoutEffect(() => {
    const a = articleRef.current
    const c = cardRef.current
    if (!a || !c || frozen.current) return
    const prev = box.current
    // offsetWidth는 transform(layout 애니메이션)과 상관없는 진짜 폭 — 스크롤바가 생겨 안쪽만 좁아진 건 무시
    if (prev && Math.abs(prev.card - c.offsetWidth) > 1) {
      // 움직임 줄이기(OS 설정)면 칸도 바로 바뀐다 — 묶지도 따라가지도 않음
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return remember()
      startFollow()
      clearTimeout(unfreezeT.current)
      unfreezeT.current = window.setTimeout(unfreeze, 1200) // 칸 애니메이션이 안 일어난 경우(창 크기 등) 대비
      // a.offsetWidth = 묶지 않았을 때의 새 폭 (커밋 직후, 그리기 전). 좁아지면 묶지 않는다
      if (a.offsetWidth <= prev.w + 1) return remember() // 좁아짐: 묶지 않음 (따라가기만)
      // 새 폭 본문은 칸 가운데에 놓이니 한쪽으로 (본문 − 칸)/2 삐져나온다 — 그게 여백 − EDGE 안이면 글자는 칸 안
      const cs = getComputedStyle(a)
      const slack = 2 * Math.max(0, Math.min(parseFloat(cs.paddingLeft), parseFloat(cs.paddingRight)) - EDGE)
      releaseAt.current = Math.max(prev.card + 0.7 * (c.offsetWidth - prev.card), a.offsetWidth - slack)
      frozen.current = true
      Object.assign(a.style, {
        width: `${prev.w}px`,
        maxWidth: 'none',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: prev.pl,
        paddingRight: prev.pr,
      })
      return
    }
    remember()
  })
  useEffect(
    () => () => {
      clearTimeout(unfreezeT.current)
      watcher.current?.disconnect()
    },
    [],
  )
  // 카드 ref는 둘에게 — 내 측정용 + AnimatePresence(popLayout)가 넘긴 것
  const setCard = useCallback(
    (el: HTMLElement | null) => {
      cardRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )

  const meta = ix.docsById.get(p.docId)
  const n = view.tabs.length
  const hasRel = n > 0
  const backTo = slot === 'rel' ? (view.active > 0 ? view.tabs[view.active - 1] : view.main) : null
  const title = doc?.title ?? meta?.title ?? ''

  const header = (
    <div className={cx(styles.header, spy.title ? 'border-line' : 'border-transparent')}>
      {p.onMenu && (
        <button type="button" className={styles.iconBtn} onClick={p.onMenu} aria-label="목록 열기" data-tt="목록 열기" data-menu>
          <Menu size={18} />
        </button>
      )}
      {backTo && p.phone && (
        <button type="button" className={styles.back} onClick={() => dispatch({ type: 'back' })} data-tt="이 탭 닫고 한 단계 전 글로">
          <ChevronLeft size={15} className="shrink-0" aria-hidden />
          <span className="truncate">{ix.docsById.get(backTo)?.title}</span>
        </button>
      )}
      {hasRel && !p.phone && (
        <span className={cx(styles.lane, p.focused ? styles.laneFocus : styles.laneIdle)} data-lane>
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
      {doc && (
        <button type="button" className={styles.iconBtn} onClick={openFind} aria-label="이 글에서 찾기" data-tt="이 글에서 찾기 (Ctrl+F)" data-find-open>
          <Search size={15} />
        </button>
      )}
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
        ref={articleRef}
        className={cx(styles.page, '[&_figure_img]:cursor-zoom-in')}
        onClick={(e) => {
          // 본문 그림 누르면 크게 (북마크 카드 그림은 링크라 제외)
          const img = (e.target as HTMLElement).closest('img')
          if (img && img.closest('figure') && !img.closest('a')) p.onZoom({ src: img.currentSrc || img.src, alt: img.alt })
        }}
      >
        <button type="button" className={styles.kick} onClick={() => p.onReveal(doc.id)} data-tt="사이드바 트리에서 보기" data-nofind>
          <Folder size={13} className="shrink-0" aria-hidden />
          <span className="truncate">{col?.path.join(' › ')}</span>
        </button>
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
            <button type="button" className={styles.count} onClick={() => scrollToAnchor(`links-in-${slot}`)} data-tt={`이 글을 가리키는 글 ${bl.length}개`} data-count="in">
              <ArrowDownLeft size={14} aria-hidden />
              {bl.length}
            </button>
          )}
          {ol.length > 0 && (
            <button type="button" className={styles.count} onClick={() => scrollToAnchor(`links-out-${slot}`)} data-tt={`이 글이 가리키는 글 ${ol.length}개`} data-count="out">
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
      className={cx(styles.card, p.half ? styles.half : styles.grow, !p.phone && styles.edge)}
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
          {header}
          {find > 0 && doc && <FindBar slot={slot} rootRef={articleRef} scrollRef={scrollRef} ready={doc} focusN={find} onClose={() => setFind(0)} />}
          <div className="relative flex min-h-0 flex-1">
            <div className={styles.scroll} ref={scrollRef} onScroll={onScroll} data-scroll>
              {page}
            </div>
            {heads.length >= 2 && <Toc heads={heads} current={spy.heading} onGo={scrollToAnchor} />}
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
          <i key={h.anchor} className={cx('block h-0.5 rounded-sm', h.anchor === current ? 'bg-slate-700' : 'bg-slate-300')} style={{ width: TOC_W[h.level - minLv] }} />
        ))}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            {...popIn}
            className="absolute right-0 top-0 max-h-[min(62vh,480px)] w-[min(264px,calc(100cqw-32px))] overflow-auto rounded-lg border border-line bg-page p-1.5 shadow-pop"
            data-toc-panel
          >
            {heads.map((h) => (
              <button
                key={h.anchor}
                type="button"
                className={cx(
                  'block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors hover:bg-hover hover:text-slate-900',
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
  card: 'flex min-w-0 flex-col gap-1 rounded-lg border border-line px-4 py-3 transition-colors hover:border-slate-300 hover:bg-hover',
  k: 'flex items-center gap-1.5 text-[12.5px] text-slate-500',
  t: 'line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900',
  xc: 'w-fit whitespace-nowrap text-[11.5px] text-slate-400', // 다른 컬렉션 — 알약 대신 흐린 글자
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

const rr = {
  row: 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5',
  live: 'transition-colors hover:bg-hover',
  dead: 'cursor-not-allowed',
  t: 'min-w-0 flex-1 truncate text-[14.5px]',
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
      <DocLink key={id} id={id} onGo={() => dispatch({ type: 'link', id })} className={cx(rr.row, rr.live)} data-rr>
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
      {bl.length > 0 && group(`links-in-${slot}`, <ArrowDownLeft size={13} aria-hidden />, '이 글을 가리키는 글', bl.length, bl.map(row))}
      {ol.length > 0 && group(`links-out-${slot}`, <ArrowUpRight size={13} aria-hidden />, '이 글이 가리키는 글', ol.length, ol.map(edgeRow))}
      {sa.length > 0 && group(`links-sa-${slot}`, <Link2 size={13} aria-hidden />, '함께 볼 글', sa.length, sa.map(edgeRow))}
    </section>
  )
}
