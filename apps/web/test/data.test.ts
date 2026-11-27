import { SCHEMA_VERSION, type Doc, type Graph } from '@dumpster/schema'
import { describe, expect, it } from 'vitest'
import { createStore, loadStore } from '../src/core/data'
import { hashOf, parseHash } from '../src/core/route'

const OID = '6aeb0b8091f37a98e7007350'

function doc(id: string, title: string, createdAt: string): Doc {
  return {
    id, title, aliases: [], collectionId: 'c', kind: 'doc', order: null, tags: [], description: null,
    createdAt, updatedAt: createdAt, blocks: [], sections: [],
  }
}
function graph(docs: Doc[]): Graph {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: '2026-11-26T00:00:00.000Z',
    source: { vaultCommit: null },
    collections: [{ id: 'c', path: ['c'], title: 'c', manifestId: null, description: null, tags: [] }],
    docs,
    edges: [],
  }
}

describe('주소의 ID 찾기', () => {
  const store = createStore(
    graph([
      doc('도커-설치-2611041940', '도커 설치', '2026-11-04T19:40:00+09:00'),
      doc(OID, 'OS 설치', '2026-11-02T10:00:00+09:00'),
      doc('같은분-a-2611051200', '같은분 a', '2026-11-05T12:00:00+09:00'),
      doc('같은분-b-2611051200-2', '같은분 b', '2026-11-05T12:00:00+09:00'),
    ]),
  )

  it('그대로 있는 ID', () => {
    expect(store.resolveId('도커-설치-2611041940')).toBe('도커-설치-2611041940')
    expect(store.resolveId(OID)).toBe(OID)
  })
  it('이름을 바꾼 임시 ID → 스탬프가 같은 글', () => {
    expect(store.resolveId('도커-깔기-2611041940')).toBe('도커-설치-2611041940')
  })
  it('옛 임시 ID → 나중에 oid를 단 글 (만든 시각이 같음)', () => {
    expect(store.resolveId('os-설치-2611021000')).toBe(OID)
  })
  it('같은 분에 만든 글이 여럿이면 못 고름', () => {
    expect(store.resolveId('같은분-2611051200')).toBeNull()
  })
  it('없는 oid · 모양이 이상한 ID', () => {
    expect(store.resolveId('6aeb0b8091f37a98e7009999')).toBeNull()
    expect(store.resolveId('아무거나')).toBeNull()
  })
  it('getDoc은 async, 옛 ID로도 글을 준다 · peekDoc은 받아 둔 글을 바로', async () => {
    expect((await store.getDoc('도커-깔기-2611041940'))?.title).toBe('도커 설치')
    expect(await store.getDoc('아무거나')).toBeNull()
    expect(store.peekDoc('도커-깔기-2611041940')?.title).toBe('도커 설치')
    expect(store.peekDoc('아무거나')).toBeNull()
  })
})

describe('graph.json 받기', () => {
  const fakeFetch = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch

  it('스키마 버전이 다르면 다시 빌드하라고', async () => {
    await expect(loadStore('graph.json', fakeFetch({ ...graph([]), schemaVersion: 2 }))).rejects.toThrow(/pnpm graph/)
  })
  it('못 받으면 상태 코드와 함께', async () => {
    await expect(loadStore('graph.json', fakeFetch({}, 404))).rejects.toThrow(/404/)
  })
  it('받으면 인덱스까지', async () => {
    const store = await loadStore('graph.json', fakeFetch(graph([doc(OID, 'OS 설치', '2026-11-02T10:00:00+09:00')])))
    expect(store.index.docsById.get(OID)?.title).toBe('OS 설치')
  })
})

describe('주소', () => {
  it('흐름 글 · 펼친 탭', () => {
    expect(parseHash('#/d/abc')).toEqual({ main: 'abc', rel: null })
    expect(parseHash('#/d/abc/def')).toEqual({ main: 'abc', rel: 'def' })
    expect(parseHash('#/d/abc/')).toEqual({ main: 'abc', rel: null })
  })
  it('첫 화면 · 모르는 모양', () => {
    for (const h of ['', '#', '#/', '#/x/abc', '#/d/', '#/d/a/b/c']) expect(parseHash(h)).toEqual({ main: null, rel: null })
  })
  it('한글 임시 ID 왕복', () => {
    const r = { main: '도커-설치-2611041940', rel: OID }
    expect(parseHash(hashOf(r))).toEqual(r)
    expect(hashOf({ main: null, rel: null })).toBe('#/')
  })
  it('블록 렌더러 링크(docHref)와 같은 모양', () => {
    expect(hashOf({ main: '도커-설치-2611041940', rel: null })).toBe(`#/d/${encodeURIComponent('도커-설치-2611041940')}`)
  })
})
