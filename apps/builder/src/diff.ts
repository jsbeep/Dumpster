import type { Doc, Edge, Graph } from '@dumpster/schema'

// 이전 빌드(graph.json)와 이번 빌드 비교 — 증분 빌드는 안 한다(매번 전체가 빠르고 결정적). 대신 뭐가 바뀌었는지만 알려준다.
// 특히 '새로 공개'는 배포 전에 눈으로 확인하는 안전장치.
// 결과는 콘솔(로컬)에만. 사라진 글 제목이 들어 있으니 결과물에 넣지 않는다.

export interface DocRef {
  id: string
  title: string
  collectionId: string
}

export interface GraphDiff {
  first: boolean // 비교할 이전 결과가 없음
  added: DocRef[] // 새로 공개
  removed: DocRef[] // 사라짐 (삭제 · 비공개 폴더로 이동 · draft · 공개 목록에서 뺌)
  changed: (DocRef & { what: string[] })[]
  // 같은 컬렉션·같은 제목인데 ID가 바뀐 글 — 옛 글에 oid를 새로 달았을 때. 추가+삭제로 보이면 헷갈리니 따로 묶는다.
  // what은 ID 말고 바뀐 것 (없으면 빈 배열)
  reidentified: (DocRef & { from: string; what: string[] })[]
  unchanged: number
}

const ref = (d: Doc): DocRef => ({ id: d.id, title: d.title, collectionId: d.collectionId })
const props = (d: Doc) => JSON.stringify([d.kind, d.order, d.tags, d.aliases, d.description, d.createdAt])

// 글마다 나가는 엣지 요약. 대상은 ID로 비교하되, 이전 그래프의 ID는 canon으로 이번 ID에 맞춘다
// (그래야 이름만 바꾼 글을 가리키는 글, oid를 새로 단 글을 가리키는 글이 '바뀜'으로 안 잡힌다)
function edgeSummary(graph: Graph, canon: (id: string) => string): Map<string, { prev: string; links: string }> {
  const bySource = new Map<string, Edge[]>()
  for (const e of graph.edges) bySource.set(e.source, [...(bySource.get(e.source) ?? []), e])
  const out = new Map<string, { prev: string; links: string }>()
  for (const [source, edges] of bySource) {
    const sig = (e: Edge) => `${e.relation}:${e.target ? canon(e.target) : `?${e.targetLabel}`}`
    out.set(source, {
      prev: edges.filter((e) => e.relation === 'prev').map(sig).join('|'),
      links: edges.filter((e) => e.relation !== 'prev').map(sig).sort().join('|'),
    })
  }
  return out
}

export function diffGraphs(prev: Graph | null, next: Graph): GraphDiff {
  const diff: GraphDiff = { first: !prev, added: [], removed: [], changed: [], reidentified: [], unchanged: 0 }
  if (!prev) {
    diff.added = next.docs.map(ref)
    return diff
  }

  const before = new Map(prev.docs.map((d) => [d.id, d]))
  const after = new Map(next.docs.map((d) => [d.id, d]))

  // 1. ID가 바뀐 같은 글 짝 찾기 (사라진 글 ↔ 새 글, 같은 컬렉션·같은 제목)
  const fresh = next.docs.filter((d) => !before.has(d.id))
  const renamedTo = new Map<string, Doc>() // 옛 ID → 새 문서
  for (const old of prev.docs) {
    if (after.has(old.id)) continue
    const i = fresh.findIndex((d) => d.collectionId === old.collectionId && d.title === old.title)
    if (i === -1) diff.removed.push(ref(old))
    else renamedTo.set(old.id, fresh.splice(i, 1)[0])
  }
  diff.added = fresh.map(ref)

  // 2. 내용 비교 (이전 쪽의 ID는 이번 ID로 맞춘 뒤 — 엣지 대상, 본문 링크의 docId 둘 다)
  const canon = (id: string) => renamedTo.get(id)?.id ?? id
  const edgesBefore = edgeSummary(prev, canon)
  const edgesAfter = edgeSummary(next, (id) => id)
  const blocksOf = (d: Doc, map: (id: string) => string) =>
    JSON.stringify(d.blocks).replace(/"docId":"([^"]+)"/g, (_, id: string) => `"docId":"${map(id)}"`)
  const compare = (old: Doc, d: Doc): string[] => {
    const what: string[] = []
    if (old.title !== d.title) what.push(`제목 (${old.title} →)`)
    if (old.collectionId !== d.collectionId) what.push('컬렉션')
    if (blocksOf(old, canon) !== JSON.stringify(d.blocks)) what.push('본문')
    if (props(old) !== props(d)) what.push('속성')
    const eb = edgesBefore.get(old.id)
    const ea = edgesAfter.get(d.id)
    if ((eb?.prev ?? '') !== (ea?.prev ?? '')) what.push('prev')
    if ((eb?.links ?? '') !== (ea?.links ?? '')) what.push('링크')
    return what
  }

  for (const d of next.docs) {
    const old = before.get(d.id)
    if (!old) continue
    const what = compare(old, d)
    if (what.length) diff.changed.push({ ...ref(d), what })
    else diff.unchanged++
  }
  for (const [from, d] of renamedTo) diff.reidentified.push({ ...ref(d), from, what: compare(before.get(from)!, d) })
  return diff
}
