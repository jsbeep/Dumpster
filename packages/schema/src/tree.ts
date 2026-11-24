import type { Collection, Doc, Edge, Graph } from './graph'

// prev 트리 인덱스 — graph.json을 로드한 직후 한 번 만들고, 탐색기 컬럼·빌더 CLI·테스트가 같이 읽는다.
//
// 트리 그리는 규칙 (docs/design.md §3)
//   1. 자식이 1개 → 같은 깊이로 이어 그린다
//   2. 자식이 2개 이상 → 갈래 전부 한 칸 들여쓴다 (본류 없음)
//   3. 형제 정렬: order → createdAt → 이름
//   4. 루트는 매니페스트. 매니페스트가 있으면 prev 없는 일반 글은 '연결 안 됨'
//   5. prev가 다른 컬렉션 글이면 이 컬렉션 안에선 루트로 그리고 continuesFrom에 출처를 적는다

export type OrphanReason = 'no-prev' | 'broken-prev' | 'cycle' | 'detached'

export const ORPHAN_LABEL: Record<OrphanReason, string> = {
  'no-prev': 'prev 없음',
  'broken-prev': 'prev 대상 없음',
  cycle: 'prev 순환',
  detached: '순환에 매달린 글',
}

export interface TreeRow {
  docId: string
  guides: boolean[] // 앞쪽 들여쓰기 칸마다 세로선(│)을 그을지
  branch: 'none' | 'mid' | 'last' // 갈래의 첫 글이면 mid(├─) / last(└─)
  depth: number // 거쳐 온 분기점 수
  forks: number // 이 컬렉션 안에서 이 글을 prev로 둔 글 수 (2 이상이면 분기점)
  root: boolean // 한 덩어리의 시작 행 (매니페스트, 다른 컬렉션에서 이어진 글, 연결 안 됨 덩어리)
  continuesFrom: string | null // prev가 다른 컬렉션 글이면 그 글 ID
  orphan: OrphanReason | null // 연결 안 됨 덩어리의 시작 행에만
}

export interface CollectionTree {
  collectionId: string
  rows: TreeRow[]
  orphans: TreeRow[]
}

export interface GraphIndex {
  graph: Graph
  docsById: Map<string, Doc>
  collectionsById: Map<string, Collection>
  docsByCollection: Map<string, Doc[]>
  // prev 엣지가 있는 문서만 키가 있다. 값 null = prev 대상이 없거나 비공개
  prevOf: Map<string, string | null>
  // prev 역참조(= 다음 글들). 컬렉션 상관없이, 형제 정렬 순서
  nextOf: Map<string, Doc[]>
  outgoing: Map<string, Edge[]>
  incoming: Map<string, Edge[]>
  tree(collectionId: string): CollectionTree
  // 같은 컬렉션 안에서 루트 → 부모 순서의 조상 ID (자기 제외). URL 복원·접힌 분기 펼치기용
  ancestors(docId: string): string[]
}

const time = (iso: string) => Date.parse(iso) || 0

