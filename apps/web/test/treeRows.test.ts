import { buildGraphIndex } from '@dumpster/schema'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildGraph } from '../../builder/src/build'
import { descendants } from '../src/core/links'
import { forkTrail, shownTree, stepRow } from '../src/core/treeRows'
import type { View } from '../src/core/view'

// 트리 보이는 행 · j/k (P4.3) — 짜가 볼트 그래프 그대로. 기대값은 ix.tree 순서에서 끌어낸다 (행 모양에 안 묶이게)
const vaultDir = fileURLToPath(new URL('../../../fixtures/vault', import.meta.url))
const FIXED = { created: '2026-11-24T12:00:00+09:00', updated: '2026-11-24T12:00:00+09:00' }
const { graph } = buildGraph({
  vaultDir,
  publicFolders: ['홈서버 구축기', '홈서버 구축기/시즌2', '블록 견본'],
  dates: () => FIXED,
  vaultCommit: null,
  now: () => new Date(0),
})
const ix = buildGraphIndex(graph)
const id = (title: string) => {
  const d = graph.docs.find((x) => x.title === title)
  if (!d) throw new Error(`문서 없음: ${title}`)
  return d.id
}
const cid = ix.docsById.get(id('도커 설치'))!.collectionId
const order = () => {
  const t = ix.tree(cid)
  return [...t.rows, ...t.orphans].map((r) => r.docId).filter((x) => ix.docsById.has(x))
}
const at = (main: string): View => ({ main: id(main), tabs: [], active: 0, collapsed: null })

describe('j/k — 트리 보이는 행에서 한 줄', () => {
  it('접은 갈래가 없으면 트리 순서 그대로, 줄기·갈래 다음에 따로 읽는 글, 끝에서 멈춤', () => {
    const ids = order()
    expect(ix.tree(cid).orphans.length).toBeGreaterThan(0)
    for (let i = 0; i < ids.length; i++) {
      const v: View = { main: ids[i], tabs: [], active: 0, collapsed: null }
      expect(stepRow(ix, v, {}, ids[i], 1)).toBe(ids[i + 1] ?? null)
      expect(stepRow(ix, v, {}, ids[i], -1)).toBe(ids[i - 1] ?? null)
    }
  })
  it('접은 분기점의 갈래는 건너뛴다', () => {
    const fork = id('도커 설치')
    const hidden = new Set(descendants(ix, fork))
    expect(hidden.size).toBeGreaterThan(0)
    const ids = order()
    const after = ids.slice(ids.indexOf(fork) + 1).find((x) => !hidden.has(x)) ?? null
    const v = at('OT.홈서버 구축기') // 흐름 글이 갈래 밖이라 접기가 먹는다
    expect(stepRow(ix, v, { [cid]: [fork] }, fork, 1)).toBe(after)
    expect(after && stepRow(ix, v, { [cid]: [fork] }, after, -1)).toBe(fork)
  })
  it('흐름 글의 조상 갈래는 접어 둬도 펼쳐 있다 (그래서 한 줄씩)', () => {
    const fork = id('도커 설치')
    const inside = descendants(ix, fork)[0]
    const v: View = { main: inside, tabs: [], active: 0, collapsed: null }
    const t = shownTree(ix, cid, v, [fork])
    expect(t.pinned.has(fork)).toBe(true)
    expect(t.folded.has(fork)).toBe(false)
    expect(stepRow(ix, v, { [cid]: [fork] }, fork, 1)).toBe(order()[order().indexOf(fork) + 1])
  })
  it('없는 글에서는 움직이지 않는다', () => {
    expect(stepRow(ix, at('도커 설치'), {}, 'nope', 1)).toBeNull()
  })
})

