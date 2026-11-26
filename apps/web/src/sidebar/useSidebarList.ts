import type { GraphIndex } from '@dumpster/schema'
import { useEffect, useRef, useState } from 'react'

// 사이드바 목록 상태 — 기록 밖 화면 상태(목록 탭·검색어·펼친 컬렉션·접은 갈래)는 사이드바만 갖는다.
//   지금 보는 칸의 글(focusDoc)이 바뀌면 그 글의 컬렉션을 펼치고, 컬렉션이 바뀌었으면 다른 건 접는다
//   '트리에서 보기'(reveal)가 오면 컬렉션 목록으로 돌아가 그 글의 컬렉션을 펼친다 (onReveal = 사이드바를 전체로 여는 쪽)
//   그린 뒤 보일 글의 행이 목록 밖이면 1/3 지점으로 (bodyRef = 목록 스크롤 상자)

export type SideTab = 'collections' | 'recent' | 'tags'

export interface RevealRequest {
  id: string
  n: number // 같은 글을 다시 보여 달라고 해도 효과가 다시 돌게
}

export interface ListState {
  query: string
  setQuery: (q: string) => void
  tab: SideTab
  setTab: (t: SideTab) => void
  tag: string | null
  setTag: (t: string | null) => void
  open: Set<string> // 펼친 컬렉션
  toggleOpen: (cid: string) => void
  only: string | null // '이 컬렉션만 보기'
  setOnly: (cid: string | null) => void
  folds: Record<string, string[]> // 컬렉션별 접은 분기점
  toggleFold: (cid: string, id: string) => void
}

export function useSidebarList(ix: GraphIndex, focusDoc: string | null, reveal: RevealRequest | null, onReveal: () => void) {
  const [query, setQuery] = useState('')
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

  // 칸 위 컬렉션 이름 · 흐름 칸으로 → 트리에서 그 글 보이기 (접혀 있으면 꺼낸다)
  useEffect(() => {
    if (!reveal) return
    const cid = ix.docsById.get(reveal.id)?.collectionId
    if (!cid) return
    setTab('collections')
    setQuery('')
    setOpen((s) => (s.has(cid) ? s : new Set(s).add(cid)))
    setOnly((o) => (o && o !== cid ? cid : o))
    scrollTo.current = reveal.id
    onReveal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ix, reveal])

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

  return { list, bodyRef }
}
