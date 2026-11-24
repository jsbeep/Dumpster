import type { BlockOf } from '../context'
import { cx, SCROLL_X } from '../cx'

// 아직 못 그리는 문법(수식·각주 …) — 지우지 않고 원문 그대로 + 이유 배지
export const STYLE = {
  box: 'min-w-0 rounded-lg border border-dashed border-slate-300 bg-slate-50',
  head: 'flex items-center gap-2 px-3 pt-2 text-[0.6875em]',
  tag: 'font-mono uppercase tracking-wider text-slate-400',
  reason: 'rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800',
  raw: cx(SCROLL_X, 'whitespace-pre-wrap px-3 pb-2.5 pt-1.5 font-mono text-[0.8125em] leading-[1.6] text-slate-600'),
}

export function UnsupportedView({ block }: { block: BlockOf<'unsupported'> }) {
  return (
    <div className={STYLE.box}>
      <div className={STYLE.head}>
        <span className={STYLE.tag}>unsupported</span>
        <span className={STYLE.reason}>{block.reason}</span>
      </div>
      <pre className={STYLE.raw}>{block.raw}</pre>
    </div>
  )
}
