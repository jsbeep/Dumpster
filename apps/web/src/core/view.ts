import type { Route } from './route'

// 칸 상태와 리듀서 (design.md §3 "칸") — 순수 함수. 화면·기록(pushState)·스크롤은 이 결과를 보고 따로 한다.
//
// 화면 = 흐름 칸 + [왼쪽 띠] 연관 칸 [오른쪽 띠]
//   흐름 칸: 트리를 따라 읽는 글 하나
//   연관 칸: 링크로 연 글들의 탭. tabs[active]만 펼쳐 보이고 앞쪽은 왼쪽 띠, 뒤쪽은 오른쪽 띠
// 흐름 글은 탭에 안 들어간다 (같은 글이 두 칸에 안 보이게) — 그래서 트리의 열림 표시도 서로 배타

export type Slot = 'main' | 'rel'

export interface View {
  main: string | null // 흐름 칸 글 (null = 첫 화면)
  tabs: string[]
  active: number // tabs가 비면 0
  collapsed: Slot | null
}

export const HOME: View = { main: null, tabs: [], active: 0, collapsed: null }

export type Action =
  | { type: 'open'; id: string; scan?: boolean; solo?: boolean } // 트리·최근·태그 → 흐름 칸 교체. scan = j/k로 훑기(기록을 덮어씀)
  //   solo = 폰: 칸이 하나라 탭이 있으면 고른 글이 안 보인다 → 탭을 비우고 그 글만 (뒤로가기로 탭이 돌아옴)
  | { type: 'step'; slot: Slot; id: string } // 이전/다음 — 지금 칸 안에서
  | { type: 'link'; id: string } // 본문 링크·임베드·글 끝 목록 — 어느 칸에서든 연관 칸 새 탭
  | { type: 'pick'; index: number } // 띠 누르기
  | { type: 'close'; index: number } // 탭 × — 펼친 탭이면 오른쪽, 없으면 왼쪽 탭이 펼쳐짐
  | { type: 'closeAll' }
  | { type: 'promote' } // 바로가기: 펼친 탭 글을 흐름 칸으로
  | { type: 'collapse'; slot: Slot } // 접기 토글
  | { type: 'expand' }
  | { type: 'back' } // 폰 "‹": 지금 탭을 닫고 왼쪽 탭(없으면 흐름 글)으로
  | { type: 'home' }

export interface Result {
  view: View // 안 바뀌었으면 받은 객체 그대로
  history: 'push' | 'replace' | 'none' // 같은 상태를 또 push하면 브라우저는 기록을 쌓는다 → 바뀐 게 없으면 none
  flash: Slot | null // 이미 보이는 글로 가려 함 → 그 칸만 반짝
  slot: Slot | null // 이 동작의 글이 놓인 칸 → 지금 보는 칸·헤딩 스크롤 대상. null = 그대로
}

export const activeOf = (v: View): string | null => v.tabs[v.active] ?? null

// 칸에 펼쳐 보이는 글 (흐름 글 + 펼친 탭). 접힌 칸도 포함 — 펴면 그 글이 다시 보인다
export const shownDocs = (v: View): string[] => [v.main, activeOf(v)].filter((x): x is string => x !== null)

// 새로 보이게 된 글 중 직전 칸 상태에 아예 없던 글(흐름 글도 탭도 아니던 글) — 처음부터(맨 위) 읽는다 (P4.3 스크롤 기억)
// 탭에 있던 글이 다시 펼쳐지거나 흐름 칸으로 옮겨 가면 여기 안 들어간다 → 읽던 자리로
export function freshDocs(before: View, after: View): string[] {
  const had = new Set([before.main, ...before.tabs])
  return shownDocs(after).filter((id) => !had.has(id))
}

export function reduce(view: View, action: Action): Result {
  switch (action.type) {
    case 'open': {
      const solo = (v: View): View => (action.solo && v.tabs.length ? { ...v, tabs: [], active: 0, collapsed: null } : v)
      if (view.main === action.id) {
        if (action.solo && view.tabs.length) return done(view, solo(view), 'main')
        if (view.collapsed === 'main') return done(view, { ...view, collapsed: null }, 'main')
        return still(view, 'main')
      }
      return done(view, solo(setMain(view, action.id)), 'main', action.scan)
    }

    case 'step': {
      if (action.slot === 'main') return reduce(view, { type: 'open', id: action.id })
      if (view.main === action.id) return still(view, 'main', true)
      const i = view.tabs.indexOf(action.id)
      if (i >= 0) return pick(view, i)
      if (!view.tabs.length) return reduce(view, { type: 'link', id: action.id })
      return done(view, { ...view, tabs: view.tabs.map((t, k) => (k === view.active ? action.id : t)) }, 'rel')
    }

    case 'link': {
      if (!view.main) return reduce(view, { type: 'open', id: action.id }) // 첫 화면엔 흐름 글이 없다 → 흐름 칸으로
      if (view.main === action.id) {
        if (view.collapsed === 'main') return done(view, { ...view, collapsed: null }, 'main')
        return still(view, 'main', true) // 흐름 칸에 보이는 글 → 반짝만
      }
      const i = view.tabs.indexOf(action.id)
      if (i >= 0) return pick(view, i)
      const at = view.tabs.length ? view.active + 1 : 0 // 펼친 탭 바로 뒤에 끼운다 (오른쪽 띠는 그대로)
      const tabs = [...view.tabs.slice(0, at), action.id, ...view.tabs.slice(at)]
      return done(view, { ...view, tabs, active: at, collapsed: view.collapsed === 'rel' ? null : view.collapsed }, 'rel')
    }

    case 'pick':
      if (!inRange(view, action.index)) return still(view, null)
      return pick(view, action.index)

    case 'close': {
      if (!inRange(view, action.index)) return still(view, null)
      const next = removeAt(view, action.index, false)
      return done(view, next, action.index === view.active ? (next.tabs.length ? 'rel' : 'main') : null)
    }

    case 'back': {
      if (!view.tabs.length) return still(view, null)
      if (view.active === 0) return done(view, { ...view, tabs: [], active: 0, collapsed: null }, 'main')
      return done(view, removeAt(view, view.active, true), 'rel')
    }

    case 'closeAll':
      if (!view.tabs.length) return still(view, null)
      return done(view, { ...view, tabs: [], active: 0, collapsed: null }, 'main')

    case 'promote': {
      const id = activeOf(view)
      if (!id) return still(view, null)
      return done(view, setMain(view, id), 'main')
    }

    case 'collapse': {
      if (!view.tabs.length) return still(view, null) // 한 칸뿐이면 접을 게 없다
      return done(view, { ...view, collapsed: view.collapsed === action.slot ? null : action.slot }, null)
    }

    case 'expand':
      if (!view.collapsed) return still(view, null)
      return done(view, { ...view, collapsed: null }, null)

    case 'home':
      return done(view, HOME, 'main')
  }
}

