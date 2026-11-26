import type { GraphIndex, TreeRow } from '@dumpster/schema'
import { descendants } from './links'
import { activeOf, type View } from './view'

// 컬렉션 트리에서 지금 보이는 행 (design.md §3 "트리 표시") — 사이드바 트리(Tree)와 j/k가 같은 걸 본다
//   접은 분기점(folds)의 자손은 숨긴다. 단 흐름 글·펼친 탭 글의 조상 갈래는 접어 둬도 항상 펼친다

export interface ShownTree {
  rows: TreeRow[] // 줄기·갈래 — 보이는 것만, 순서대로
  orphans: TreeRow[] // 따로 읽는 글 — 보이는 것만
  folded: Set<string> // 실제로 접힌 분기점 (+n 표시)
  pinned: Set<string> // 열린 글의 조상 — 접을 수 없어서 접기 버튼을 숨긴다
}

export function shownTree(ix: GraphIndex, collectionId: string, view: View, folds: string[]): ShownTree {
  const tree = ix.tree(collectionId)
  const pinned = new Set<string>()
  for (const id of [view.main, activeOf(view)]) {
    if (id && ix.docsById.get(id)?.collectionId === collectionId) for (const a of ix.ancestors(id)) pinned.add(a)
  }
  const folded = new Set(folds.filter((x) => !pinned.has(x)))
  const hidden = new Set([...folded].flatMap((x) => descendants(ix, x)))
  return {
    rows: tree.rows.filter((r) => !hidden.has(r.docId)),
    orphans: tree.orphans.filter((r) => !hidden.has(r.docId)),
    folded,
    pinned,
  }
}

// j/k — from이 있는 컬렉션 트리의 보이는 행 순서(줄기·갈래 → 따로 읽는 글)에서 다음(1)/이전(-1) 글. 끝이면 null
// folds = 사이드바의 컬렉션별 접은 분기점
export function stepRow(ix: GraphIndex, view: View, folds: Record<string, string[]>, from: string, d: 1 | -1): string | null {
  const cid = ix.docsById.get(from)?.collectionId
  if (!cid) return null
  const t = shownTree(ix, cid, view, folds[cid] ?? [])
  const ids = [...t.rows, ...t.orphans].map((r) => r.docId).filter((id) => ix.docsById.has(id))
  const i = ids.indexOf(from)
  return i < 0 ? null : (ids[i + d] ?? null)
}

// 브레드크럼 (P4.4) — 그 글까지 오면서 거친 분기점(같은 컬렉션 안에서 갈래가 둘 이상 갈라진 글), 위에서부터.
// 트리에서 들여쓰기가 한 칸 늘어나는 곳 = 폴더 경로. 그 글 자신은 안 넣는다 (본문에선 제목이 바로 아래)
export function forkTrail(ix: GraphIndex, id: string): string[] {
  const cid = ix.docsById.get(id)?.collectionId
  if (!cid) return []
  return ix.ancestors(id).filter((a) => (ix.nextOf.get(a) ?? []).filter((n) => n.collectionId === cid).length >= 2)
}
