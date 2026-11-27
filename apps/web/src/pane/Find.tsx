import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { FIND_SEP, matchSpans } from '../core/search'
import type { Slot } from '../core/view'
import { useKeyDown } from '../hooks/useKeys'
import { IconButton } from '../ui/IconButton'

// 칸 안 찾기 (11-27) — 펼친 글 하나에서만 찾는다. 브라우저 Ctrl+F는 두 칸·사이드바를 한꺼번에 뒤진다
//   열기: 칸 머리 돋보기, 또는 지금 보는 칸에서 Ctrl/⌘+F (찾기 칸에 글자 커서가 있을 때 한 번 더 누르면 브라우저 찾기)
//   사이드바 찾기칸에서 고른 글은 그 검색어로 켜진 채 열린다(글자 커서는 안 넣음 — 폰 키보드·j/k). 본문에서 찾았으면 그 헤딩 아래 첫 일치부터
//   Enter = 다음, Shift+Enter = 이전, Esc = 닫기. 사이드바 찾기와 같은 규칙(띄어쓰기·대소문자 무시, core/search matchSpans), 문단·항목 경계는 넘지 않는다
//   찾는 곳: 제목 + 본문 블록. 컬렉션 이름·날짜 줄·글 끝(이전/다음·연결 목록)·버튼 글자는 뺀다 (data-nofind, footer, button)
// 칠하기는 CSS Custom Highlight API — 본문 DOM(React가 그린 것)은 그대로 두고 Range만 등록한다.
//   <mark>로 감싸면 React가 모르는 노드가 생겨 다음 그리기에서 깨진다. 이름이 칸마다 따로(find-main / find-rel) — index.css

const BLOCK = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'PRE', 'BLOCKQUOTE', 'FIGCAPTION', 'SUMMARY', 'DT', 'DD', 'DIV', 'SECTION', 'ARTICLE', 'DETAILS'])
const MAX = 999
const supported = typeof CSS !== 'undefined' && 'highlights' in CSS

interface Seg {
  node: Text
  start: number // 이어 붙인 글자에서 이 글자 조각이 시작하는 자리
}

// 본문 글자 조각을 차례로 이어 붙인다. 글 덩어리(문단·항목·칸…)가 바뀌면 FIND_SEP을 끼워 경계를 넘는 일치를 막는다
function textIndex(root: HTMLElement): { text: string; segs: Seg[] } {
  const segs: Seg[] = []
  let text = ''
  let last: Element | null = null
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeValue && n.parentElement && !n.parentElement.closest('[data-nofind], footer, button, [aria-hidden="true"]')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let b: Element | null = n.parentElement
    while (b && b !== root && !BLOCK.has(b.tagName)) b = b.parentElement
    if (b !== last && text) text += FIND_SEP
    last = b
    segs.push({ node: n as Text, start: text.length })
    text += n.nodeValue
  }
  return { text, segs }
}

export function findRanges(root: HTMLElement, query: string): Range[] {
  if (!query) return []
  const { text, segs } = textIndex(root)
  if (!segs.length) return []
  // 그 자리를 품은 조각: start ≤ i 인 마지막 조각 (끝 자리는 start < i)
  const segAt = (i: number, end: boolean) => {
    let lo = 0
    let hi = segs.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (end ? segs[mid].start < i : segs[mid].start <= i) lo = mid
      else hi = mid - 1
    }
    return segs[lo]
  }
  return matchSpans(text, query, MAX).map(([i, j]) => {
    const a = segAt(i, false)
    const b = segAt(j, true)
    const r = document.createRange()
    r.setStart(a.node, i - a.start)
    r.setEnd(b.node, j - b.start)
    return r
  })
}

// 지금 보이는 곳부터 — 화면 위쪽 끝 아래에 있는 첫 일치 (없으면 처음)
function firstFrom(ranges: Range[], sc: HTMLElement | null) {
  if (!sc) return 0
  const top = sc.getBoundingClientRect().top
  const i = ranges.findIndex((r) => r.getBoundingClientRect().bottom > top)
  return Math.max(0, i)
}

// 일치가 보이게 — 접힌 콜아웃이면 열고, 칸 밖이면 1/3 지점으로, 가로로 넘치는 코드·표 안이면 가로로도
function reveal(r: Range, sc: HTMLElement) {
  let opened = false
  for (let d = r.startContainer.parentElement?.closest('details'); d; d = d.parentElement?.closest('details')) {
    if (!d.open) {
      d.open = true
      opened = true
    }
  }
  const go = () => {
    const rect = r.getBoundingClientRect()
    const box = sc.getBoundingClientRect()
    if (rect.top < box.top + 40 || rect.bottom > box.bottom - 24) sc.scrollTop += rect.top - box.top - box.height / 3
    for (let el = r.startContainer.parentElement; el && el !== sc; el = el.parentElement) {
      if (el.scrollWidth <= el.clientWidth + 1) continue
      const ox = getComputedStyle(el).overflowX
      if (ox !== 'auto' && ox !== 'scroll') continue
      const xb = el.getBoundingClientRect()
      const now = r.getBoundingClientRect()
      if (now.left < xb.left + 8 || now.right > xb.right - 8) el.scrollLeft += now.left - xb.left - xb.width / 3
      break
    }
  }
  // 콜아웃이 열리는 높이 애니메이션 뒤에 잰다
  if (opened) setTimeout(go, 220)
  else go()
}

