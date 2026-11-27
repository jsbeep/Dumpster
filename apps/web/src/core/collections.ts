import type { Collection, GraphIndex } from '@dumpster/schema'

// 컬렉션 계층 — 볼트 폴더 구조 그대로. graph.json의 컬렉션은 공개 폴더마다 하나씩 평평하게 있고,
// 부모 = path가 가장 길게 겹치는 공개 상위 폴더 (중간 폴더가 비공개면 그 위로 붙는다)
//   사이드바: 부모를 접으면 하위도 같이 숨는다 · 개수 = 자기 글 + 하위 컬렉션 글 전부
//   첫 화면: 최상위 컬렉션만

export interface CollectionTreeInfo {
  top: Collection[] // 부모 없는 컬렉션 (graph 순서)
  kids: Map<string, Collection[]> // 부모 ID → 바로 아래 컬렉션 (graph 순서)
  parent: Map<string, string> // 컬렉션 ID → 부모 ID (최상위는 없음)
  total: Map<string, number> // 자기 글 + 하위 컬렉션 글 전부
}

const cache = new WeakMap<GraphIndex, CollectionTreeInfo>()

export function collectionTree(ix: GraphIndex): CollectionTreeInfo {
  let info = cache.get(ix)
  if (info) return info
  const cols = ix.graph.collections
  const key = (path: string[]) => path.join('\u0000')
  const byPath = new Map(cols.map((c) => [key(c.path), c]))
  const parent = new Map<string, string>()
  const kids = new Map<string, Collection[]>()
  const top: Collection[] = []
  for (const c of cols) {
    let p: Collection | undefined
    for (let n = c.path.length - 1; n > 0 && !p; n--) p = byPath.get(key(c.path.slice(0, n)))
    if (p) {
      parent.set(c.id, p.id)
      kids.set(p.id, [...(kids.get(p.id) ?? []), c])
    } else top.push(c)
  }
  const total = new Map<string, number>()
  const count = (c: Collection): number => {
    const known = total.get(c.id)
    if (known !== undefined) return known
    const n = (ix.docsByCollection.get(c.id)?.length ?? 0) + (kids.get(c.id) ?? []).reduce((s, k) => s + count(k), 0)
    total.set(c.id, n)
    return n
  }
  cols.forEach(count)
  info = { top, kids, parent, total }
  cache.set(ix, info)
  return info
}

// 위 컬렉션들 (가까운 것부터, 자기 제외)
export function collectionAncestors(ix: GraphIndex, cid: string): string[] {
  const { parent } = collectionTree(ix)
  const out: string[] = []
  for (let p = parent.get(cid); p && !out.includes(p); p = parent.get(p)) out.push(p)
  return out
}

// cid가 root 자신이거나 그 아래 컬렉션인가
export const withinCollection = (ix: GraphIndex, root: string, cid: string) => cid === root || collectionAncestors(ix, cid).includes(root)

// 컬렉션을 눌렀을 때 열 글 — 매니페스트 → 트리 첫 줄 → 하위 컬렉션 차례로
export function firstDocOf(ix: GraphIndex, cid: string): string | null {
  const c = ix.collectionsById.get(cid)
  if (!c) return null
  if (c.manifestId && ix.docsById.has(c.manifestId)) return c.manifestId
  const row = ix.tree(cid).rows[0]?.docId
  if (row) return row
  for (const k of collectionTree(ix).kids.get(cid) ?? []) {
    const id = firstDocOf(ix, k.id)
    if (id) return id
  }
  return null
}
