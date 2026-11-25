import { parse as parseYaml } from 'yaml'
import { isOid, type DocKind } from '@dumpster/schema'
import { normalizeCreatedAt } from './dates'

export interface SplitResult {
  data: Record<string, unknown> | null
  body: string
  warning?: string
}

// 옵시디언처럼 첫 줄이 정확히 '---'일 때만 frontmatter로 본다.
export function splitFrontmatter(raw: string): SplitResult {
  const text = raw.replace(/^﻿/, '')
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { data: null, body: text }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end === -1) return { data: null, body: text, warning: 'frontmatter 닫는 --- 없음' }
  const body = lines.slice(end + 1).join('\n')
  try {
    const parsed: unknown = parseYaml(lines.slice(1, end).join('\n'))
    if (parsed === null || parsed === undefined) return { data: {}, body }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return { data: null, body, warning: 'frontmatter가 키-값 형태가 아님' }
    return { data: parsed as Record<string, unknown>, body }
  } catch (e) {
    return { data: null, body, warning: `frontmatter YAML 파싱 실패: ${(e as Error).message.split('\n')[0]}` }
  }
}

export interface DocMeta {
  oid: string | null // 소문자. 없거나 형식이 이상하면 null (빌더가 임시 ID를 씀)
  draft: boolean // 태그 'draft' → 비공개와 똑같이 취급
  kind: DocKind
  prev: string | null // [[ ]] 안의 대상 이름
  branch: string[]
  seeAlso: string[]
  order: string | null
  tags: string[]
  aliases: string[]
  description: string | null
  createdAt: string | null // ISO +09:00
}

// '[[대상#헤딩|별칭]]' → '대상'. 괄호 없이 적은 값도 대상 이름으로 받아준다.
export function linkTarget(value: unknown): string | null {
  // 따옴표 없이 쓴 prev: [[X]]는 YAML이 [['X']] 배열로 읽는다 → 벗겨낸다
  while (Array.isArray(value) && value.length === 1) value = value[0]
  if (typeof value !== 'string') return null
  const inner = value.match(/^\s*!?\[\[([^\]]*)\]\]\s*$/)?.[1] ?? value
  const target = inner.split('|')[0].split('#')[0].trim()
  return target || null
}

function toList(value: unknown): unknown[] {
  if (value === null || value === undefined || value === '') return []
  return Array.isArray(value) ? value : [value]
}

const uniq = (xs: string[]) => [...new Set(xs)]

// 템플릿은 oid를 따옴표 없이 쓴다. 지금(앞자리 6b…)은 늘 글자로 읽히지만, 2028-06 이후 '6e' 뒤가 전부 숫자거나
// '70…'부터 숫자만 나오면 YAML이 숫자로 읽는다 — 그때는 원래 값을 되살릴 수 없어서 그 글만 따옴표로 감싸야 한다
function normalizeOid(value: unknown, warn: (msg: string) => void): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    warn(`oid가 숫자(${value})로 읽힘 → 임시 ID. 이 글만 oid를 따옴표로 감싸세요`)
    return null
  }
  const oid = String(value).trim().toLowerCase()
  if (isOid(oid)) return oid
  warn(
    oid.includes('<%')
      ? 'oid에 <% %>가 그대로 남음(Templater가 아닌 기본 템플릿으로 넣은 듯) → 임시 ID'
      : `oid 형식이 이상함(${oid.slice(0, 30)}) → 임시 ID`,
  )
  return null
}

export function normalizeMeta(data: Record<string, unknown> | null, warn: (msg: string) => void): DocMeta {
  const d = data ?? {}

  const type = typeof d.type === 'string' ? d.type.trim() : ''
  const kind: DocKind = type === 'manifest' || type === 'moc' ? type : 'doc'
  if (type && kind === 'doc' && type !== 'doc') warn(`모르는 type '${type}' → doc으로 취급`)

  const prevs = toList(d.prev).map(linkTarget).filter((t): t is string => !!t)
  if (prevs.length > 1) warn(`prev가 ${prevs.length}개 — 첫 번째(${prevs[0]})만 씀`)
  const links = (key: string) => uniq(toList(d[key]).map(linkTarget).filter((t): t is string => !!t))

  const tags = uniq(
    toList(d.tags)
      .flatMap((t) => (typeof t === 'string' ? t.split(/[,\s]+/) : []))
      .map((t) => t.replace(/^#+/, '').trim())
      .filter(Boolean),
  )
  const aliases = uniq(
    toList(d.aliases)
      .filter((a): a is string => typeof a === 'string')
      .map((a) => a.trim())
      .filter(Boolean),
  )

  const order = d.order === null || d.order === undefined || d.order === '' ? null : String(d.order).trim()
  const description = typeof d.description === 'string' && d.description.trim() ? d.description.trim() : null

  const createdAt = normalizeCreatedAt(d.createdAt)
  if (d.createdAt !== undefined && d.createdAt !== null && d.createdAt !== '' && !createdAt) {
    warn(`createdAt 형식을 모름: ${String(d.createdAt)}`)
  }

  return {
    oid: normalizeOid(d.oid, warn),
    draft: tags.some((t) => t.toLowerCase() === 'draft'),
    kind,
    prev: prevs[0] ?? null,
    branch: links('branch'),
    seeAlso: links('see_also'),
    order,
    tags,
    aliases,
    description,
    createdAt,
  }
}
