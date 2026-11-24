import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
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

  it('시즌2 — 다른 컬렉션에서 이어진 글은 루트로, 출처 표시', () => {
    expect(treeToText(index, '홈서버-구축기/시즌2')).toBe(
      ['● OT.홈서버 시즌2', '● k3s 도전기  ↰ 회고 - 도커 쓸만한가', '● 노드 하나 더'].join('\n'),
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

describe('문서 ID = 이름 + createdAt', () => {
  it('형식별 createdAt이 같은 규칙으로 스탬프가 된다', () => {
    expect(doc('도커 설치').id).toBe('도커-설치-2611041940')
    expect(doc('라즈베리파이 고르기').id).toBe('라즈베리파이-고르기-2611020000') // 날짜만
    expect(doc('OS 설치').id).toBe('os-설치-2611031000') // ISO
    expect(doc('OS 설치').createdAt).toBe('2026-11-03T10:00:00+09:00')
    expect(doc('회고 - 도커 쓸만한가').id).toBe('회고-도커-쓸만한가-2611122350')
  })

  it('같은 분에 만든 글도 이름이 달라 안 겹친다', () => {
    expect(doc('자막 깨짐').id).toBe('자막-깨짐-2611102130')
    expect(doc('하드웨어 트랜스코딩').id).toBe('하드웨어-트랜스코딩-2611102130')
    expect(new Set(graph.docs.map((d) => d.id)).size).toBe(graph.docs.length)
  })

  it('createdAt 없으면 git(여기선 고정값) 날짜', () => {
    expect(doc('전원 어댑터 메모').id).toBe('전원-어댑터-메모-2611241200')
    expect(stampOf(doc('전원 어댑터 메모').id)).toBe('2611241200')
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
    expect(report.privateRefs).toEqual(['고정 IP 설정 → [[통장 비번]] (see_also)', '고정 IP 설정 → [[통장 비번]] (link)'])
    expect(report.missingRefs).toEqual(['공유기 비번 찾기 → [[공유기 설정]] (prev)', '회고 - 도커 쓸만한가 → [[공유기 설정]] (link)'])
  })

  it('하위 폴더는 자동으로 공개되지 않는다', () => {
    const only = build(['홈서버 구축기']).graph
    expect(only.collections.map((c) => c.id)).toEqual(['홈서버-구축기'])
    expect(only.docs.some((d) => d.title === 'k3s 도전기')).toBe(false)
  })

  it('0바이트 폴더 노트는 건너뛴다', () => {
    expect(report.skipped).toEqual([{ relPath: '홈서버 구축기/홈서버 구축기.md', reason: '빈 파일 (폴더 노트 등)' }])
    expect(graph.docs).toHaveLength(24)
  })

  it('없는 폴더를 공개 목록에 적으면 리포트', () => {
    expect(build(['없는 폴더']).report.missingFolders).toEqual(['없는 폴더'])
  })
})
