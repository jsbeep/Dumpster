import type { Edge, GraphIndex, Relation } from '@dumpster/schema'

// 글 끝 목록 · 트리 ↙/↗ · 이전/다음 카드가 쓰는 그래프 계산 (design.md §3) — 순수 함수, 화면 없이 테스트한다.
// prev는 트리 뼈대라 '가리키는 글'에 안 넣는다. branch는 옛 스키마 호환 → see_also와 같이 '함께 볼 글'

const POINTING: Relation[] = ['link', 'embed', 'see_also', 'branch']

export function sameCollection(ix: GraphIndex, a: string, b: string): boolean {
  const x = ix.docsById.get(a)
  const y = ix.docsById.get(b)
  return !!x && !!y && x.collectionId === y.collectionId
}

const titleOf = (ix: GraphIndex, id: string) => ix.docsById.get(id)?.title ?? ''

// 이 글을 가리키는 글 — 같은 컬렉션 먼저, 그다음 제목순
export function backlinks(ix: GraphIndex, id: string): string[] {
  const found = new Set<string>()
  for (const e of ix.incoming.get(id) ?? []) {
    if (POINTING.includes(e.relation) && e.source !== id && ix.docsById.has(e.source)) found.add(e.source)
  }
  return [...found].sort(
    (a, b) =>
      Number(sameCollection(ix, b, id)) - Number(sameCollection(ix, a, id)) ||
      titleOf(ix, a).localeCompare(titleOf(ix, b), 'ko'),
  )
}

// 내보내는 엣지 — 같은 대상은 한 번만. 대상이 없는(없는·비공개) 글은 원문 이름으로 따로 센다
function outEdges(ix: GraphIndex, id: string, rels: Relation[]): Edge[] {
  const seen = new Set<string>()
  const result: Edge[] = []
  for (const e of ix.outgoing.get(id) ?? []) {
    if (!rels.includes(e.relation) || e.target === id) continue
    const key = e.target ?? `?${e.targetLabel}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(e)
  }
  return result
}

export const outLinks = (ix: GraphIndex, id: string) => outEdges(ix, id, ['link', 'embed'])
export const seeAlso = (ix: GraphIndex, id: string) => outEdges(ix, id, ['see_also', 'branch'])

// 트리 행 오른쪽 ↙(이 글을 가리킴) / ↗(이 글이 가리킴) — 지금 보는 글 기준
export interface LinkMark {
  in: boolean
  out: boolean
}
export function linkMarks(ix: GraphIndex, focus: string | null): Map<string, LinkMark> {
  const marks = new Map<string, LinkMark>()
  if (!focus) return marks
  const mark = (id: string) => {
    let m = marks.get(id)
    if (!m) marks.set(id, (m = { in: false, out: false }))
    return m
  }
  for (const e of ix.outgoing.get(focus) ?? []) {
    if (POINTING.includes(e.relation) && e.target && e.target !== focus) mark(e.target).out = true
  }
  for (const e of ix.incoming.get(focus) ?? []) {
    if (POINTING.includes(e.relation) && e.source !== focus) mark(e.source).in = true
  }
  return marks
}

// 같은 컬렉션 안에서 이 글 아래로 이어지는 글 전부 (접은 갈래에 숨는 글)
export function descendants(ix: GraphIndex, id: string): string[] {
  const result: string[] = []
  const seen = new Set([id])
  const queue = [...(ix.nextOf.get(id) ?? [])].map((d) => d.id)
  while (queue.length) {
    const x = queue.shift()!
    if (seen.has(x) || !sameCollection(ix, x, id)) continue
    seen.add(x)
    result.push(x)
    for (const d of ix.nextOf.get(x) ?? []) queue.push(d.id)
  }
  return result
}

// 갈래 카드에 적는 요약: 이 갈래의 글 수 · 그 안의 분기점 수 · 다른 컬렉션으로 넘어가는 곳
export interface BranchInfo {
  count: number
  forks: number
  exits: string[] // 컬렉션 ID
}
export function branchInfo(ix: GraphIndex, head: string): BranchInfo {
  const all = [head, ...descendants(ix, head)]
  let forks = 0
  const exits = new Set<string>()
  for (const x of all) {
    const nexts = ix.nextOf.get(x) ?? []
    if (nexts.filter((d) => sameCollection(ix, x, d.id)).length >= 2) forks++
    for (const d of nexts) if (!sameCollection(ix, x, d.id)) exits.add(d.collectionId)
  }
  return { count: all.length, forks, exits: [...exits] }
}
