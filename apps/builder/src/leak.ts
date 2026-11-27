import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { IMAGE_EXTENSIONS, extensionOf } from '@dumpster/markdown'
import type { Graph } from '@dumpster/schema'

// 배포 전 유출 검사 — 빌드 결과(dist)에 공개하면 안 되는 것이 섞였는지 본다. 하나라도 걸리면 배포 안 함.
//
// 빌더와 일부러 따로 판정한다 (vault.ts·build.ts를 안 씀): 빌더 판정에 버그가 있으면 검사도 같이 틀리니까.
// 빌더는 비공개 파일을 안 읽지만 검사기는 읽는다 — 그 내용이 결과물에 있는지 봐야 하므로.
// 대신 무엇이 걸렸는지(비공개 경로·조각)는 detail에만 담고, CI에선 개수만 찍는다 (leak-cli.ts).
//
// 비공개 글 '제목'은 검사하지 않는다 — 공개 글 본문의 [[통장 비번]]처럼 작성자가 쓴 링크 글자,
// frontmatter의 targetLabel로 정상적으로 나간다 (없는 문서와 똑같이 target null).

export interface LeakCheck {
  name: string
  problems: { summary: string; detail: string }[] // summary: 비공개 이름 없음(공개 로그용) · detail: 자세히(로컬용)
}

export interface LeakOptions {
  vaultDir: string
  publicFolders: string[]
  distDir: string // graph.json · assets/ · index.html이 있는 폴더
  minFragment?: number // 비공개 본문 한 줄을 글자·숫자만 남겼을 때 이 길이 이상만 본다 (짧은 줄은 우연히 겹침)
}

const norm = (p: string) => p.normalize('NFC').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
// 글자·숫자만 — 마크다운 기호·링크 괄호·공백·줄바꿈 차이를 지워서 원문 줄과 렌더된 글을 맞댄다
const squash = (s: string) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

interface SourceNote {
  relPath: string
  raw: string
  body: string
  oid: string | null
  draft: boolean
}

function readFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw)
  if (!m) return { data: {}, body: raw }
  let data: Record<string, unknown> = {}
  try {
    const parsed = parseYaml(m[1]) as unknown
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>
  } catch {
    // 깨진 frontmatter — 태그를 모르니 draft 아님으로 본다 (그래도 공개 폴더 밖이면 비공개로 검사됨)
  }
  return { data, body: raw.slice(m[0].length) }
}