interface Props {
  slot: Slot
  rootRef: RefObject<HTMLElement>
  scrollRef: RefObject<HTMLElement>
  ready: unknown // 본문이 바뀌면(받아 옴) 다시 찾는다
  seed: FindSeed // 열 때마다 새 값 — 검색어가 있으면 그걸로, focus면 찾기 칸에 글자 커서 + 전체 선택
  onClose: () => void
}

export function FindBar({ slot, rootRef, scrollRef, ready, seed, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(seed.query ?? '')
  const [ranges, setRanges] = useState<Range[]>([])
  const [cur, setCur] = useState(0)

  useEffect(() => {
    if (seed.query !== undefined) setQuery(seed.query)
    if (!seed.focus) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [seed])

  useEffect(() => {
    const root = rootRef.current
    const rs = root ? findRanges(root, query) : []
    setRanges(rs)
    setCur(firstFrom(rs, scrollRef.current))
  }, [query, ready, rootRef, scrollRef])

  // 칠하기 — 지금 일치는 진하게(우선순위 높게)
  useEffect(() => {
    if (!supported) return
    const all = new Highlight(...ranges)
    const now = new Highlight(...(ranges[cur] ? [ranges[cur]] : []))
    now.priority = 1
    const names = [`find-${slot}`, `find-now-${slot}`]
    CSS.highlights.set(names[0], all)
    CSS.highlights.set(names[1], now)
    return () => {
      // 같은 자리(slot)의 다른 칸(나가는 중인 칸 ↔ 들어온 칸)이 등록한 건 지우지 않는다
      if (CSS.highlights.get(names[0]) === all) CSS.highlights.delete(names[0])
      if (CSS.highlights.get(names[1]) === now) CSS.highlights.delete(names[1])
    }
  }, [ranges, cur, slot])

  useEffect(() => {
    const r = ranges[cur]
    if (r && scrollRef.current) reveal(r, scrollRef.current)
  }, [ranges, cur, scrollRef])

  const n = ranges.length
  const move = (d: number) => n && setCur((c) => (c + d + n) % n)

  return (
    <div className="flex h-10 max-[720px]:h-12 shrink-0 items-center gap-0.5 border-b border-line pl-3 pr-2" data-find={slot}>
      <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            move(e.shiftKey ? -1 : 1)
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
        placeholder="이 글에서 찾기"
        aria-label="이 글에서 찾기"
        className="h-8 min-w-0 flex-1 bg-transparent px-2 text-[13px] max-[720px]:text-base text-slate-900 outline-none placeholder:text-slate-400"
        data-find-input
      />
      <span className="shrink-0 px-1.5 text-[12px] tabular-nums text-slate-400" aria-live="polite" data-find-count>
        {n ? `${cur + 1}/${n}${n >= MAX ? '+' : ''}` : query ? '없음' : ''}
      </span>
      <IconButton label="이전 찾은 곳" tip="이전 (Shift+Enter)" onClick={() => move(-1)} disabled={n < 2}>
        <ChevronUp size={16} />
      </IconButton>
      <IconButton label="다음 찾은 곳" tip="다음 (Enter)" onClick={() => move(1)} disabled={n < 2}>
        <ChevronDown size={16} />
      </IconButton>
      <IconButton label="찾기 닫기" tip="닫기 (Esc)" onClick={onClose}>
        <X size={15} />
      </IconButton>
    </div>
  )
}

// 찾기 줄 열고 닫기 — 칸 머리 돋보기, 지금 보는 칸에서 Ctrl/⌘+F, 사이드바 찾기칸에서 고른 글(검색어 채움·커서 없음).
// 찾기 칸에 글자 커서가 있으면 그 Ctrl+F는 브라우저에 맡긴다
//   seed.n: 0 = 닫힘, 그 밖 = 열 때마다 늘어남
export interface FindSeed {
  n: number
  query?: string // 없으면 칸에 있던 글자 그대로
  focus: boolean
}
export function useFind(focused: boolean, ready: boolean) {
  const [seed, setSeed] = useState<FindSeed>({ n: 0, focus: true })
  const open = useCallback((query?: string, focus = true) => setSeed((s) => ({ n: s.n + 1, query, focus })), [])
  const close = useCallback(() => setSeed({ n: 0, focus: true }), [])
  useKeyDown((e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return
    if ((document.activeElement as HTMLElement | null)?.dataset.findInput !== undefined) return
    e.preventDefault()
    open()
  }, focused && ready)
  return { seed, open, close }
}
