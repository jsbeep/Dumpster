import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { buildGraphIndex, treeToText, stampOf } from '@dumpster/schema'
import { buildGraph } from '../src/build'

// 짜가 볼트(fixtures/vault) 정답 테스트. 기대 트리는 '홈서버 구축기/OT.홈서버 구축기.md'에 적어둔 것과 같다.
const vaultDir = fileURLToPath(new URL('../../../fixtures/vault', import.meta.url))
const FIXED = { created: '2026-11-24T12:00:00+09:00', updated: '2026-11-24T12:00:00+09:00' }
const build = (publicFolders = ['홈서버 구축기', '홈서버 구축기/시즌2']) =>
  buildGraph({ vaultDir, publicFolders, dates: () => FIXED, vaultCommit: null, now: () => new Date(0) })

const { graph, report } = build()
const index = buildGraphIndex(graph)
const doc = (title: string) => {
  const d = graph.docs.find((x) => x.title === title)
  if (!d) throw new Error(`문서 없음: ${title}`)
  return d
}

describe('트리 (매니페스트에 적은 모양 그대로)', () => {
  it('홈서버 구축기', () => {
    expect(treeToText(index, '홈서버-구축기')).toBe(
      [
        '● OT.홈서버 구축기',
        '● 라즈베리파이 고르기',
        '● OS 설치',
        '● 고정 IP 설정',
        '● 도커 설치',
        '├─● 포트포워딩 삽질',
        '│ ● DDNS 붙이기',
        '│ ● HTTPS 인증서',
        '├─● 컨테이너 뭐 올리지',
        '│ ├─● Nextcloud 올리기',
        '│ │ ● 용량 부족 사태',
        '│ │ ● 외장 SSD 달기',
        '│ ├─● 모니터링 붙이기',
        '│ └─● Jellyfin 올리기',
        '│   ├─● 자막 깨짐',
        '│   └─● 하드웨어 트랜스코딩',
        '└─● 회고 - 도커 쓸만한가',
        '── 연결 안 됨 ──',
        '● 공유기 비번 찾기  ⚠ prev 대상 없음',
        '● 닭과 달걀 A  ⚠ prev 순환',
        '● 닭과 달걀 B  ⚠ prev 순환',
        '● 전원 어댑터 메모  ⚠ prev 없음',
      ].join('\n'),
    )
  })

  it('시즌2 — 다른 컬렉션에서 이어진 글은 루트로, 출처 표시. 사본도 진짜 글이라 갈래가 된다', () => {
    expect(treeToText(index, '홈서버-구축기/시즌2')).toBe(
      ['● OT.홈서버 시즌2', '● k3s 도전기  ↰ 회고 - 도커 쓸만한가', '├─● 노드 하나 더 1', '● 노드 하나 더'].join('\n'), // 노드 하나 더 1 = 태그 _branch
    )
  })

  it('행 메타: 깊이·분기 수', () => {
    const rows = index.tree('홈서버-구축기').rows
    const row = (title: string) => rows.find((r) => r.docId === doc(title).id)!
    expect(row('도커 설치')).toMatchObject({ depth: 0, forks: 3 })
    expect(row('DDNS 붙이기')).toMatchObject({ depth: 1, branch: 'none', guides: [true] })
    expect(row('자막 깨짐')).toMatchObject({ depth: 3, branch: 'mid', guides: [true, false] })
  })

  it('다음 글은 컬렉션을 넘어서도 역참조된다', () => {
    expect(index.nextOf.get(doc('회고 - 도커 쓸만한가').id)?.map((d) => d.title)).toEqual(['k3s 도전기'])
    expect(index.nextOf.get(doc('도커 설치').id)?.map((d) => d.title)).toEqual([
      '포트포워딩 삽질',
      '컨테이너 뭐 올리지',
      '회고 - 도커 쓸만한가',
    ])
  })

  it('조상 = 루트부터 부모까지 (URL로 열 때 펼칠 분기)', () => {
    expect(index.ancestors(doc('자막 깨짐').id).map((id) => index.docsById.get(id)!.title)).toEqual([
      'OT.홈서버 구축기',
      '라즈베리파이 고르기',
      'OS 설치',
      '고정 IP 설정',
      '도커 설치',
      '컨테이너 뭐 올리지',
      'Jellyfin 올리기',
    ])
    // 다른 컬렉션 경계에서 멈춘다
    expect(index.ancestors(doc('노드 하나 더').id).map((id) => index.docsById.get(id)!.title)).toEqual(['k3s 도전기'])
  })
})

