import type { Block } from '@dumpster/schema'
import { parse as parseYaml } from 'yaml'
import defaults from './fences.json'

// 펜스 매핑 (선언형): ```언어 → 블록, 펜스 본문 YAML 키 → 블록 필드.
// 옵시디언 플러그인 대부분이 ```언어 펜스로 문법을 더하므로, 새 플러그인은 fences.json에 한 줄 추가로 끝난다 (플레이그라운드에서 편집·저장).
// 코드로 남는 건 "펜스로 만들 수 있는 블록과 그 필드" 표(FENCE_TARGETS) — 새 블록 타입은 계약·View와 함께 여기도 고친다.

// required: 비면 매핑 실패(코드 블록으로 둠) / text: 비면 '' / optional: 비면 null
export type FieldKind = 'required' | 'text' | 'optional'

export const FENCE_TARGETS = {
  bookmark: { href: 'required', title: 'required', description: 'text', icon: 'optional', image: 'optional' },
} as const satisfies { [T in Block['type']]?: Record<string, FieldKind> }

export type FenceTarget = keyof typeof FENCE_TARGETS

export interface FenceRule {
  note?: string // 사람용 메모 (어느 플러그인인지)
  block: FenceTarget
  body: 'yaml' // 펜스 본문 읽는 법 — 지금은 YAML 하나
  props: Record<string, string[]> // 블록 필드 ← YAML 키 후보 (앞에서부터 처음 값이 있는 키)
}

// 키 = 펜스 언어 (소문자)
export type FenceRules = Record<string, FenceRule>

export const DEFAULT_FENCES = defaults as FenceRules

export type FenceResult = { ok: true; block: Block } | { ok: false; reason: string }

export function applyFence(rule: FenceRule, body: string): FenceResult {
  let data: unknown = null
  try {
    data = parseYaml(body)
  } catch {
    return { ok: false, reason: 'YAML을 못 읽음' }
  }
  const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  const pick = (keys: string[]): string | null => {
    for (const key of keys) {
      const v = d[key]
      const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
      if (s) return s
    }
    return null
  }
  const fields: Record<string, string | null> = {}
  for (const [field, kind] of Object.entries(FENCE_TARGETS[rule.block]) as [string, FieldKind][]) {
    const keys = rule.props[field] ?? []
    const value = pick(keys)
    if (value === null && kind === 'required') return { ok: false, reason: `${field} 없음 (YAML ${keys.join('·') || '키 없음'})` }
    fields[field] = value ?? (kind === 'text' ? '' : null)
  }
  return { ok: true, block: { type: rule.block, ...fields } as Block }
}

// 저장 전 검사. 문제가 있으면 처음 것 하나를 경로와 함께
export function fenceRulesError(rules: unknown): string | null {
  if (!isObject(rules)) return '/: 객체가 아님'
  for (const [lang, rule] of Object.entries(rules)) {
    const at = `/${lang}`
    if (!/^[a-z0-9][a-z0-9_+#.-]*$/.test(lang)) return `${at}: 펜스 언어는 소문자·숫자·_+#.-만`
    if (!isObject(rule)) return `${at}: 객체가 아님`
    for (const key of Object.keys(rule)) if (!['note', 'block', 'body', 'props'].includes(key)) return `${at}/${key}: 없는 키`
    if (rule.note !== undefined && typeof rule.note !== 'string') return `${at}/note: 글자가 아님`
    if (typeof rule.block !== 'string' || !(rule.block in FENCE_TARGETS)) {
      return `${at}/block: ${Object.keys(FENCE_TARGETS).join('·')} 중 하나여야 함`
    }
    if (rule.body !== 'yaml') return `${at}/body: 'yaml'이어야 함`
    if (!isObject(rule.props)) return `${at}/props: 객체가 아님`
    const target = FENCE_TARGETS[rule.block as FenceTarget] as Record<string, FieldKind>
    for (const [field, keys] of Object.entries(rule.props)) {
      if (!(field in target)) return `${at}/props/${field}: ${rule.block}에 없는 필드`
      if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string' || !k.trim())) return `${at}/props/${field}: YAML 키 글자 목록이어야 함`
    }
    for (const [field, kind] of Object.entries(target)) {
      const keys = (rule.props as Record<string, unknown>)[field]
      if (kind === 'required' && !(Array.isArray(keys) && keys.length)) return `${at}/props/${field}: 필수 필드라 YAML 키가 하나는 있어야 함`
    }
  }
  return null
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}