describe('브레드크럼 — 거쳐 온 분기점', () => {
  const titles = (ids: string[]) => ids.map((x) => ix.docsById.get(x)?.title)
  it('트리 행의 forks > 1인 조상만, 위에서부터 (= 들여쓰기가 늘어나는 곳)', () => {
    const forksOf = new Map(ix.tree(cid).rows.map((r) => [r.docId, r.forks]))
    for (const r of ix.tree(cid).rows) {
      const want = ix.ancestors(r.docId).filter((a) => (forksOf.get(a) ?? 0) > 1)
      expect(forkTrail(ix, r.docId)).toEqual(want)
    }
  })
  it('예: 용량 부족 사태 = 도커 설치 › 컨테이너 뭐 올리지, 줄기 글·매니페스트는 빈 줄', () => {
    expect(titles(forkTrail(ix, id('용량 부족 사태')))).toEqual(['도커 설치', '컨테이너 뭐 올리지'])
    expect(forkTrail(ix, id('고정 IP 설정'))).toEqual([])
    expect(forkTrail(ix, id('OT.홈서버 구축기'))).toEqual([])
  })
  it('분기점 자신은 안 넣는다 · 다른 컬렉션에서 이어진 글은 그 컬렉션 안에서만', () => {
    expect(forkTrail(ix, id('도커 설치'))).not.toContain(id('도커 설치'))
    const s2 = graph.docs.find((d) => d.collectionId !== cid && ix.prevOf.get(d.id) && ix.docsById.get(ix.prevOf.get(d.id)!)?.collectionId === cid)
    if (s2) expect(forkTrail(ix, s2.id).every((a) => ix.docsById.get(a)?.collectionId === s2.collectionId)).toBe(true)
  })
})

describe('곁가지 태그 _branch — 접기·브레드크럼은 곁가지만', () => {
  // M → A ┬ S(_branch) → S2
  //       └ B (본줄기) → C
  const mk = (id: string, branch = false) => ({
    id, title: id, aliases: [], collectionId: 'c', kind: 'doc' as const, order: null, tags: [], description: null,
    createdAt: '2026-11-28T00:00:00+09:00', updatedAt: '2026-11-28T00:00:00+09:00', blocks: [], sections: [],
    ...(branch ? { branch: true as const } : {}),
  })
  const p = (s: string, t: string) => ({ id: `${s}->${t}:prev`, source: s, target: t, targetLabel: t, relation: 'prev' as const, origin: 'frontmatter' as const })
  const ix2 = buildGraphIndex({
    ...graph,
    collections: [{ id: 'c', path: ['c'], title: 'c', manifestId: 'M', description: null, tags: [] }],
    docs: [{ ...mk('M'), kind: 'manifest' }, mk('A'), mk('S', true), mk('S2'), mk('B'), mk('C')],
    edges: [p('A', 'M'), p('S', 'A'), p('S2', 'S'), p('B', 'A'), p('C', 'B')],
  })
  const v = (main: string): View => ({ main, tabs: [], active: 0, collapsed: null })
  const ids = (t: { rows: { docId: string }[] }) => t.rows.map((r) => r.docId)

  it('접으면 곁가지만 숨고 본줄기는 남는다', () => {
    expect(ids(shownTree(ix2, 'c', v('M'), []))).toEqual(['M', 'A', 'S', 'S2', 'B', 'C'])
    expect(ids(shownTree(ix2, 'c', v('M'), ['A']))).toEqual(['M', 'A', 'B', 'C'])
  })

  it('본줄기 글을 보고 있어도 접을 수 있다 · 곁가지 안 글을 보면 못 접는다', () => {
    expect(shownTree(ix2, 'c', v('C'), ['A']).folded.has('A')).toBe(true)
    const t = shownTree(ix2, 'c', v('S2'), ['A'])
    expect(t.pinned.has('A')).toBe(true)
    expect(t.folded.has('A')).toBe(false)
  })

  it('곁가지 없는 글은 접기 목록에 있어도 무시', () => {
    expect(shownTree(ix2, 'c', v('M'), ['B']).folded.size).toBe(0)
  })

  it('브레드크럼 = 곁가지로 들어간 분기점만', () => {
    expect(forkTrail(ix2, 'S2')).toEqual(['A'])
    expect(forkTrail(ix2, 'C')).toEqual([])
  })

  it('j/k는 보이는 순서대로 (곁가지 먼저, 본줄기 다음)', () => {
    expect(stepRow(ix2, v('A'), {}, 'A', 1)).toBe('S')
    expect(stepRow(ix2, v('S2'), {}, 'S2', 1)).toBe('B')
    expect(stepRow(ix2, v('M'), { c: ['A'] }, 'A', 1)).toBe('B')
  })
})
