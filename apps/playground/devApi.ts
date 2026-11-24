import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'

// 플레이그라운드 저장 엔드포인트 — vite dev 전용 (build·preview엔 없다). 서버는 127.0.0.1에만 뜬다.
//   PUT /__dumpster/styles         → packages/blocks/src/styles.json
//   PUT /__dumpster/fences         → packages/markdown/src/fences.json
//   PUT /__dumpster/draft-classes  → apps/playground/.draft/classes.txt
//       저장 전 스타일 초안의 클래스 글자. Tailwind content에 들어 있어서, 아직 어디에도 없는 클래스도 바로 CSS가 생긴다.
// 검사는 패키지의 검사 함수를 vite로 불러 그대로 쓴다 — 브라우저와 같은 규칙.

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
export const DRAFT_CLASSES = resolve(here, '.draft/classes.txt')
const INDEX_CSS = resolve(here, 'src/index.css') // @tailwind이 든 CSS

const TARGETS: Record<string, { file: string; checker: [string, string] }> = {
  styles: { file: 'packages/blocks/src/styles.json', checker: ['packages/blocks/src/styles.ts', 'styleShapeError'] },
  fences: { file: 'packages/markdown/src/fences.json', checker: ['packages/markdown/src/fences.ts', 'fenceRulesError'] },
}

const MAX_BODY = 1 << 20

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) fail(new Error('본문이 너무 큼'))
      else chunks.push(c)
    })
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')))
    req.on('error', fail)
  })
}

// JSON.stringify(_, 2)와 같되 글자·숫자만 든 짧은 배열은 한 줄로 — 손으로 고칠 때와 같은 모양이라 저장 diff가 깨끗하다
export function formatJson(v: unknown, indent = ''): string {
  const inner = `${indent}  `
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== 'object')) {
      const line = `[${v.map((x) => JSON.stringify(x)).join(', ')}]`
      if (indent.length + line.length <= 100) return line
    }
    return v.length ? `[\n${v.map((x) => inner + formatJson(x, inner)).join(',\n')}\n${indent}]` : '[]'
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v)
    return entries.length ? `{\n${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${formatJson(x, inner)}`).join(',\n')}\n${indent}}` : '{}'
  }
  return JSON.stringify(v)
}

export function dumpsterDevApi(): Plugin {
  // 여기서 쓴 JSON은 HMR을 안 보낸다 — 화면이 이미 그 값(초안)을 들고 있어서, 다시 불러오면 편집 중인 다른 탭 초안만 날아간다
  const written = new Map<string, string>()
  let server: ViteDevServer

  return {
    name: 'dumpster-dev-api',
    apply: 'serve',
    configureServer(s) {
      server = s
      mkdirSync(dirname(DRAFT_CLASSES), { recursive: true })
      writeFileSync(DRAFT_CLASSES, '')
      server.middlewares.use('/__dumpster', async (req, res, next) => {
        const name = (req.url ?? '').replace(/^\//, '').split('?')[0]
        if (req.method !== 'PUT' || !(name in TARGETS || name === 'draft-classes')) return next()
        const reply = (status: number, body: object) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        }
        try {
          const text = await readBody(req)
          if (name === 'draft-classes') {
            if (readFileSync(DRAFT_CLASSES, 'utf8') !== text) writeFileSync(DRAFT_CLASSES, text)
            return reply(200, { ok: true })
          }
          const target = TARGETS[name]
          let data: unknown
          try {
            data = JSON.parse(text)
          } catch {
            return reply(400, { error: 'JSON이 아님' })
          }
          const mod = await server.ssrLoadModule(resolve(repo, target.checker[0]))
          const error = (mod[target.checker[1]] as (v: unknown) => string | null)(data)
          if (error) return reply(400, { error })
          const file = resolve(repo, target.file)
          const out = `${formatJson(data)}\n`
          if (readFileSync(file, 'utf8') !== out) {
            written.set(file, out)
            writeFileSync(file, out)
          }
          return reply(200, { ok: true, file: target.file })
        } catch (e) {
          return reply(500, { error: e instanceof Error ? e.message : String(e) })
        }
      })
    },
    async handleHotUpdate(ctx) {
      // vite 기본 처리는 이 파일을 페이지 새로고침으로 다룬다 (초안이 날아감) → Tailwind CSS 모듈만 갱신
      if (ctx.file === DRAFT_CLASSES) return [...(ctx.server.moduleGraph.getModulesByFile(INDEX_CSS) ?? [])]
      const mine = written.get(ctx.file)
      if (mine === undefined) return
      written.delete(ctx.file)
      if ((await ctx.read()) === mine) return []
    },
  }
}
