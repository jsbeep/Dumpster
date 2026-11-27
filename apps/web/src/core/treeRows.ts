import type { GraphIndex, TreeRow } from '@dumpster/schema'
import { descendants } from './links'
import { activeOf, type View } from './view'

// 컬렉션 트리에서 지금 보이는 행 (design.md §3 "트리 표시") — 사이드바 트리(Tree)와 j/k가 같은 걸 본다
//   접은 분기점(folds)은 곁가지(한 칸 들여 그린 갈래)만 숨긴다 — 본줄기는 계속 보인다 (11-28 _branch)
//   단 흐름 글·펼친 탭 글이 곁가지 안에 있으면 그 분기점은 접어 둬도 펼친다

export interface ShownTree {
  rows: TreeRow[] // 줄기·갈래 — 보이는 것만, 순서대로
  orphans: TreeRow[] // 따로 읽는 글 — 보이는 것만
  folded: Set<string> // 실제로 접힌 분기점 (+n 표시)
  pinned: Set<string> // 열린 글이 곁가지 안에 있는 분기점 — 접을 수 없어서 접기 버튼을 숨긴다
}

// 접으면 숨는 글 — 곁가지와 그 아래 전부
export function foldedAway(ix: GraphIndex, id: string): string[] {
  return ix.sides(id).flatMap((s) => [s, ...descendants(ix, s)])
}

export function shownTree(ix: GraphIndex, collectionId: string, view: View, folds: string[]): ShownTree {
  const tree = ix.tree(collectionId)
  const pinned = new Set<string>()
  for (const id of [view.main, activeOf(view)]) {
    if (id && ix.docsById.get(id)?.collectionId === collectionId) for (const a of forkTrail(ix, id)) pinned.add(a)
  }
  const folded = new Set(folds.filter((x) => !pinned.has(x) && ix.sides(x).length))
  const hidden = new Set([...folded].flatMap((x) => foldedAway(ix, x)))
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

// 브레드크럼 (P4.4) — 그 글까지 오면서 곁가지로 들어간 분기점, 위에서부터.
// 트리에서 들여쓰기가 한 칸 늘어나는 곳 = 폴더 경로 (본줄기로 지나온 분기점은 안 넣는다).
// 그 글 자신은 안 넣는다 (본문에선 제목이 바로 아래)
export function forkTrail(ix: GraphIndex, id: string): string[] {
  const chain = [...ix.ancestors(id), id]
  return chain.slice(0, -1).filter((a, i) => ix.sides(a).includes(chain[i + 1]))
}
