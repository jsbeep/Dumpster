import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { buildGraphIndex, type Graph } from '@dumpster/schema'
import { buildGraph } from '../src/build'
import { diffGraphs } from '../src/diff'

// 빌드 간 시나리오: 임시 볼트(진짜 git 레포) → 빌드 → 볼트를 바꿈 → 다시 빌드 → 비교.
// 커밋 시각을 고정해서 updatedAt까지 결정적으로 확인한다.
//
//   일지/ (공개)   OT.일지 ← A ← B ← C        B 본문에 [[C]]
//   비밀/ (비공개)  메모

const OID = {
  M: '6b0000000000000000000000',
  A: '6b000000000000000000000a',
  B: '6b000000000000000000000b',
  C: '6b000000000000000000000c',
  D: '6b000000000000000000000d',
}
type Fm = Record<string, string | string[] | undefined>
const BASE: Record<string, Fm> = {
  'OT.일지': { oid: OID.M, type: 'manifest', createdAt: '2026-11-01T10:00' },
  A: { oid: OID.A, prev: '"[[OT.일지]]"', createdAt: '2026-11-01T11:00' },
  B: { oid: OID.B, prev: '"[[A]]"', createdAt: '2026-11-01T12:00' },
  C: { oid: OID.C, prev: '"[[B]]"', createdAt: '2026-11-01T13:00' },
  D: { oid: OID.D, prev: '"[[C]]"', createdAt: '2026-11-01T14:00' },
}
const BODY: Record<string, string> = { 'OT.일지': '일지 소개', A: '처음', B: '다음은 [[C]]', C: '끝', D: '추가' }

let dir: string
let tick = 0

const git = (args: string[], date?: string) =>
  execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
    stdio: 'pipe',
    env: date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env,
  })
