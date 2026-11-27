import { describe, expect, it } from 'vitest'
import {
  SCHEMA_VERSION,
  buildGraphIndex,
  compareSiblings,
  docIdOf,
  edgeIdOf,
  isOid,
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
    sections: [],
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
    schemaVersion: SCHEMA_VERSION,
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

  it('줄 끝 표시(mark)는 표시가 있는 줄에만, 다른 표시(⚠) 뒤에 붙는다', () => {
    const index = buildGraphIndex(
      graphOf([makeDoc('M', { kind: 'manifest' }), makeDoc('A'), makeDoc('B'), makeDoc('O')], [prev('A', 'M'), prev('B', 'A'), prev('O', null)], 'M'),
    )
    const marks: Record<string, string> = { A: '✏️ 본문', O: '🆕' }
    expect(treeToText(index, 'c', (id) => marks[id] ?? null)).toBe(
      ['● M', '● A  ✏️ 본문', '● B', '── 연결 안 됨 ──', '● O  ⚠ prev 대상 없음  🆕'].join('\n'),
    )
    expect(treeToText(index, 'c')).toBe(['● M', '● A', '● B', '── 연결 안 됨 ──', '● O  ⚠ prev 대상 없음'].join('\n'))
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

describe('곁가지 태그 _branch (Doc.branch) — 본줄기는 같은 깊이로', () => {
  // 사용자 스크린샷의 병 합 컬렉션 모양: 분기점마다 한 칸짜리 곁가지 하나 + 이어지는 본줄기
  const B = { branch: true } as const
  const index = buildGraphIndex(
    graphOf(
      [
        makeDoc('M', { kind: 'manifest' }),
        makeDoc('낯선'),
        makeDoc('인증서', B),
        makeDoc('다듬기'),
        makeDoc('연결'),
        makeDoc('Skills', B),
        makeDoc('모니터링'),
        makeDoc('서버'),
        makeDoc('대왕'),
        makeDoc('문서', B),
      ],
      [
        prev('낯선', 'M'),
        prev('인증서', '낯선'),
        prev('다듬기', '낯선'),
        prev('연결', '다듬기'),
        prev('Skills', '연결'),
        prev('모니터링', '연결'),
        prev('서버', '모니터링'),
        prev('대왕', '서버'),
        prev('문서', '모니터링'),
      ],
      'M',
    ),
  )

  it('곁가지만 한 칸, 본줄기는 안 밀린다 (곁가지가 먼저, 전부 ├─)', () => {
    expect(treeToText(index, 'c')).toBe(
      ['● M', '● 낯선', '├─● 인증서', '● 다듬기', '● 연결', '├─● Skills', '● 모니터링', '├─● 문서', '● 서버', '● 대왕'].join('\n'),
    )
    expect(index.tree('c').rows.map((r) => r.depth)).toEqual([0, 0, 1, 0, 0, 1, 0, 1, 0, 0])
  })

  it('sides — 들여 그린 갈래만 (본줄기 빼고)', () => {
    expect(index.sides('낯선')).toEqual(['인증서'])
    expect(index.sides('모니터링')).toEqual(['문서'])
    expect(index.sides('다듬기')).toEqual([])
    expect(index.tree('c').rows.find((r) => r.docId === '연결')).toMatchObject({ forks: 2, sides: 1 })
  })

  it('태그 없는 갈래가 2개 이상이면 본줄기를 몰라 전부 들여씀 (태그 단 건 그 앞에 없어도 순서대로)', () => {
    const ix = buildGraphIndex(
      graphOf(
        [makeDoc('M', { kind: 'manifest' }), makeDoc('A'), makeDoc('B', B), makeDoc('C'), makeDoc('C2')],
        [prev('A', 'M'), prev('B', 'M'), prev('C', 'M'), prev('C2', 'C')],
        'M',
      ),
    )
    expect(treeToText(ix, 'c')).toBe(['● M', '├─● A', '├─● B', '└─● C', '  ● C2'].join('\n'))
    expect(ix.sides('M')).toEqual(['A', 'B', 'C'])
  })

  it('갈래가 전부 태그면 전부 들여씀, 하나뿐인 다음 글도 태그면 곁가지', () => {
    const ix = buildGraphIndex(
      graphOf(
        [makeDoc('M', { kind: 'manifest' }), makeDoc('A', B), makeDoc('A1', B), makeDoc('A2')],
        [prev('A', 'M'), prev('A1', 'A'), prev('A2', 'A1')],
        'M',
      ),
    )
    expect(treeToText(ix, 'c')).toBe(['● M', '└─● A', '  └─● A1', '    ● A2'].join('\n'))
  })

  it('곁가지 아래 이어지는 글은 본줄기 세로선(│) 안쪽에', () => {
    const ix = buildGraphIndex(
      graphOf(
        [makeDoc('M', { kind: 'manifest' }), makeDoc('S', B), makeDoc('S2'), makeDoc('N')],
        [prev('S', 'M'), prev('S2', 'S'), prev('N', 'M')],
        'M',
      ),
    )
    expect(treeToText(ix, 'c')).toBe(['● M', '├─● S', '│ ● S2', '● N'].join('\n'))
  })

  it('태그가 하나도 없으면 예전과 똑같다', () => {
    const ix = buildGraphIndex(
      graphOf([makeDoc('M', { kind: 'manifest' }), makeDoc('A'), makeDoc('B'), makeDoc('B2')], [prev('A', 'M'), prev('B', 'M'), prev('B2', 'B')], 'M'),
    )
    expect(treeToText(ix, 'c')).toBe(['● M', '├─● A', '└─● B', '  ● B2'].join('\n'))
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

  it('oid 판별: ObjectId(24 hex)와 UUID만', () => {
    expect(isOid('6aeb0b8091f37a98e7007350')).toBe(true)
    expect(isOid('c7ce98fb-b9a7-452a-8ee2-b02baef62861')).toBe(true)
    expect(isOid('도커-설치-2611041940')).toBe(false)
    expect(isOid('6aeb0b80')).toBe(false)
    expect(stampOf('6aeb0b8091f37a98e7007350')).toBeNull()
  })

  it('스탬프는 KST 기준, 충돌 꼬리는 무시', () => {
    expect(docIdOf('도커 설치', '2026-11-04T10:40:00Z')).toBe('도커-설치-2611041940')
    expect(stampOf('도커-설치-2611041940')).toBe('2611041940')
    expect(stampOf('도커-설치-2611041940-2')).toBe('2611041940')
    expect(stampOf('stamp-없음')).toBeNull()
  })
})