export function compareSiblings(a: Doc, b: Doc): number {
  if (a.order !== null && b.order !== null && a.order !== b.order) return a.order < b.order ? -1 : 1
  if (a.order !== null && b.order === null) return -1
  if (a.order === null && b.order !== null) return 1
  return time(a.createdAt) - time(b.createdAt) || a.title.localeCompare(b.title, 'ko')
}

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function buildGraphIndex(graph: Graph): GraphIndex {
  const docsById = new Map(graph.docs.map((d) => [d.id, d]))
  const collectionsById = new Map(graph.collections.map((c) => [c.id, c]))

  const docsByCollection = new Map<string, Doc[]>()
  for (const doc of graph.docs) push(docsByCollection, doc.collectionId, doc)

  const outgoing = new Map<string, Edge[]>()
  const incoming = new Map<string, Edge[]>()
  const prevOf = new Map<string, string | null>()
  const nextOf = new Map<string, Doc[]>()
  for (const edge of graph.edges) {
    push(outgoing, edge.source, edge)
    if (edge.target !== null) push(incoming, edge.target, edge)
    if (edge.relation !== 'prev' || prevOf.has(edge.source)) continue
    const target = edge.target !== null && docsById.has(edge.target) ? edge.target : null
    prevOf.set(edge.source, target)
    const source = docsById.get(edge.source)
    if (target !== null && source) push(nextOf, target, source)
  }
  for (const list of nextOf.values()) list.sort(compareSiblings)

  const trees = new Map<string, CollectionTree>()

  function buildTree(collectionId: string): CollectionTree {
    const collection = collectionsById.get(collectionId)
    const docs = [...(docsByCollection.get(collectionId) ?? [])].sort(compareSiblings)
    const inCollection = new Set(docs.map((d) => d.id))
    const visited = new Set<string>()

    function walk(doc: Doc, out: TreeRow[], guides: boolean[], branch: TreeRow['branch'], head: Partial<TreeRow> = {}) {
      if (visited.has(doc.id)) return
      visited.add(doc.id)
      const children = (nextOf.get(doc.id) ?? []).filter((c) => inCollection.has(c.id) && !visited.has(c.id))
      out.push({
        docId: doc.id,
        guides,
        branch,
        depth: guides.length + (branch === 'none' ? 0 : 1),
        forks: children.length,
        root: false,
        continuesFrom: null,
        orphan: null,
        ...head,
      })
      const next = branch === 'mid' ? [...guides, true] : branch === 'last' ? [...guides, false] : guides
      if (children.length === 1) walk(children[0], out, next, 'none')
      else children.forEach((c, i) => walk(c, out, next, i === children.length - 1 ? 'last' : 'mid'))
    }

    const manifest = collection?.manifestId ? docsById.get(collection.manifestId) : undefined
    const notManifest = (d: Doc) => d.id !== manifest?.id
    const noPrev = docs.filter((d) => notManifest(d) && !prevOf.has(d.id))
    const brokenPrev = docs.filter((d) => notManifest(d) && prevOf.get(d.id) === null)
    const crossRoots = docs.filter((d) => {
      const prev = prevOf.get(d.id)
      return notManifest(d) && typeof prev === 'string' && !inCollection.has(prev)
    })

    // --- 본 트리 ---
    const rows: TreeRow[] = []
    if (manifest) walk(manifest, rows, [], 'none', { root: true })
    else for (const d of noPrev) walk(d, rows, [], 'none', { root: true })
    for (const d of crossRoots) walk(d, rows, [], 'none', { root: true, continuesFrom: prevOf.get(d.id) ?? null })

    // --- 연결 안 됨: 덩어리(시작 글 + 그 아래)별로 모았다가 시작 글 기준으로 정렬 ---
    const groups: { head: Doc; rows: TreeRow[] }[] = []
    const addGroup = (head: Doc, reason: OrphanReason, flat = false) => {
      const out: TreeRow[] = []
      if (flat) {
        visited.add(head.id)
        out.push({ docId: head.id, guides: [], branch: 'none', depth: 0, forks: 0, root: true, continuesFrom: null, orphan: reason })
      } else walk(head, out, [], 'none', { root: true, orphan: reason })
      if (out.length) groups.push({ head, rows: out })
    }
    if (manifest) for (const d of noPrev) addGroup(d, 'no-prev')
    for (const d of brokenPrev) addGroup(d, 'broken-prev')

    // 남은 글 = 순환에 갇혔거나 순환에 매달린 글. 순환 고리는 평평하게, 매달린 글은 그 아래 덩어리째
    const rest = docs.filter((d) => !visited.has(d.id))
    const inCycle = new Set<string>()
    for (const d of rest) {
      const path: string[] = []
      let cur: string | null | undefined = d.id
      while (typeof cur === 'string' && inCollection.has(cur) && !visited.has(cur) && !path.includes(cur)) {
        path.push(cur)
        cur = prevOf.get(cur)
      }
      if (typeof cur === 'string' && path.includes(cur)) for (const id of path.slice(path.indexOf(cur))) inCycle.add(id)
    }
    for (const d of rest) if (inCycle.has(d.id)) addGroup(d, 'cycle', true)
    // 부모가 이미 그려진 글(= 순환 고리 바로 아래)부터 덩어리로 — 그래야 자식이 따로 떨어지지 않는다
    for (const d of docs) {
      const prev = prevOf.get(d.id)
      if (!visited.has(d.id) && typeof prev === 'string' && visited.has(prev)) addGroup(d, 'detached')
    }
    for (const d of docs) if (!visited.has(d.id)) addGroup(d, 'detached')

    groups.sort((a, b) => compareSiblings(a.head, b.head))
    return { collectionId, rows, orphans: groups.flatMap((g) => g.rows) }
  }

  return {
    graph,
    docsById,
    collectionsById,
    docsByCollection,
    prevOf,
    nextOf,
    outgoing,
    incoming,
    tree(collectionId) {
      let tree = trees.get(collectionId)
      if (!tree) trees.set(collectionId, (tree = buildTree(collectionId)))
      return tree
    },
    ancestors(docId) {
      const collectionId = docsById.get(docId)?.collectionId
      const chain: string[] = []
      const seen = new Set([docId])
      let cur = prevOf.get(docId)
      while (typeof cur === 'string' && !seen.has(cur) && docsById.get(cur)?.collectionId === collectionId) {
        chain.unshift(cur)
        seen.add(cur)
        cur = prevOf.get(cur)
      }
      return chain
    },
  }
}

// CLI·테스트용 텍스트 렌더. 탐색기는 같은 TreeRow로 진짜 UI를 그린다
export function treeToText(index: GraphIndex, collectionId: string): string {
  const tree = index.tree(collectionId)
  const title = (id: string) => index.docsById.get(id)?.title ?? id
  const line = (row: TreeRow) => {
    const prefix = row.guides.map((g) => (g ? '│ ' : '  ')).join('')
    const connector = row.branch === 'mid' ? '├─' : row.branch === 'last' ? '└─' : ''
    const from = row.continuesFrom ? `  ↰ ${title(row.continuesFrom)}` : ''
    const orphan = row.orphan ? `  ⚠ ${ORPHAN_LABEL[row.orphan]}` : ''
    return `${prefix}${connector}● ${title(row.docId)}${from}${orphan}`
  }
  const lines = tree.rows.map(line)
  if (tree.orphans.length) lines.push('── 연결 안 됨 ──', ...tree.orphans.map(line))
  return lines.join('\n')
}
