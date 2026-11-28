import { dirname, isAbsolute, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { checkLeaks } from './leak'

// pnpm check:leak [dist 폴더] — 배포 직전 유출 검사. 걸리면 exit 1 (워크플로가 배포 job을 안 돌림).
// 기본 dist = apps/web/dist. CI(또는 DUMPSTER_QUIET=1)에선 무엇이 걸렸는지 대신 개수만 — 로그가 공개라서.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const fromRoot = (p: string) => (isAbsolute(p) ? p : p.startsWith('~/') ? resolve(homedir(), p.slice(2)) : resolve(repoRoot, p))

const vault = process.env.DUMPSTER_VAULT
if (!vault) {
  console.error('DUMPSTER_VAULT가 없어요.')
  process.exit(1)
}
const quiet = process.env.DUMPSTER_QUIET === '1' || (!!process.env.CI && process.env.DUMPSTER_QUIET !== '0')
const checks = checkLeaks({
  vaultDir: fromRoot(vault),
  publicFolders: (process.env.DUMPSTER_PUBLIC ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  ignoreFolders: (process.env.DUMPSTER_IGNORE || '_image').split(',').map((s) => s.trim()).filter(Boolean),
  distDir: fromRoot(process.argv[2] ?? 'apps/web/dist'),
})

let failed = 0
for (const c of checks) {
  if (!c.problems.length) {
    console.log(`✔ ${c.name}`)
    continue
  }
  failed += c.problems.length
  console.log(`✘ ${c.name} ${c.problems.length}건`)
  if (quiet) {
    const bySummary = new Map<string, number>()
    for (const p of c.problems) bySummary.set(p.summary, (bySummary.get(p.summary) ?? 0) + 1)
    for (const [s, n] of bySummary) console.log(`  - ${s} ${n}`)
  } else for (const p of c.problems) console.log(`  - ${p.summary}: ${p.detail}`)
}
if (failed) {
  console.log(`\n✘ 유출 검사 실패 ${failed}건 — 배포 안 함${quiet ? ' (자세히: 로컬에서 DUMPSTER_QUIET=0 pnpm check:leak)' : ''}`)
  process.exit(1)
}
console.log('\n✔ 유출 검사 통과')
