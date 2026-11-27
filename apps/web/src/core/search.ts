import type { Doc, GraphIndex } from '@dumpster/schema'
import type { SearchText } from './data'

// 사이드바 찾기 — 제목·별칭 (searchDocs) + 본문 (searchBody, P4.6b). 둘 다 띄어쓰기·대소문자 무시 ("용량부족" → "용량 부족 사태")

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

// --- 본문 찾기 ---
// 헤딩별 평문 조각(Doc.sections)을 브라우저에서 그대로 훑는다 — 색인 없이도 글 몇백 편까지는 충분 (design.md §3 읽기 기능 후보)
//   두 글자부터 (한 글자는 거의 모든 글에 걸린다). 제목으로 이미 찾은 글은 뺀다
//   한 글에 한 줄: 처음 걸린 조각의 헤딩 + 걸린 줄. 걸린 곳 수가 많은 글부터

export const BODY_MIN = 2

// 띄어쓰기를 빼고 소문자로 편 글자 + 편 글자 하나하나의 원문 자리 → 찾은 자리를 원문에서 정확히 칠한다
interface Folded {
  norm: string
  at: number[]
}
function fold(s: string): Folded {
  let norm = ''
  const at: number[] = []
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (/\s/.test(ch)) continue
    const lc = ch.toLowerCase() // 드물게 두 글자가 되는 것(İ)도 자리는 같은 원문 글자
    norm += lc
    for (let k = 0; k < lc.length; k++) at.push(i)
  }
  return { norm, at }
}
const foldQuery = (q: string) => fold(q.normalize('NFC')).norm

interface Piece {
  anchor: string | null
  heading: string | null
  full: string // 헤딩 줄 + 본문 (헤딩 글자로도 찾는다)
  folded: Folded
}
export interface Corpus {
  docs: { id: string; pieces: Piece[] }[]
}

// 받은 평문을 한 번만 편다 — 글자 칠 때마다 다시 펴지 않게
export function prepareCorpus(texts: SearchText[]): Corpus {
  return {
    docs: texts.map(({ id, sections }) => ({
      id,
      pieces: sections.map(({ anchor, text, ...s }) => {
        const heading = s.heading?.normalize('NFC') ?? null
        const full = (heading !== null ? `${heading}\n${text}` : text).normalize('NFC')
        return { anchor, heading, full, folded: fold(full) }
      }),
    })),
  }
}

export interface Snippet {
  before: string
  match: string
  after: string
}
export interface BodyHit {
  doc: Doc
  anchor: string | null // 누르면 이 헤딩까지 (null = 첫 헤딩 앞)
  heading: string | null // 헤딩 줄에서 걸렸으면 null (줄 자체가 헤딩이라 따로 안 적음)
  snippet: Snippet
  count: number // 이 글에서 걸린 곳 수
}

const BEFORE = 16 // 걸린 말 앞에 남길 글자 수 (뒤는 화면이 자른다)

function snippetOf(full: string, start: number, end: number): Snippet {
  const lineStart = full.lastIndexOf('\n', start - 1) + 1
  const nl = full.indexOf('\n', end)
  const lineEnd = nl < 0 ? full.length : nl
  let before = full.slice(lineStart, start).trimStart()
  if (before.length > BEFORE + 2) before = `…${before.slice(-BEFORE)}`
  return { before, match: full.slice(start, end), after: full.slice(end, Math.min(lineEnd, end + 120)) }
}

export const bodySearchable = (query: string) => foldQuery(query).length >= BODY_MIN

export function searchBody(ix: GraphIndex, corpus: Corpus, query: string, skip: ReadonlySet<string> = new Set(), limit = 30): BodyHit[] {
  const q = foldQuery(query)
  if (q.length < BODY_MIN) return []
  const out: BodyHit[] = []
  for (const { id, pieces } of corpus.docs) {
    if (skip.has(id)) continue
    const doc = ix.docsById.get(id)
    if (!doc) continue
    let first: BodyHit | null = null
    let count = 0
    for (const p of pieces) {
      for (let j = p.folded.norm.indexOf(q); j >= 0; j = p.folded.norm.indexOf(q, j + q.length)) {
        count++
        if (first) continue
        const start = p.folded.at[j]
        const end = p.folded.at[j + q.length - 1] + 1
        const inHeading = p.heading !== null && start < p.heading.length
        first = { doc, anchor: p.anchor, heading: inHeading ? null : p.heading, snippet: snippetOf(p.full, start, end), count: 0 }
      }
    }
    if (first) out.push({ ...first, count })
  }
  return out.sort((a, b) => b.count - a.count || a.doc.title.localeCompare(b.doc.title, 'ko')).slice(0, limit)
}
