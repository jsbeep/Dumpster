import { buildGraphIndex, SCHEMA_VERSION, type Collection, type Doc, type Graph } from '@dumpster/schema'
import { describe, expect, it } from 'vitest'
import { collectionAncestors, collectionTree, firstDocOf, withinCollection } from '../src/core/collections'

const col = (path: string[], manifestId: string | null = null): Collection => ({
  id: path.join('/'),
  path,
  title: path[path.length - 1],
  manifestId,
  description: null,
  tags: [],
})
const doc = (id: string, collectionId: string): Doc => ({
  id, title: id, aliases: [], collectionId, kind: 'doc', order: null, tags: [], description: null,
  createdAt: '2026-11-01T00:00:00+09:00', updatedAt: '2026-11-01T00:00:00+09:00', blocks: [], sections: [],
})

// 몽고(글 0) ⊃ 레거시(2)·병합(3) · 정처기(1) ⊃ 실기(2) ⊃ (중간 폴더 비공개) 심화(1) · 일지(4)
const graph: Graph = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: '2026-11-28T00:00:00.000Z',
  source: { vaultCommit: null },
  collections: [
    col(['몽고']),
    col(['몽고', '레거시']),
    col(['몽고', '병합'], 'm1'),
    col(['일지']),
    col(['정처기']),
    col(['정처기', '실기']),
    col(['정처기', '실기', '비공개', '심화']),
  ],
  docs: [
    doc('l1', '몽고/레거시'), doc('l2', '몽고/레거시'),
    doc('m1', '몽고/병합'), doc('m2', '몽고/병합'), doc('m3', '몽고/병합'),
    doc('j1', '일지'), doc('j2', '일지'), doc('j3', '일지'), doc('j4', '일지'),
    doc('q0', '정처기'), doc('s1', '정처기/실기'), doc('s2', '정처기/실기'), doc('h1', '정처기/실기/비공개/심화'),
  ],
  edges: [],
}
const ix = buildGraphIndex(graph)

describe('컬렉션 계층', () => {
  const t = collectionTree(ix)

  it('최상위만 top, 하위는 부모 아래 (graph 순서)', () => {
    expect(t.top.map((c) => c.id)).toEqual(['몽고', '일지', '정처기'])
    expect(t.kids.get('몽고')?.map((c) => c.id)).toEqual(['몽고/레거시', '몽고/병합'])
  })

  it('중간 폴더가 비공개면 가장 가까운 공개 상위에 붙는다', () => {
    expect(t.parent.get('정처기/실기/비공개/심화')).toBe('정처기/실기')
    expect(collectionAncestors(ix, '정처기/실기/비공개/심화')).toEqual(['정처기/실기', '정처기'])
  })

  it('개수 = 자기 글 + 하위 컬렉션 글 전부', () => {
    expect(t.total.get('몽고')).toBe(5)
    expect(t.total.get('정처기')).toBe(4)
    expect(t.total.get('정처기/실기')).toBe(3)
    expect(t.total.get('일지')).toBe(4)
  })

  it('withinCollection — 자기 자신·아래만', () => {
    expect(withinCollection(ix, '정처기', '정처기/실기/비공개/심화')).toBe(true)
    expect(withinCollection(ix, '정처기/실기', '정처기')).toBe(false)
    expect(withinCollection(ix, '몽고', '몽고')).toBe(true)
  })

  it('firstDocOf — 매니페스트 → 트리 첫 줄 → 하위 컬렉션', () => {
    expect(firstDocOf(ix, '몽고/병합')).toBe('m1')
    expect(firstDocOf(ix, '몽고')).toBe('l1') // 자기 글 0 → 첫 하위(레거시)의 첫 글
    expect(firstDocOf(ix, '정처기')).toBe('q0')
  })
})
