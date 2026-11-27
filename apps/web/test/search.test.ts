import { buildGraphIndex, SCHEMA_VERSION, type Doc, type Graph, type TextSection } from '@dumpster/schema'
import { describe, expect, it } from 'vitest'
import { createStore } from '../src/core/data'
import { bodySearchable, prepareCorpus, searchBody } from '../src/core/search'

// 본문 찾기 (P4.6b) — 헤딩별 평문 조각을 훑는다

function doc(id: string, title: string, sections: TextSection[]): Doc {
  const at = '2026-11-27T10:00:00+09:00'
  return { id, title, aliases: [], collectionId: 'c', kind: 'doc', order: null, tags: [], description: null, createdAt: at, updatedAt: at, blocks: [], sections }
}
const docs = [
  doc('a', '도커 설치', [
    { anchor: null, heading: null, text: 'apt로 도커를 깐다' },
    { anchor: '권한', heading: '권한 문제', text: 'docker 그룹에 넣는다\n로그아웃 뒤 다시 Docker 확인' },
  ]),
  doc('b', '용량 부족 사태', [{ anchor: null, heading: null, text: '사진 동기화 켜자마자 SD카드 꽉 참 → 외장 SSD 달기' }]),
  doc('c', '함정 모음', [
    { anchor: null, heading: null, text: '머리말' },
    { anchor: 'sd', heading: 'SD 카드 수명', text: '' },
    { anchor: '긴-줄', heading: '긴 줄', text: '아주 길고 긴 앞부분 글자가 이만큼이나 계속 이어진 뒤에야 비로소 외장 SSD 이야기가 나온다. SSD는 비싸다' },
  ]),
]
const graph: Graph = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: '2026-11-27T00:00:00.000Z',
  source: { vaultCommit: null },
  collections: [{ id: 'c', path: ['c'], title: 'c', manifestId: null, description: null, tags: [] }],
  docs,
  edges: [],
}
const ix = buildGraphIndex(graph)
const corpus = prepareCorpus(docs)
const find = (q: string, skip?: Set<string>) => searchBody(ix, corpus, q, skip)

describe('본문 찾기', () => {
  it('두 글자부터 — 한 글자·빈 검색어는 결과 없음', () => {
    expect(bodySearchable('도')).toBe(false)
    expect(bodySearchable(' 도 커 ')).toBe(true)
    expect(find('도')).toEqual([])
    expect(find('   ')).toEqual([])
  })

  it('띄어쓰기·대소문자 무시, 칠할 자리는 원문 그대로', () => {
    const [hit] = find('sd카드')
    expect(hit.doc.id).toBe('b')
    expect(hit.snippet).toEqual({ before: '사진 동기화 켜자마자 ', match: 'SD카드', after: ' 꽉 참 → 외장 SSD 달기' })
    // 원문 띄어쓰기를 걸친 일치: "외장SSD" → 원문 "외장 SSD"
    expect(find('외장ssd').find((h) => h.doc.id === 'b')!.snippet.match).toBe('외장 SSD')
  })

  it('처음 걸린 조각의 헤딩·걸린 줄, 걸린 곳 수 = 글 전체', () => {
    const [hit] = find('docker')
    expect(hit).toMatchObject({ anchor: '권한', heading: '권한 문제', count: 2 })
    expect(hit.snippet).toEqual({ before: '', match: 'docker', after: ' 그룹에 넣는다' })
    // 첫 헤딩 앞에서 걸리면 anchor·heading null
    expect(find('apt로')[0]).toMatchObject({ anchor: null, heading: null })
  })

  it('헤딩 글자로도 찾고, 그땐 줄 자체가 헤딩이라 heading은 null', () => {
    const hit = find('수명')[0]
    expect(hit).toMatchObject({ anchor: 'sd', heading: null })
    expect(hit.snippet).toEqual({ before: 'SD 카드 ', match: '수명', after: '' })
  })

  it('걸린 말 앞이 길면 잘라 … 을 붙인다', () => {
    const hit = find('외장ssd').find((h) => h.doc.id === 'c')!
    expect(hit.snippet.before.startsWith('…')).toBe(true)
    expect(hit.snippet.before.length).toBe(17)
    expect(hit.snippet.match).toBe('외장 SSD')
  })

  it('걸린 곳 많은 글 먼저, 제목으로 찾은 글은 뺀다', () => {
    expect(find('ssd').map((h) => [h.doc.id, h.count])).toEqual([['c', 2], ['b', 1]])
    expect(find('ssd', new Set(['c'])).map((h) => h.doc.id)).toEqual(['b'])
  })

  it('store.getSearchText — 지금은 graph.json의 글 그대로', async () => {
    const texts = await createStore(graph).getSearchText()
    expect(texts.map((t) => [t.id, t.sections.length])).toEqual([['a', 2], ['b', 1], ['c', 3]])
  })
})
