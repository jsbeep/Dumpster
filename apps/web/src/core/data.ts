import { buildGraphIndex, SCHEMA_VERSION, stampOf, stampOfDate, type Doc, type Graph, type GraphIndex } from '@dumpster/schema'

// 본문 찾기가 훑는 것 — 글마다 헤딩별 평문
export type SearchText = Pick<Doc, 'id' | 'sections'>

// graph.json 한 파일을 통째로 받는다 (11-26 결정, 실제 볼트 gzip 약 70KB).
// 글이 100편 안팎으로 늘면 본문을 글마다 나눌 수 있게 — 화면 코드는 본문을 getDoc, 찾기용 평문을 getSearchText(둘 다 async)로만 꺼낸다.
// 나눌 때는 빌더 출력과 이 파일만 고치면 된다: graph.json(메타·엣지) · 글마다 블록 · search.json(평문, 처음 찾을 때 받기)
export interface Store {
  index: GraphIndex
  // 주소에 적힌 ID → 지금 ID. 없으면 null
  resolveId(id: string): string | null
  getDoc(id: string): Promise<Doc | null>
  // 이미 받아 둔 글은 바로 (undefined = 아직 안 받음). 폰 글 바꾸기 슬라이드(View Transition)는 새 화면을 그 자리에서
  // 다 그려야 스냅샷을 찍는다 — 받는 중이면 빈 칸이 찍힌다. 글마다 나누면 getDoc이 받은 것을 여기서 돌려준다
  peekDoc(id: string): Doc | null | undefined
  getSearchText(): Promise<SearchText[]>
}

export function createStore(graph: Graph): Store {
  const index = buildGraphIndex(graph)

  // 임시 ID(`이름-yyMMddHHmm`)는 글 이름을 바꾸거나 oid를 달면 바뀐다 → 옛 공유 링크가 깨지지 않게
  // 스탬프(= 만든 시각, KST 분 단위)가 같은 글이 하나뿐이면 그 글로 찾는다. oid는 안 바뀌니 이 길을 안 탄다
  const byStamp = new Map<string, string | null>() // null = 같은 분에 만든 글이 여럿이라 못 고름
  for (const d of graph.docs) {
    const s = stampOfDate(d.createdAt)
    byStamp.set(s, byStamp.has(s) ? null : d.id)
  }

  const resolveId = (id: string): string | null => {
    if (index.docsById.has(id)) return id
    const s = stampOf(id)
    return s ? (byStamp.get(s) ?? null) : null
  }

  // 지금은 graph.json 하나에 다 있어서 늘 바로 꺼낸다 (undefined가 안 나옴)
  const peekDoc = (id: string): Doc | null => {
    const real = resolveId(id)
    return real ? (index.docsById.get(real) ?? null) : null
  }

  return {
    index,
    resolveId,
    async getDoc(id) {
      return peekDoc(id)
    },
    peekDoc,
    async getSearchText() {
      return graph.docs
    },
  }
}

export async function loadStore(url = 'graph.json', fetchImpl: typeof fetch = fetch): Promise<Store> {
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`${url}을 못 받았다 (${res.status}) — pnpm graph로 out/을 먼저 만든다`)
  const graph = (await res.json()) as Graph
  if (graph.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`graph.json 스키마 버전 ${graph.schemaVersion}, 탐색기는 ${SCHEMA_VERSION} — pnpm graph를 다시 돌린다`)
  }
  return createStore(graph)
}
