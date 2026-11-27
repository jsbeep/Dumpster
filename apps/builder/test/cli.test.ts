import { afterAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// pnpm graph 출력 — CI(공개 레포의 Actions 로그)에선 비공개 이름이 한 글자도 안 나와야 한다.
// 짜가 볼트에서 비공개 이름이 나오는 곳: 🔒 비공개 링크(통장 비번), 📝 draft·see_also(몰래 쓰는 중), 비밀 금고 폴더

const builderDir = resolve(__dirname, '..')
const out = mkdtempSync(join(tmpdir(), 'dumpster-cli-'))
afterAll(() => rmSync(out, { recursive: true, force: true }))

const run = (env: Record<string, string>) => {
  const { CI: _ci, DUMPSTER_QUIET: _q, ...rest } = process.env
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts'], {
    cwd: builderDir,
    encoding: 'utf8',
    env: {
      ...rest,
      DUMPSTER_VAULT: 'fixtures/vault',
      DUMPSTER_PUBLIC: '홈서버 구축기,홈서버 구축기/시즌2,블록 견본',
      DUMPSTER_OUT: join(out, 'graph.json'),
      ...env,
    },
  })
  expect(r.status).toBe(0)
  return r.stdout + r.stderr
}

const PRIVATE = ['통장 비번', '몰래 쓰는 중', '비밀 금고']

describe('pnpm graph 출력', () => {
  it('보통은 비공개 이름까지 자세히 찍는다 (아래 검사가 헛돌지 않는지)', () => {
    const text = run({})
    expect(text).toContain('통장 비번')
    expect(text).toContain('몰래 쓰는 중')
  })

  it('DUMPSTER_QUIET=1이면 개수만 — 비공개 이름 0', () => {
    const text = run({ DUMPSTER_QUIET: '1' })
    for (const name of PRIVATE) expect(text).not.toContain(name)
    expect(text).toMatch(/🔒 .* 4/)
    expect(text).toMatch(/📝 .* 1/)
    expect(text).toMatch(/문서 32/)
  })

  it('CI=true면 저절로 조용하고, DUMPSTER_QUIET=0이면 다시 자세히', () => {
    const ci = run({ CI: 'true' })
    for (const name of PRIVATE) expect(ci).not.toContain(name)
    expect(run({ CI: 'true', DUMPSTER_QUIET: '0' })).toContain('통장 비번')
  })
})
