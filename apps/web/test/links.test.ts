import { buildGraphIndex } from '@dumpster/schema'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildGraph } from '../../builder/src/build'
import { backlinks, branchInfo, descendants, linkMarks, outLinks, seeAlso } from '../src/core/links'
import { searchDocs } from '../src/core/search'

// 글 끝 목록·트리 ↙/↗·갈래 카드 계산 — 짜가 볼트 그래프 그대로
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
const titles = (ids: string[]) => ids.map((x) => ix.docsById.get(x)?.title)

describe('글 끝 목록', () => {
  it('가리키는 글: 같은 컬렉션 먼저, 같은 글은 한 번만', () => {
    // OS 설치 ← 용량 부족 사태(홈서버), 표와 코드·함정 모음(블록 견본)
    expect(titles(backlinks(ix, id('OS 설치')))).toEqual(['용량 부족 사태', '표와 코드', '함정 모음'])
  })
  it('prev는 가리키는 글이 아니다', () => {
    const nexts = (ix.nextOf.get(id('도커 설치')) ?? []).map((d) => d.id)
    expect(nexts.length).toBeGreaterThan(1)
    for (const n of nexts) expect(backlinks(ix, id('도커 설치'))).not.toContain(n)
  })
  it('가리키는 글(본문 링크) vs 함께 볼 글(see_also) — 없는 글은 원문 이름으로', () => {
    const out = outLinks(ix, id('회고 - 도커 쓸만한가'))
    expect(out.map((e) => [e.target, e.targetLabel])).toEqual([[null, '공유기 설정']])
    const sa = seeAlso(ix, id('회고 - 도커 쓸만한가'))
    expect(sa.map((e) => (e.target ? ix.docsById.get(e.target)?.title : `?${e.targetLabel}`))).toEqual([
      'Jellyfin 올리기',
      '모니터링 붙이기',
      '?몰래 쓰는 중',
    ])
  })
  it('같은 대상으로 가는 link·see_also는 각 목록에 한 번씩', () => {
    expect(outLinks(ix, id('고정 IP 설정')).map((e) => e.targetLabel)).toEqual(['통장 비번'])
    expect(seeAlso(ix, id('고정 IP 설정')).map((e) => e.targetLabel)).toEqual(['통장 비번'])
  })
})

describe('트리 ↙/↗', () => {
  it('지금 보는 글 기준으로 양쪽', () => {
    const m = linkMarks(ix, id('용량 부족 사태'))
    expect(m.get(id('OS 설치'))).toEqual({ in: false, out: true })
    expect(m.get(id('외장 SSD 달기'))).toEqual({ in: false, out: true })
    const back = linkMarks(ix, id('OS 설치'))
    expect(back.get(id('용량 부족 사태'))).toEqual({ in: true, out: false })
  })
  it('없는 글로 가는 링크는 표시할 행이 없다', () => {
    const m = linkMarks(ix, id('회고 - 도커 쓸만한가'))
    expect([...m.keys()].every((k) => ix.docsById.has(k))).toBe(true)
  })
  it('보는 글이 없으면 빈 표시', () => {
    expect(linkMarks(ix, null).size).toBe(0)
  })
})

describe('갈래', () => {
  it('아래 글은 같은 컬렉션 안에서만 (시즌2로 넘어간 글은 안 숨김)', () => {
    const d = titles(descendants(ix, id('도커 설치')))
    expect(d).toContain('포트포워딩 삽질')
    expect(d).toContain('회고 - 도커 쓸만한가')
    expect(d).not.toContain('도커 설치')
    expect(d).not.toContain('k3s 도전기')
  })
  it('갈래 카드 요약: 글 수 · 다른 컬렉션으로 넘어가는 곳', () => {
    const info = branchInfo(ix, id('회고 - 도커 쓸만한가'))
    expect(info.count).toBe(1 + descendants(ix, id('회고 - 도커 쓸만한가')).length)
    expect(info.exits).toEqual([ix.docsById.get(id('k3s 도전기'))!.collectionId])
  })
})

describe('사이드바 검색', () => {
  const titlesOf = (q: string) => searchDocs(ix, q).map((h) => h.doc.title)
  it('띄어쓰기·대소문자 무시, 앞에서 맞은 제목 먼저', () => {
    expect(titlesOf('용량부족')).toEqual(['용량 부족 사태'])
    expect(titlesOf('os')[0]).toBe('OS 설치')
  })
  it('별칭으로도 찾는다', () => {
    const hits = searchDocs(ix, '컨테이너 고민')
    expect(hits.map((h) => [h.doc.title, h.alias])).toEqual([['컨테이너 뭐 올리지', '컨테이너 고민']])
  })
  it('빈 검색어 = 결과 없음, 비공개·draft는 그래프에 없어서 안 나옴', () => {
    expect(searchDocs(ix, '   ')).toEqual([])
    expect(titlesOf('몰래')).toEqual([])
    expect(titlesOf('통장')).toEqual([])
  })
})