describe('문서 ID = oid', () => {
  const warned = (title: string, text: string) =>
    report.warnings.some((w) => w.includes(`/${title}.md: `) && w.includes(text))

  it('oid가 있으면 그게 ID (createdAt 형식과 무관)', () => {
    expect(doc('도커 설치').id).toBe('6aeb0b8091f37a98e7007350')
    expect(doc('자막 깨짐').id).toBe('6af30e48820e88b4177c55d4')
    expect(doc('하드웨어 트랜스코딩').id).toBe('6af30e48c7a0219c71a90f01') // 같은 분에 만든 글
    expect(new Set(graph.docs.map((d) => d.id)).size).toBe(graph.docs.length)
  })

  it('createdAt 형식 4종이 같은 규칙으로 정규화된다', () => {
    expect(doc('라즈베리파이 고르기').createdAt).toBe('2026-11-02T00:00:00+09:00') // 날짜만
    expect(doc('OS 설치').createdAt).toBe('2026-11-03T10:00:00+09:00') // ISO 초
    expect(doc('고정 IP 설정').createdAt).toBe('2026-11-03T22:15:00+09:00') // 옛 템플릿 '-'
    expect(doc('도커 설치').createdAt).toBe('2026-11-04T19:40:00+09:00') // 새 템플릿 'T'
  })

  it('oid가 없거나 이상하면 임시 ID(이름+createdAt) + 경고', () => {
    expect(doc('공유기 비번 찾기').id).toBe('공유기-비번-찾기-2611040900')
    expect(warned('공유기 비번 찾기', 'oid 없음')).toBe(true)
    expect(doc('닭과 달걀 A').id).toBe('닭과-달걀-a-2611081000')
    expect(warned('닭과 달걀 A', '<% %>')).toBe(true) // Templater가 안 돌았음
    expect(doc('닭과 달걀 B').id).toBe('닭과-달걀-b-2611081005')
    expect(warned('닭과 달걀 B', '숫자(Infinity)')).toBe(true) // 따옴표 없는 oid가 숫자로 읽힘
  })

  it('createdAt도 없으면 git(여기선 고정값) 날짜로 임시 ID', () => {
    expect(doc('전원 어댑터 메모').id).toBe('전원-어댑터-메모-2611241200')
    expect(stampOf(doc('전원 어댑터 메모').id)).toBe('2611241200')
    expect(stampOf(doc('도커 설치').id)).toBeNull() // oid엔 스탬프 없음
  })

  it('사본 만들기로 oid가 겹치면 원본(경로가 짧은 쪽)이 갖고 사본은 임시 ID', () => {
    expect(doc('노드 하나 더').id).toBe('6af92e40b250593477a0dbf2')
    expect(doc('노드 하나 더 1').id).toBe('노드-하나-더-1-2611151300')
    expect(warned('노드 하나 더 1', "'홈서버 구축기/시즌2/노드 하나 더.md'와 겹침")).toBe(true)
  })
})

describe('속성 정규화', () => {
  it('태그 # 제거, type: moc, aliases', () => {
    expect(doc('도커 설치').tags).toEqual(['도커'])
    expect(doc('컨테이너 뭐 올리지')).toMatchObject({ kind: 'moc', aliases: ['컨테이너 고민'] })
    expect(doc('OT.홈서버 구축기').kind).toBe('manifest')
  })

  it('별칭으로 건 see_also가 원래 문서로 해석된다', () => {
    const edge = graph.edges.find((e) => e.source === doc('모니터링 붙이기').id && e.relation === 'see_also')
    expect(edge?.target).toBe(doc('컨테이너 뭐 올리지').id)
  })

  it('컬렉션: 폴더 경로 + 매니페스트', () => {
    expect(graph.collections.map((c) => [c.id, c.title, c.manifestId])).toEqual([
      ['홈서버-구축기', '홈서버 구축기', doc('OT.홈서버 구축기').id],
      ['홈서버-구축기/시즌2', '시즌2', doc('OT.홈서버 시즌2').id],
    ])
  })
})