function readNotes(vaultDir: string): SourceNote[] {
  const notes: SourceNote[] = []
  const walk = (relDir: string) => {
    for (const entry of readdirSync(join(vaultDir, relDir), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const relPath = norm(relDir ? posix.join(relDir, entry.name) : entry.name)
      if (entry.isDirectory()) walk(relPath)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const raw = readFileSync(join(vaultDir, relPath), 'utf8')
        const { data, body } = readFrontmatter(raw)
        const tags = (Array.isArray(data.tags) ? data.tags : [data.tags]).filter((t): t is string => typeof t === 'string')
        const oid = typeof data.oid === 'string' && /^[0-9a-f]{24}$/i.test(data.oid.trim()) ? data.oid.trim().toLowerCase() : null
        notes.push({ relPath, raw, body, oid, draft: tags.some((t) => t.replace(/^#/, '').trim().toLowerCase() === 'draft') })
      }
    }
  }
  walk('')
  return notes
}

// graph의 모든 문자열 (sections는 블록에서 뽑은 평문이라 겹침 — 본문 조각 검사엔 그대로 씀)
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out)
  return out
}

// 코드 밖 글자에 %%가 있는지 — 코드 블록(type: code)·인라인 코드(code: true)는 글자 그대로라 뺀다.
// sections는 코드까지 섞인 평문이라 뺀다 (같은 글자를 blocks에서 본다)
function percentHits(value: unknown, path: string, out: string[]) {
  if (typeof value === 'string') {
    if (value.includes('%%')) out.push(path)
  } else if (Array.isArray(value)) value.forEach((v, i) => percentHits(v, `${path}[${i}]`, out))
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (o.type === 'code' || o.code === true) return
    for (const [k, v] of Object.entries(o)) if (k !== 'sections') percentHits(v, `${path}.${k}`, out)
  }
}

export function checkLeaks(opts: LeakOptions): LeakCheck[] {
  const minFragment = opts.minFragment ?? 10
  const publicSet = new Set(opts.publicFolders.map(norm).filter(Boolean))
  const graphFile = join(opts.distDir, 'graph.json')
  if (!existsSync(graphFile)) return [{ name: 'graph.json', problems: [{ summary: 'graph.json이 없음', detail: graphFile }] }]
  const graphText = readFileSync(graphFile, 'utf8')
  const graph = JSON.parse(graphText) as Graph

  const notes = readNotes(opts.vaultDir)
  const isPublic = (n: SourceNote) => !n.draft && publicSet.has(norm(posix.dirname(n.relPath) === '.' ? '' : posix.dirname(n.relPath)))
  const hidden = notes.filter((n) => !isPublic(n))
  const publicSource = squash(notes.filter(isPublic).map((n) => n.raw).join('\n'))

  const checks: LeakCheck[] = []

  // 1. 빈 배포 — 공개 목록이 비었거나 볼트를 못 받았으면 사이트가 통째로 비어 버린다
  checks.push({
    name: '문서 수',
    problems: graph.docs.length ? [] : [{ summary: '문서 0개 — 볼트·공개 목록을 확인', detail: '문서 0개' }],
  })

  // 2. 컬렉션은 공개 목록 안에서만
  checks.push({
    name: '컬렉션',
    problems: graph.collections
      .filter((c) => !publicSet.has(norm(c.path.join('/'))))
      .map((c) => ({ summary: '공개 목록 밖 컬렉션', detail: c.path.join('/') })),
  })

  // 3. 비공개·draft 글의 oid가 어디에도 없다 (JS·CSS·index.html 포함)
  const distText = [graphText, ...textFiles(opts.distDir)].join('\n').toLowerCase()
  checks.push({
    name: '비공개 oid',
    problems: hidden
      .filter((n) => n.oid && distText.includes(n.oid))
      .map((n) => ({ summary: `${n.draft ? 'draft' : '비공개'} 글의 oid`, detail: `${n.relPath} (${n.oid})` })),
  })

  // 4. 비공개·draft 본문 줄이 graph 글자에 없다. 공개 글 원문에도 있는 줄(같은 명령어 등)은 뺀다
  const corpus = squash(strings(graph).join('\n'))
  const fragments: LeakCheck['problems'] = []
  for (const n of hidden) {
    const seen = new Set<string>()
    for (const line of n.body.split(/\r?\n/)) {
      const s = squash(line)
      if (s.length < minFragment || seen.has(s) || publicSource.includes(s)) continue
      seen.add(s)
      if (corpus.includes(s)) fragments.push({ summary: `${n.draft ? 'draft' : '비공개'} 글 본문 한 줄`, detail: `${n.relPath}: ${line.trim()}` })
    }
  }
  checks.push({ name: '비공개 본문', problems: fragments })

  // 5. 코드 밖 %% — 파서가 주석을 못 지웠다는 뜻
  const percent: string[] = []
  percentHits(graph.docs, 'docs', percent)
  checks.push({
    name: '%% 주석',
    problems: percent.map((p) => {
      const i = Number(/^docs\[(\d+)\]/.exec(p)?.[1])
      return { summary: '코드 밖 %%', detail: `${graph.docs[i]?.title ?? '?'} — ${p}` }
    }),
  })

  // 6. assets/의 그림은 graph가 쓰는 것만 (남은 그림 = 옛 빌드나 비공개 폴더 그림일 수 있음)
  const used = new Set(strings(graph).filter((s) => /^assets\/[^/]+$/.test(s)).map((s) => s.slice('assets/'.length)))
  const assetsDir = join(opts.distDir, 'assets')
  const images = existsSync(assetsDir)
    ? readdirSync(assetsDir).filter((f) => IMAGE_EXTENSIONS.has(extensionOf(f)))
    : []
  checks.push({
    name: '그림',
    problems: [
      ...images.filter((f) => !used.has(f)).map((f) => ({ summary: 'graph가 안 쓰는 그림', detail: `assets/${f}` })),
      ...[...used].filter((f) => !images.includes(f)).map((f) => ({ summary: 'graph가 쓰는데 없는 그림', detail: `assets/${f}` })),
    ],
  })

  // 7. 마크다운 원문·.env 같은 파일이 딸려 가지 않았다
  checks.push({
    name: '파일 종류',
    problems: allFiles(opts.distDir)
      .filter((f) => /\.(md|env)$|(^|\/)\.env/i.test(f))
      .map((f) => ({ summary: '올라가면 안 되는 파일', detail: f })),
  })

  return checks
}

function allFiles(dir: string, rel = ''): string[] {
  return readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const p = rel ? `${rel}/${e.name}` : e.name
    return e.isDirectory() ? allFiles(dir, p) : [p]
  })
}

function textFiles(dir: string): string[] {
  return allFiles(dir)
    .filter((f) => /\.(js|css|html|json|txt|xml|svg)$/i.test(f) && f !== 'graph.json')
    .map((f) => readFileSync(join(dir, f), 'utf8'))
}