const commit = () => {
  const date = `2026-11-${10 + tick++}T12:00:00+09:00`
  git(['add', '-A'])
  git(['commit', '-q', '-m', `c${tick}`], date)
  return date
}
const path = (title: string, folder = '일지') => join(dir, folder, `${title}.md`)
// 노트 쓰기: BASE 속성 위에 덮어쓰기 (값이 undefined면 그 키를 뺀다)
const write = (title: string, fm: Fm = {}, body = BODY[title], folder = '일지') => {
  const lines = Object.entries({ ...BASE[title], ...fm })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => (Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join('\n')}` : `${k}: ${v}`))
  mkdirSync(join(dir, folder), { recursive: true })
  writeFileSync(path(title, folder), `---\n${lines.join('\n')}\n---\n${body}\n`)
}
const build = (folders = ['일지']) => buildGraph({ vaultDir: dir, publicFolders: folders, now: () => new Date(0) })
const doc = (g: Graph, title: string) => g.docs.find((d) => d.title === title)
const titles = (xs: { title: string }[]) => xs.map((x) => x.title)

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dumpster-scenario-'))
  tick = 0
  git(['init', '-q'])
  for (const t of ['OT.일지', 'A', 'B', 'C']) write(t)
  mkdirSync(join(dir, '비밀'))
  writeFileSync(join(dir, '비밀', '메모.md'), '---\ntags:\n---\n비공개\n')
  commit()
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('빌드 간 시나리오', () => {
  it('첫 빌드는 비교할 게 없다', () => {
    const diff = diffGraphs(null, build().graph)
    expect(diff.first).toBe(true)
    expect(titles(diff.added)).toEqual(['OT.일지', 'A', 'B', 'C'])
  })

  it('1. 아무것도 안 바꾸면 변경 0, 결과가 바이트 단위로 똑같다 (결정적)', () => {
    const g1 = build().graph
    const g2 = build().graph
    expect(JSON.stringify(g2)).toBe(JSON.stringify(g1))
    expect(diffGraphs(g1, g2)).toMatchObject({ added: [], removed: [], changed: [], reidentified: [], unchanged: 4 })
  })

  it('2. 본문 수정 후 커밋: ID 그대로, 본문 바뀜, updatedAt = 커밋 시각', () => {
    const g1 = build().graph
    write('A', {}, '처음 — 고침')
    const date = commit()
    const g2 = build().graph
    expect(diffGraphs(g1, g2).changed).toEqual([{ id: OID.A, title: 'A', collectionId: '일지', what: ['본문'] }])
    expect(doc(g2, 'A')?.updatedAt).toBe(date)
  })

  it('3. 커밋 전 수정: git 날짜는 낡았으니 updatedAt = 파일 수정 시각', () => {
    write('C', {}, '끝 — 아직 커밋 안 함')
    const mtime = new Date('2026-11-30T03:00:00Z') // KST 12:00
    utimesSync(path('C'), mtime, mtime)
    expect(doc(build().graph, 'C')?.updatedAt).toBe('2026-11-30T12:00:00+09:00')
  })

  it('4. 새 글 추가: 새로 공개 1, 부모의 다음 글에 나타남', () => {
    const g1 = build().graph
    write('D')
    commit()
    const g2 = build().graph
    const diff = diffGraphs(g1, g2)
    expect(titles(diff.added)).toEqual(['D'])
    expect(diff.changed).toEqual([])
    expect(buildGraphIndex(g2).nextOf.get(OID.C)?.map((d) => d.title)).toEqual(['D'])
  })

  it('5. 이름 변경 (옵시디언이 링크도 같이 고침): ID 그대로, 그 글만 제목 바뀜', () => {
    const g1 = build().graph
    renameSync(path('B'), path('B2'))
    write('C', { prev: '"[[B2]]"' })
    commit()
    const g2 = build().graph
    const diff = diffGraphs(g1, g2)
    expect(diff.changed).toEqual([{ id: OID.B, title: 'B2', collectionId: '일지', what: ['제목 (B →)'] }]) // C는 안 잡힘
    expect(g2.edges.find((e) => e.source === OID.C && e.relation === 'prev')?.target).toBe(OID.B)
  })

  it('6. 삭제: 사라짐 1, 그 글을 prev로 둔 글은 연결 안 됨', () => {
    const g1 = build().graph
    rmSync(path('B'))
    commit()
    const g2 = build().graph
    expect(titles(diffGraphs(g1, g2).removed)).toEqual(['B'])
    expect(doc(g2, 'B')).toBeUndefined()
    expect(g2.edges.find((e) => e.source === OID.C && e.relation === 'prev')).toMatchObject({ target: null, targetLabel: 'B' })
    expect(buildGraphIndex(g2).tree('일지').orphans).toMatchObject([{ docId: OID.C, orphan: 'broken-prev' }])
  })

  it('7. 비공개 폴더로 이동: 결과물에선 삭제와 똑같고, 비공개인 건 리포트에만', () => {
    const g1 = build().graph
    renameSync(path('C'), path('C', '비밀'))
    commit()
    const { graph: g2, report } = build()
    expect(titles(diffGraphs(g1, g2).removed)).toEqual(['C'])
    expect(JSON.stringify(g2)).not.toContain(OID.C)
    expect(g2.edges.find((e) => e.source === OID.B && e.relation === 'link')).toMatchObject({ target: null })
    expect(report.privateRefs).toContain('B → [[C]] (link)')
  })

  it('8. 비공개 → 공개 폴더로 이동: 새로 공개', () => {
    write('D', {}, undefined, '비밀')
    commit()
    const g1 = build().graph
    renameSync(path('D', '비밀'), path('D'))
    commit()
    expect(titles(diffGraphs(g1, build().graph).added)).toEqual(['D'])
  })

  it('9. 사본 만들기: 원본이 oid를 지키고, 사본은 임시 ID + 경고', () => {
    const g1 = build().graph
    copyFileSync(path('A'), path('A 1'))
    commit()
    const { graph: g2, report } = build()
    expect(titles(diffGraphs(g1, g2).added)).toEqual(['A 1'])
    expect(doc(g2, 'A')?.id).toBe(OID.A)
    expect(doc(g2, 'A 1')?.id).toBe('a-1-2611011100')
    expect(report.warnings.some((w) => w.startsWith('일지/A 1.md: oid가') && w.includes('겹침'))).toBe(true)
  })

  it('10. 공개 목록에서 폴더를 빼면 그 글 전부 사라짐', () => {
    expect(diffGraphs(build(['일지']).graph, build([]).graph).removed).toHaveLength(4)
  })

  it('11. prev를 바꿔 다른 갈래로: prev 바뀜, 트리에서 자리 이동', () => {
    const g1 = build().graph
    write('C', { prev: '"[[A]]"' })
    commit()
    const g2 = build().graph
    expect(diffGraphs(g1, g2).changed).toEqual([{ id: OID.C, title: 'C', collectionId: '일지', what: ['prev'] }])
    expect(buildGraphIndex(g2).nextOf.get(OID.A)?.map((d) => d.title)).toEqual(['B', 'C'])
  })

  it('12. createdAt만 고침: oid라 ID 그대로, 속성 바뀜', () => {
    const g1 = build().graph
    write('C', { createdAt: '2026-11-01T13:30' })
    commit()
    const g2 = build().graph
    expect(diffGraphs(g1, g2).changed).toEqual([{ id: OID.C, title: 'C', collectionId: '일지', what: ['속성'] }])
  })

  it('13. draft 태그: 달면 사라지고(리포트엔 draft), 떼면 같은 ID로 돌아온다', () => {
    const g1 = build().graph
    write('C', { tags: ['draft'] })
    commit()
    const r2 = build()
    expect(titles(diffGraphs(g1, r2.graph).removed)).toEqual(['C'])
    expect(r2.report.drafts).toEqual([{ relPath: '일지/C.md', id: OID.C }])
    expect(JSON.stringify(r2.graph)).not.toContain(OID.C)

    write('C')
    commit()
    const g3 = build().graph
    expect(titles(diffGraphs(r2.graph, g3).added)).toEqual(['C'])
    expect(doc(g3, 'C')?.id).toBe(OID.C)
  })

  it('14. 옛 글에 oid 달기: ID 바뀜으로 묶이고, 그 글을 가리키던 글은 그대로', () => {
    write('B', { oid: undefined })
    commit()
    const g1 = build().graph
    expect(doc(g1, 'B')?.id).toBe('b-2611011200') // oid 없을 땐 임시 ID
    write('B')
    commit()
    const diff = diffGraphs(g1, build().graph)
    expect(diff.reidentified).toEqual([{ id: OID.B, title: 'B', collectionId: '일지', from: 'b-2611011200', what: [] }])
    expect(diff).toMatchObject({ added: [], removed: [], changed: [], unchanged: 3 }) // C의 prev도 안 잡힘
  })
})