// ---- 주소 ↔ 칸 ----
// 주소엔 흐름 글과 펼친 탭만 — 공유 링크·새 탭은 이 둘만 연다. 나머지 탭은 history.state에만
export const routeOf = (v: View): Route => ({ main: v.main, rel: v.main ? activeOf(v) : null })

export function viewOfRoute(r: Route): View {
  if (!r.main) return HOME
  return { main: r.main, tabs: r.rel && r.rel !== r.main ? [r.rel] : [], active: 0, collapsed: null }
}

// 칸 상태가 말이 되는지 — 기록(history.state)에서 꺼낸 값은 남이 만든 것일 수 있어서 화면에 쓰기 전에 본다
export function isView(v: unknown): v is View {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  if (x.main !== null && typeof x.main !== 'string') return false
  if (!Array.isArray(x.tabs) || !x.tabs.every((t) => typeof t === 'string')) return false
  if (new Set(x.tabs).size !== x.tabs.length || (x.main !== null && x.tabs.includes(x.main))) return false
  if (x.main === null && x.tabs.length) return false
  if (typeof x.active !== 'number' || !Number.isInteger(x.active)) return false
  if (x.tabs.length ? x.active < 0 || x.active >= x.tabs.length : x.active !== 0) return false
  if (x.collapsed !== null && x.collapsed !== 'main' && x.collapsed !== 'rel') return false
  if (x.collapsed !== null && !x.tabs.length) return false
  return true
}

// ---- 안쪽 ----

const inRange = (v: View, i: number) => Number.isInteger(i) && i >= 0 && i < v.tabs.length

// 흐름 칸 교체. 그 글이 탭에 있었으면 탭에서 빼고(이웃 탭이 펼쳐짐), 접힌 흐름 칸은 편다
function setMain(view: View, id: string): View {
  const i = view.tabs.indexOf(id)
  const v = i >= 0 ? removeAt(view, i, false) : view
  return { ...v, main: id, collapsed: v.collapsed === 'main' || !v.tabs.length ? null : v.collapsed }
}

// 띠 누르기 · 이미 탭에 있는 글로 가는 링크 → 그 탭을 펼친다. 닫히는 탭 없음
function pick(view: View, i: number): Result {
  if (view.collapsed === 'rel') return done(view, { ...view, active: i, collapsed: null }, 'rel')
  if (i === view.active) return still(view, 'rel', true)
  return done(view, { ...view, active: i }, 'rel')
}

// 탭 하나 빼기 — 펼친 탭을 빼면 오른쪽 탭(preferLeft면 왼쪽), 없으면 반대쪽
function removeAt(view: View, i: number, preferLeft: boolean): View {
  const tabs = view.tabs.filter((_, k) => k !== i)
  let active = view.active
  if (i < active || (i === active && preferLeft)) active--
  active = Math.max(0, Math.min(active, tabs.length - 1))
  return { ...view, tabs, active, collapsed: tabs.length ? view.collapsed : null }
}

function done(prev: View, next: View, slot: Slot | null, scan = false): Result {
  const same = key(prev) === key(next)
  if (same) return { view: prev, history: 'none', flash: null, slot }
  // 접기·펴기만 바뀐 건 기록을 덮어쓴다 (뒤로가기로 접기를 되돌리진 않음)
  const onlyFold = prev.main === next.main && prev.active === next.active && prev.tabs.join('\n') === next.tabs.join('\n')
  return { view: next, history: scan || onlyFold ? 'replace' : 'push', flash: null, slot }
}

function still(view: View, slot: Slot | null, flash = false): Result {
  return { view, history: 'none', flash: flash ? slot : null, slot }
}

const key = (v: View) => JSON.stringify([v.main, v.tabs, v.active, v.collapsed])
