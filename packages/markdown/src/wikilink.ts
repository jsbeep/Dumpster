// [[대상#헤딩|별칭]] 안쪽 글자 해부. 옵시디언은 첫 '|' 뒤 전부를 별칭(임베드면 크기·대체 글자)으로 본다.

export interface Wikilink {
  target: string // 문서·파일 이름 (.md 뗌). '' = 같은 문서 ([[#헤딩]])
  headings: string[] // '#' 뒤 헤딩 경로 ([[문서#큰 제목#작은 제목]])
  blockRef: string | null // [[문서#^abc]]
  alias: string | null
}

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'])
// 옵시디언이 임베드할 수 있지만 블록이 없는 첨부 (문서로 착각하지 않도록 구분만)
export const MEDIA_EXTENSIONS = new Set(['pdf', 'mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4', 'mov', 'mkv', 'ogv'])

export function parseWikilink(inner: string): Wikilink {
  const bar = inner.indexOf('|')
  const alias = bar === -1 ? null : inner.slice(bar + 1).trim() || null
  const [rawTarget, ...rest] = (bar === -1 ? inner : inner.slice(0, bar)).split('#')
  const target = rawTarget.normalize('NFC').trim().replace(/\.md$/i, '')
  const parts = rest.map((h) => h.trim()).filter(Boolean)
  const block = parts.length && parts[parts.length - 1].startsWith('^') ? parts.pop()!.slice(1) : null
  return { target, headings: parts, blockRef: block, alias }
}

export function extensionOf(name: string): string {
  const base = name.slice(name.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

export function basenameOf(name: string): string {
  return name.slice(name.lastIndexOf('/') + 1)
}

// 임베드 별칭: '447' / '447x300' / '대체 글자' / '대체 글자|447'
export function parseImageAlias(alias: string | null): { alt: string | null; width: number | null; height: number | null } {
  if (!alias) return { alt: null, width: null, height: null }
  const parts = alias.split('|').map((s) => s.trim())
  const size = /^(\d+)(?:x(\d+))?$/.exec(parts[parts.length - 1])
  if (!size) return { alt: alias, width: null, height: null }
  parts.pop()
  return { alt: parts.join('|') || null, width: Number(size[1]), height: size[2] ? Number(size[2]) : null }
}
