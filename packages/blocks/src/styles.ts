import { createContext, useContext } from 'react'
import defaults from './styles.json'

// 블록 스타일 = Tailwind 클래스 글자. 데이터라 JSON 한 파일 (styles.json) — 플레이그라운드가 화면에서 고쳐 저장한다.
// 클래스 글자를 JSON에 그대로 적어 두므로 Tailwind content에 이 JSON도 넣어야 CSS가 생긴다 (docs/design.md §5).
// 키를 늘리거나 줄이는 건 View 코드를 바꾸는 일이라 여기(타입)에서 막힌다 — 플레이그라운드는 값만 바꾼다.

export type BlockStyles = typeof defaults

export const DEFAULT_STYLES: BlockStyles = defaults

export const StylesContext = createContext<BlockStyles>(DEFAULT_STYLES)

export function useStyles(): BlockStyles {
  return useContext(StylesContext)
}

// next가 base와 키·배열 길이까지 같은 모양이고 끝이 전부 글자인지. 다르면 처음 어긋난 경로를 돌려준다 (저장 전 검사용)
export function styleShapeError(next: unknown, base: unknown = DEFAULT_STYLES, path = ''): string | null {
  if (typeof base === 'string') return typeof next === 'string' ? null : `${path || '/'}: 글자가 아님`
  if (Array.isArray(base)) {
    if (!Array.isArray(next) || next.length !== base.length) return `${path}: 길이 ${base.length}인 배열이어야 함`
    for (let i = 0; i < base.length; i++) {
      const err = styleShapeError(next[i], base[i], `${path}/${i}`)
      if (err) return err
    }
    return null
  }
  if (!next || typeof next !== 'object' || Array.isArray(next)) return `${path || '/'}: 객체가 아님`
  const b = base as Record<string, unknown>
  const n = next as Record<string, unknown>
  for (const key of Object.keys(n)) if (!(key in b)) return `${path}/${key}: 없는 키`
  for (const key of Object.keys(b)) {
    const err = styleShapeError(n[key], b[key], `${path}/${key}`)
    if (err) return err
  }
  return null
}
