import type { GraphIndex } from '@dumpster/schema'
import { activeOf, reduce, type Action, type View } from './view'

// 폰 글 바꾸기 슬라이드 방향 (ui/viewTransition, 11-27) — 폰은 칸이 하나라 보이는 글 = 탭이 있으면 펼친 탭, 없으면 흐름 글
//   next = 새 글이 오른쪽에서 (다음 글 · 본문 링크·글 끝 목록으로 연 새 탭)
//   prev = 왼쪽에서 (이전 글 · 브레드크럼 분기점 · ‹ · 탭 닫기)
//   null = 안 미끄러짐 — 보이는 글이 그대로(반짝만 등) · 서랍에서 고르기(서랍이 닫히며 움직이는 중이라 스냅샷이 어긋난다,
//          WebKit 310181) · 첫 화면
export type SlideDir = 'next' | 'prev'

const shown = (v: View) => (v.tabs.length ? activeOf(v) : v.main)

export function slideOf(ix: GraphIndex, view: View, action: Action): SlideDir | null {
  const a = shown(view)
  const b = shown(reduce(view, action).view)
  if (!a || !b || a === b) return null
  switch (action.type) {
    case 'step':
      return ix.prevOf.get(a) === b || ix.ancestors(a).includes(b) ? 'prev' : 'next'
    case 'link':
      return 'next'
    case 'back':
    case 'close':
    case 'closeAll':
      return 'prev'
    default:
      return null
  }
}