describe('공개 범위', () => {
  it('비공개 문서는 내용·ID가 결과물에 없고, 링크는 없는 문서와 똑같이 null', () => {
    const json = JSON.stringify(graph)
    expect(json).not.toContain('카나리아')
    expect(graph.docs.some((d) => d.title === '통장 비번')).toBe(false)
    const edge = graph.edges.find((e) => e.source === doc('고정 IP 설정').id && e.relation === 'see_also')
    expect(edge).toMatchObject({ target: null, targetLabel: '통장 비번' })
    // 본문 [[통장 비번]]도 같은 규칙 — 결과물에선 없는 문서([[공유기 설정]])와 똑같이 생겼다
    const bodyEdge = (from: string, label: string) =>
      graph.edges.find((e) => e.source === doc(from).id && e.relation === 'link' && e.targetLabel === label)
    expect(bodyEdge('고정 IP 설정', '통장 비번')).toMatchObject({ target: null, origin: 'body' })
    expect(bodyEdge('회고 - 도커 쓸만한가', '공유기 설정')).toMatchObject({ target: null, origin: 'body' })
    // 비공개인지 없는 건지는 로컬 리포트에만
    expect(report.privateRefs).toEqual([
      '고정 IP 설정 → [[통장 비번]] (see_also)',
      '고정 IP 설정 → [[통장 비번]] (link)',
      '회고 - 도커 쓸만한가 → [[몰래 쓰는 중]] (see_also) — draft',
    ])
    expect(report.missingRefs).toEqual(['공유기 비번 찾기 → [[공유기 설정]] (prev)', '회고 - 도커 쓸만한가 → [[공유기 설정]] (link)'])
  })

  it('태그 draft인 글은 비공개와 똑같이: 내용·ID 0, 거는 링크는 null, 트리에도 없음', () => {
    expect(JSON.stringify(graph)).not.toContain('드래프트-카나리아')
    expect(graph.docs.some((d) => d.title === '몰래 쓰는 중')).toBe(false)
    expect(report.drafts).toEqual([{ relPath: '홈서버 구축기/몰래 쓰는 중.md', id: '6af717e03fe41b1a65b87a8d' }])
    expect(JSON.stringify(graph)).not.toContain(report.drafts[0].id)
    const edge = graph.edges.find((e) => e.source === doc('회고 - 도커 쓸만한가').id && e.targetLabel === '몰래 쓰는 중')
    expect(edge).toMatchObject({ target: null, relation: 'see_also' })
    expect(index.nextOf.get(doc('도커 설치').id)).toHaveLength(3) // draft는 네 번째 갈래가 안 됨
  })

  it('하위 폴더는 자동으로 공개 (하위 컬렉션) — 위 폴더만 적어도 같은 결과', () => {
    const only = build(['홈서버 구축기']).graph
    expect(only.collections.map((c) => c.id)).toEqual(graph.collections.map((c) => c.id))
    expect(only.docs.map((d) => d.id)).toEqual(graph.docs.map((d) => d.id))
  })

  it('무시 폴더(기본 _image)는 그 아래까지 비공개, 글 없는 사이 폴더는 컬렉션으로 이어 준다', () => {
    const vault = mkdtempSync(join(tmpdir(), 'dumpster-ignore-'))
    try {
      cpSync(vaultDir, vault, { recursive: true })
      const put = (rel: string) => {
        mkdirSync(join(vault, dirname(rel)), { recursive: true })
        writeFileSync(join(vault, rel), '숨은 글\n')
      }
      put('홈서버 구축기/_image/첨부 메모.md')
      put('홈서버 구축기/_image/더 아래/메모2.md')
      put('홈서버 구축기/부록/더 깊은/깊은 글.md')
      put('홈서버 구축기/~초안/초안 글.md')
      const run = (ignoreFolders?: string[]) =>
        buildGraph({ vaultDir: vault, publicFolders: ['홈서버 구축기'], ignoreFolders, dates: () => FIXED, vaultCommit: null, now: () => new Date(0) }).graph
      const g = run()
      const paths = g.collections.map((c) => c.path.join('/'))
      expect(paths).toContain('홈서버 구축기/부록') // 글은 없지만 '더 깊은'으로 가는 사이 폴더
      expect(paths).toContain('홈서버 구축기/부록/더 깊은')
      expect(paths.some((p) => p.includes('_image'))).toBe(false)
      expect(g.docs.some((d) => d.title === '첨부 메모' || d.title === '메모2')).toBe(false)
      expect(g.docs.some((d) => d.title === '깊은 글')).toBe(true)
      // 직접 지정하면 기본값 대신 그것만
      const g2 = run(['~초안'])
      expect(g2.docs.some((d) => d.title === '초안 글')).toBe(false)
      expect(g2.docs.some((d) => d.title === '첨부 메모')).toBe(true)
    } finally {
      rmSync(vault, { recursive: true, force: true })
    }
  })

  it('0바이트 폴더 노트는 건너뛴다', () => {
    expect(report.skipped).toEqual([{ relPath: '홈서버 구축기/홈서버 구축기.md', reason: '빈 파일 (폴더 노트 등)' }])
    expect(graph.docs).toHaveLength(25) // 홈서버 구축기 21 (draft 제외) + 시즌2 4
  })

  it('없는 폴더를 공개 목록에 적으면 리포트', () => {
    expect(build(['없는 폴더']).report.missingFolders).toEqual(['없는 폴더'])
  })
})
