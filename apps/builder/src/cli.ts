import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { SCHEMA_VERSION, buildGraphIndex, treeToText, type Block, type Graph } from '@dumpster/schema'
import { buildGraph } from './build'
import { diffGraphs } from './diff'

// pnpm graph — .env의 볼트를 읽어 graph.json을 쓰고, 컬렉션별 트리와 리포트를 찍는다.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const fromRoot = (p: string) => (isAbsolute(p) ? p : p.startsWith('~/') ? resolve(homedir(), p.slice(2)) : resolve(repoRoot, p))

const vault = process.env.DUMPSTER_VAULT
if (!vault) {
  console.error('DUMPSTER_VAULT가 없어요. .env.example을 .env로 복사하세요.')
  process.exit(1)
}
const vaultDir = fromRoot(vault)
const publicFolders = (process.env.DUMPSTER_PUBLIC ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const outFile = fromRoot(process.env.DUMPSTER_OUT ?? 'out/graph.json')
if (!publicFolders.length) console.warn('⚠ DUMPSTER_PUBLIC이 비어 있어요 — 아무것도 공개되지 않아요.')

// 덮어쓰기 전에 이전 결과를 읽어 둔다 — 빌드 간 비교용 (스키마가 다르면 비교 안 함)
let previous: Graph | null = null
let previousNote = ''
if (existsSync(outFile)) {
  try {
    const parsed = JSON.parse(readFileSync(outFile, 'utf8')) as Graph
    if (parsed.schemaVersion === SCHEMA_VERSION) previous = parsed
    else previousNote = `이전 결과의 스키마 버전(${parsed.schemaVersion})이 달라 비교 안 함`
  } catch {
    previousNote = '이전 결과를 읽지 못해 비교 안 함'
  }
}

const started = performance.now()
const { graph, report, assets } = buildGraph({ vaultDir, publicFolders })
const json = JSON.stringify(graph, null, 2)
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, json + '\n')
// 이미지: graph.json 옆 assets/<해시>.<ext>. 이름이 내용 해시라 이미 있으면 건너뛴다
let copied = 0
for (const asset of assets) {
  const dest = join(dirname(outFile), asset.src)
  if (existsSync(dest)) continue
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(asset.file, dest)
  copied++
}
const ms = Math.round(performance.now() - started)

// 빌드 비교는 트리 줄 끝에 표시 (🆕 새로 공개 · ✏️ 수정 · 🔁 ID 바뀜). 첫 빌드는 전부 🆕라 표시 안 함
const diff = diffGraphs(previous, graph)
const marks = new Map<string, string>()
if (!diff.first) {
  for (const d of diff.added) marks.set(d.id, '🆕')
  for (const d of diff.changed) marks.set(d.id, `✏️ ${d.what.join(', ')}`)
  for (const d of diff.reidentified) marks.set(d.id, `🔁${d.what.length ? ` + ${d.what.join(', ')}` : ''}`)
}

const index = buildGraphIndex(graph)
for (const c of graph.collections) {
  console.log(`\n■ ${c.path.join(' / ')}  (${index.docsByCollection.get(c.id)?.length ?? 0}개)`)
  console.log(treeToText(index, c.id, (id) => marks.get(id) ?? null))
}

const section = (title: string, items: string[]) => {
  if (!items.length) return
  console.log(`\n${title} ${items.length}`)
  for (const item of items) console.log(`  - ${item}`)
}
section('⚠ 경고', report.warnings)
section('⏭ 건너뜀', report.skipped.map((s) => `${s.relPath} (${s.reason})`))
section('🔒 비공개 문서를 가리키는 링크 (결과물엔 없는 문서로 나감)', report.privateRefs)
section('❓ 없는 문서를 가리키는 링크', report.missingRefs)
section('📁 공개 목록에 있지만 없는 폴더', report.missingFolders)
section('📝 draft (태그로 숨김)', report.drafts.map((d) => d.relPath))

// 요약 한 줄 + 트리에 자리가 없는 🗑 사라진 글만 목록으로
if (diff.first) {
  console.log(`\n⇄ ${previousNote || '첫 빌드 — 비교할 이전 결과 없음'} (문서 ${graph.docs.length}개)`)
} else {
  const draftIds = new Set(report.drafts.map((d) => d.id))
  console.log(
    `\n⇄ 이전 빌드와 비교 (표시는 위 트리 줄 끝) — 🆕 새로 공개 ${diff.added.length} · ✏️ 수정 ${diff.changed.length}` +
      ` · 🔁 ID 바뀜 ${diff.reidentified.length} · 🗑 사라짐 ${diff.removed.length} · 그대로 ${diff.unchanged}`,
  )
  for (const d of diff.removed) console.log(`  🗑 ${d.title} — ${draftIds.has(d.id) ? 'draft로 숨김' : '삭제·비공개로 이동·공개 목록에서 뺌'}`)
}

const blockCounts = new Map<string, number>()
const countBlocks = (blocks: Block[]) => {
  for (const b of blocks) {
    blockCounts.set(b.type, (blockCounts.get(b.type) ?? 0) + 1)
    if (b.type === 'list') for (const item of b.items) countBlocks(item.children)
    if (b.type === 'blockquote' || b.type === 'callout') countBlocks(b.children)
  }
}
for (const d of graph.docs) countBlocks(d.blocks)
console.log(`\n▦ 블록 ${[...blockCounts].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(' · ')}`)

console.log(
  `\n✔ ${relative(repoRoot, outFile)} — 컬렉션 ${graph.collections.length} · 문서 ${graph.docs.length} · 엣지 ${graph.edges.length}` +
    ` · 이미지 ${assets.length}(새로 복사 ${copied}) · ${(Buffer.byteLength(json) / 1024).toFixed(1)}KB · ${ms}ms`,
)
