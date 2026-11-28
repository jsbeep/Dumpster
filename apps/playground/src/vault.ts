import type { ParseContext } from '@dumpster/markdown'
import { parse as parseYaml } from 'yaml'

// 짜가 볼트(fixtures/vault) 전체를 번들에 넣는다 — 라이브 탭의 노트 고르기와 [[링크]]·![[이미지]] 해석용 (서버·graph.json 필요 없음).
// 찾는 규칙은 빌더(apps/builder/src/build.ts·assets.ts)와 같다:
//   문서: 파일 이름 > 볼트 경로 > 별칭, 같은 폴더 > 짧은 경로. 비공개 폴더 문서는 못 찾음 (null = 회색 글자)
//   이미지: 노트 기준 상대 경로 > 볼트 경로 > 파일 이름 (같은 폴더 > 그 아래 > 짧은 경로). 공개 폴더 아래 것만

declare const __FIXTURE_PUBLIC__: string[]
declare const __FIXTURE_IGNORE__: string[]
const PUBLIC = new Set(__FIXTURE_PUBLIC__)
const IGNORE = new Set(__FIXTURE_IGNORE__)
// 빌더와 같게: 공개 폴더와 그 하위 폴더, 단 중간에 무시 폴더(기본 _image)가 없을 때
const isPublicFolder = (folder: string) =>
  [...PUBLIC].some((f) => (folder === f || folder.startsWith(`${f}/`)) && !folder.slice(f.length).split('/').some((seg) => IGNORE.has(seg)))

const PREFIX = '../../../fixtures/vault/'
const noteFiles = import.meta.glob<string>('../../../fixtures/vault/**/*.md', { query: '?raw', import: 'default', eager: true })
const imageFiles = import.meta.glob<string>('../../../fixtures/vault/**/*.{png,jpg,jpeg,gif,webp,svg,avif,bmp}', {
  query: '?url',
  import: 'default',
  eager: true,
})

export interface Note {
  path: string // 볼트 기준 '블록 견본/함정 모음.md'
  folder: string
  title: string
  raw: string
  aliases: string[]
  public: boolean
}

const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

// 옵시디언처럼 첫 줄이 정확히 '---'일 때만 frontmatter
export function splitFrontmatter(raw: string): { data: Record<string, unknown> | null; body: string } {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  if (lines[0]?.trim() !== '---') return { data: null, body: lines.join('\n') }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end === -1) return { data: null, body: lines.join('\n') }
  const body = lines.slice(end + 1).join('\n')
  try {
    const data = parseYaml(lines.slice(1, end).join('\n')) as unknown
    return { data: data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : null, body }
  } catch {
    return { data: null, body }
  }
}

function aliasesOf(data: Record<string, unknown> | null): string[] {
  const v = data?.aliases ?? data?.alias
  const list = Array.isArray(v) ? v : typeof v === 'string' ? [v] : []
  return list.filter((a): a is string => typeof a === 'string' && a.trim() !== '').map((a) => a.trim())
}

export const NOTES: Note[] = Object.entries(noteFiles)
  .map(([file, raw]) => {
    const path = file.slice(PREFIX.length).normalize('NFC')
    const folder = folderOf(path)
    return { path, folder, title: basename(path).slice(0, -3), raw, aliases: aliasesOf(splitFrontmatter(raw).data), public: isPublicFolder(folder) }
  })
  .sort((a, b) => a.path.localeCompare(b.path, 'ko'))

// 문서 찾기
const byTitle = new Map<string, Note[]>()
const byAlias = new Map<string, Note[]>()
const add = (map: Map<string, Note[]>, key: string, n: Note) => map.set(key, [...(map.get(key) ?? []), n])
for (const n of NOTES) {
  if (!n.public) continue
  add(byTitle, n.title.toLowerCase(), n)
  add(byTitle, n.path.slice(0, -3).toLowerCase(), n)
  for (const a of n.aliases) add(byAlias, a.toLowerCase(), n)
}

function findNote(fromFolder: string, label: string): Note | null {
  const key = label.normalize('NFC').toLowerCase()
  const candidates = byTitle.get(key) ?? byAlias.get(key) ?? []
  if (!candidates.length) return null
  return candidates.find((c) => c.folder === fromFolder) ?? [...candidates].sort((a, b) => a.path.length - b.path.length)[0]
}

// 이미지 찾기
interface Image {
  path: string
  folder: string
  url: string
}
const underPublic = (folder: string) => [...PUBLIC].some((f) => folder === f || folder.startsWith(`${f}/`))
const IMAGES: Image[] = Object.entries(imageFiles)
  .map(([file, url]) => {
    const path = file.slice(PREFIX.length).normalize('NFC')
    return { path, folder: folderOf(path), url }
  })
  .filter((img) => underPublic(img.folder))
const imageByPath = new Map(IMAGES.map((img) => [img.path.toLowerCase(), img]))

function findImage(fromFolder: string, name: string): Image | null {
  const key = name.normalize('NFC').replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase()
  const direct = imageByPath.get(fromFolder ? `${fromFolder.toLowerCase()}/${key}` : key) ?? imageByPath.get(key)
  if (direct) return direct
  const candidates = IMAGES.filter((img) => basename(img.path).toLowerCase() === basename(key))
  const from = fromFolder.toLowerCase()
  return (
    candidates.find((c) => c.folder.toLowerCase() === from) ??
    candidates.find((c) => c.folder.toLowerCase().startsWith(`${from}/`)) ??
    [...candidates].sort((a, b) => a.path.length - b.path.length)[0] ??
    null
  )
}

// 라이브 탭이 파서에 넘길 해석기. 문서 ID 자리엔 노트 경로를 넣는다 — 링크를 누르면 그 노트를 편집기로 연다
export function vaultContext(note: Note | null): Pick<ParseContext, 'resolveDoc' | 'resolveAsset' | 'selfId'> {
  const folder = note?.folder ?? ''
  return {
    selfId: note?.path ?? null,
    resolveDoc: (label) => findNote(folder, label)?.path ?? null,
    resolveAsset: (name) => {
      const img = findImage(folder, name)
      return img ? { src: img.url } : null
    },
  }
}

export function noteByPath(path: string | null): Note | null {
  return NOTES.find((n) => n.path === path) ?? null
}
