import type { Doc, GraphIndex } from '@dumpster/schema'

// 사이드바 검색 — 제목·별칭. 띄어쓰기·대소문자 무시 ("용량부족" → "용량 부족 사태")
// 본문 전문 검색은 P4.6에서 정한다 (design.md §3 읽기 기능 후보)

export interface Hit {
  doc: Doc
  alias: string | null // 별칭으로 걸렸으면 그 별칭
}

export const normalize = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, '')

export function searchDocs(ix: GraphIndex, query: string, limit = 50): Hit[] {
  const q = normalize(query)
  if (!q) return []
  const ranked: { hit: Hit; rank: number }[] = []
  for (const doc of ix.graph.docs) {
    const t = normalize(doc.title)
    if (t.includes(q)) {
      ranked.push({ hit: { doc, alias: null }, rank: t.startsWith(q) ? 0 : 1 })
      continue
    }
    const alias = doc.aliases.find((a) => normalize(a).includes(q))
    if (alias) ranked.push({ hit: { doc, alias }, rank: 2 })
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.hit.doc.title.localeCompare(b.hit.doc.title, 'ko'))
    .slice(0, limit)
    .map((r) => r.hit)
}
