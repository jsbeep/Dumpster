import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { Graph } from '@dumpster/schema'
import { buildGraph } from '../src/build'
import { checkLeaks } from '../src/leak'

// 유출 검사: 짜가 볼트 정상 빌드는 통과, 일부러 섞은 것은 하나씩 걸린다.

const vaultDir = resolve(__dirname, '../../../fixtures/vault')
const publicFolders = ['홈서버 구축기', '홈서버 구축기/시즌2', '블록 견본']
const root = mkdtempSync(join(tmpdir(), 'dumpster-leak-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

// 깨끗한 dist 한 벌 — graph.json + assets/ + 가짜 JS
const clean = join(root, 'clean')
{
  const { graph, assets } = buildGraph({ vaultDir, publicFolders })
  mkdirSync(join(clean, 'assets'), { recursive: true })
  writeFileSync(join(clean, 'graph.json'), JSON.stringify(graph))
  for (const a of assets) copyFileSync(a.file, join(clean, a.src))
  writeFileSync(join(clean, 'assets', 'index-abc.js'), 'console.log("app")')
  writeFileSync(join(clean, 'index.html'), '<!doctype html><title>Dumpster</title>')
}

let dist = ''
let n = 0
beforeEach(() => {
  dist = join(root, `case-${n++}`)
  cpSync(clean, dist, { recursive: true })
})
const graphOf = () => JSON.parse(readFileSync(join(dist, 'graph.json'), 'utf8')) as Graph
const save = (g: Graph) => writeFileSync(join(dist, 'graph.json'), JSON.stringify(g))
const check = () => checkLeaks({ vaultDir, publicFolders, distDir: dist })
const failed = () => Object.fromEntries(check().filter((c) => c.problems.length).map((c) => [c.name, c.problems]))
const para = (text: string) => ({ type: 'paragraph', inlines: [{ text }] }) as Graph['docs'][number]['blocks'][number]

describe('유출 검사', () => {
  it('짜가 볼트 정상 빌드는 전부 통과 (공개 글의 [[통장 비번]] 링크 글자는 괜찮음)', () => {
    expect(readFileSync(join(dist, 'graph.json'), 'utf8')).toContain('통장 비번')
    expect(failed()).toEqual({})
  })

  it('비공개 글 본문 한 줄이 섞이면 걸린다', () => {
    const g = graphOf()
    g.docs[0].blocks.push(para('카나리아-이-문장이-graph.json에-보이면-유출'))
    save(g)
    const f = failed()
    expect(Object.keys(f)).toEqual(['비공개 본문'])
    expect(f['비공개 본문'][0].summary).toBe('비공개 글 본문 한 줄')
    expect(f['비공개 본문'][0].summary).not.toContain('통장')
    expect(f['비공개 본문'][0].detail).toContain('비밀 금고/통장 비번.md')
  })

  it('draft 글 본문은 마크다운 꾸밈이 달라도 걸린다', () => {
    const g = graphOf()
    g.docs[0].blocks.push({ type: 'paragraph', inlines: [{ text: '아직 ' }, { text: '공개하면', bold: true }, { text: ' 안 되는 메모' }] } as never)
    save(g)
    expect(failed()['비공개 본문']?.[0].summary).toBe('draft 글 본문 한 줄')
  })

  it('draft 글의 oid가 어디에든 (JS 안이라도) 있으면 걸린다', () => {
    writeFileSync(join(dist, 'assets', 'index-abc.js'), 'const id="6af717e03fe41b1a65b87a8d"')
    expect(Object.keys(failed())).toEqual(['비공개 oid'])
  })

  it('코드 밖 %%는 걸리고, 코드 안 %%는 괜찮다', () => {
    const g = graphOf()
    g.docs[0].blocks.push({ type: 'paragraph', inlines: [{ text: '%%', code: true }] } as never)
    save(g)
    expect(failed()).toEqual({})
    g.docs[0].blocks.push(para('남은 %%주석%%'))
    save(g)
    expect(Object.keys(failed())).toEqual(['%% 주석'])
  })

  it('graph가 안 쓰는 그림 · 쓰는데 없는 그림', () => {
    writeFileSync(join(dist, 'assets', '0000000000000000.png'), 'x')
    expect(failed()['그림']?.map((p) => p.summary)).toEqual(['graph가 안 쓰는 그림'])
    rmSync(join(dist, 'assets', '0000000000000000.png'))
    const used = /"src":"assets\/([^"]+)"/.exec(readFileSync(join(dist, 'graph.json'), 'utf8'))![1]
    rmSync(join(dist, 'assets', used))
    expect(failed()['그림']?.map((p) => p.summary)).toEqual(['graph가 쓰는데 없는 그림'])
  })

  it('공개 목록 밖 컬렉션 · 문서 0개 · .md 파일', () => {
    const g = graphOf()
    g.collections[0].path = ['비밀 금고']
    save(g)
    expect(Object.keys(failed())).toEqual(['컬렉션'])
    save({ ...graphOf(), docs: [] })
    expect(Object.keys(failed())).toContain('문서 수')
    save(JSON.parse(readFileSync(join(clean, 'graph.json'), 'utf8')))
    mkdirSync(dirname(join(dist, 'x/통장 비번.md')), { recursive: true })
    writeFileSync(join(dist, 'x/통장 비번.md'), '')
    expect(Object.keys(failed())).toEqual(['파일 종류'])
  })

  it('공개 글 원문에도 있는 줄(같은 명령어·복붙)은 비공개 글에 있어도 유출로 안 본다 · 짧은 줄은 안 봄', () => {
    const vault = join(root, 'vault-copy')
    cpSync(vaultDir, vault, { recursive: true })
    // '고정 IP 설정'(공개) 본문 줄을 비공개 글에도 적음
    writeFileSync(join(vault, '비밀 금고/통장 비번.md'), '공유기에서 DHCP 예약으로 해결\n카나리아-이-문장이-graph.json에-보이면-유출\n')
    expect(checkLeaks({ vaultDir: vault, publicFolders, distDir: dist }).every((c) => !c.problems.length)).toBe(true)
    const g = graphOf()
    g.docs[0].blocks.push(para('아직 공개하면')) // draft 글 줄의 앞부분 — 글자·숫자 10개 미만
    save(g)
    expect(failed()).toEqual({})
  })
})
