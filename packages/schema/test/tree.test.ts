import { describe, expect, it } from 'vitest'
import {
  buildGraphIndex,
  compareSiblings,
  docIdOf,
  edgeIdOf,
  slugify,
  stampOf,
  treeToText,
  type Doc,
  type Edge,
  type Graph,
} from '../src'

// 짜가 볼트에 없는 경우들을 작은 그래프로 확인한다 (짜가 볼트 정답은 builder 테스트에)

let minute = 0
function makeDoc(title: string, extra: Partial<Doc> = {}): Doc {
  const createdAt = `2026-11-01T00:${String(minute++).padStart(2, '0')}:00+09:00`
  return {
    id: title,
    title,
    aliases: [],
    collectionId: 'c',
    kind: 'doc',
    order: null,
    tags: [],
    description: null,
    createdAt,
    updatedAt: createdAt,
    blocks: [],
    text: '',
    ...extra,
  }
}
const prev = (source: string, target: string | null): Edge => ({
  id: edgeIdOf(source, target, target ?? '?', 'prev'),
  source,
  target,
  targetLabel: target ?? '?',
  relation: 'prev',
  origin: 'frontmatter',
})
function graphOf(docs: Doc[], edges: Edge[], manifestId: string | null = null): Graph {
  return {
    schemaVersion: 3,
    generatedAt: '',
    source: { vaultCommit: null },
    collections: [{ id: 'c', path: ['c'], title: 'c', manifestId, description: null, tags: [] }],
    docs,
    edges,
  }
}

describe('트리 인덱스 — 짜가 볼트 밖의 경우', () => {
  it('매니페스트가 없으면 prev 없는 글들이 각각 루트 (root 플래그로 덩어리 구분)', () => {
    const index = buildGraphIndex(graphOf([makeDoc('A'), makeDoc('A2'), makeDoc('B')], [prev('A2', 'A')]))
    expect(treeToText(index, 'c')).toBe('● A\n● A2\n● B')
    expect(index.tree('c').rows.map((r) => r.root)).toEqual([true, false, true])
  })

  it('순환에 매달린 글은 순환 아래 덩어리째, 자식이 먼저 만들어졌어도 떨어지지 않음', () => {
    const child = makeDoc('자식') // 부모보다 먼저 만든 글
    const x = makeDoc('X')
    const y = makeDoc('Y')
    const hang = makeDoc('매달림')
    const index = buildGraphIndex(
      graphOf([makeDoc('M', { kind: 'manifest' }), x, y, hang, child], [prev('X', 'Y'), prev('Y', 'X'), prev('매달림', 'X'), prev('자식', '매달림')], 'M'),
    )
    expect(treeToText(index, 'c')).toBe(
      ['● M', '── 연결 안 됨 ──', '● X  ⚠ prev 순환', '● Y  ⚠ prev 순환', '● 매달림  ⚠ 순환에 매달린 글', '● 자식'].join('\n'),
    )
  })

  it('자기 자신을 prev로 둔 글도 순환', () => {
    const index = buildGraphIndex(graphOf([makeDoc('M', { kind: 'manifest' }), makeDoc('S')], [prev('S', 'S')], 'M'))
    expect(index.tree('c').orphans.map((r) => r.orphan)).toEqual(['cycle'])
    expect(index.ancestors('S')).toEqual([])
  })

  it('연결 안 됨 덩어리는 그 아래 글까지 들여쓰기 규칙대로', () => {
    const index = buildGraphIndex(
      graphOf(
        [makeDoc('M', { kind: 'manifest' }), makeDoc('O'), makeDoc('O1'), makeDoc('O2')],
        [prev('O', null), prev('O1', 'O'), prev('O2', 'O')],
        'M',
      ),
    )
    expect(treeToText(index, 'c')).toBe(['● M', '── 연결 안 됨 ──', '● O  ⚠ prev 대상 없음', '├─● O1', '└─● O2'].join('\n'))
  })
})

describe('형제 정렬 order → createdAt → 이름', () => {
  it('order 있는 글이 먼저, lexorank는 바이트 순서', () => {
    const docs = [makeDoc('없음'), makeDoc('b', { order: 'b' }), makeDoc('am', { order: 'am' }), makeDoc('a', { order: 'a' })]
    expect(docs.sort(compareSiblings).map((d) => d.title)).toEqual(['a', 'am', 'b', '없음'])
  })

  it('createdAt 같으면 이름순', () => {
    const t = '2026-11-10T21:30:00+09:00'
    const docs = [makeDoc('하드웨어', { createdAt: t }), makeDoc('자막', { createdAt: t })]
    expect(docs.sort(compareSiblings).map((d) => d.title)).toEqual(['자막', '하드웨어'])
  })
})

describe('ID', () => {
  it.each([
    ['OT.홈서버 구축기', 'ot-홈서버-구축기'],
    ['회고 - 도커 쓸만한가', '회고-도커-쓸만한가'],
    ['Query-Aggregation', 'query-aggregation'],
    ['다듬기/편의성?', '다듬기편의성'],
  ])('slugify(%s) = %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('스탬프는 KST 기준, 충돌 꼬리는 무시', () => {
    expect(docIdOf('도커 설치', '2026-11-04T10:40:00Z')).toBe('도커-설치-2611041940')
    expect(stampOf('도커-설치-2611041940')).toBe('2611041940')
    expect(stampOf('도커-설치-2611041940-2')).toBe('2611041940')
    expect(stampOf('stamp-없음')).toBeNull()
  })
})
