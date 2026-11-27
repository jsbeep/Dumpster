import { cx } from '@dumpster/blocks'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

// 트리 점 — 모양 = 글 종류 (일반 / 분기점 / 매니페스트), 칠·고리 = 어느 칸에 열려 있나. 트리(sidebar/Tree)와 범례(툴팁)가 같이 쓴다
// 점의 속(속 빈 점)과 고리 틈은 --dot-bg = 그 자리의 바탕색 (트리 행은 행 바탕, 범례는 --page-bg)

// 점: 모양(원/둥근 네모) · 칠 · 고리를 각각 하나씩만 고른다 (같은 속성 클래스 두 개 금지)
export type DotShape = 'idle' | 'fork' | 'man'
export type DotState = 'sel' | 'act' | 'open' | ''
const dot = {
  base: 'absolute left-[3.25px] top-[calc(50%-4.75px)] z-[1] h-[9.5px] w-[9.5px] border-2',
  round: 'rounded-full',
  square: 'rounded-[3px]', // 매니페스트
  idle: 'border-slate-400 bg-[var(--dot-bg)]',
  fork: 'border-slate-700 bg-[var(--dot-bg)]', // 분기점
  man: 'border-slate-500 bg-slate-500', // 흐름 글(꽉 찬 진한 점)과 헷갈리지 않게 한 단계 옅게
  sel: 'border-accent-600 bg-accent-600', // 흐름 글 · 펼친 탭
  // 탭에 있는 글 = 고리 (행 바탕색 틈 1.5px + 고리 1.5px)
  open: 'shadow-[0_0_0_1.5px_var(--dot-bg),0_0_0_3px_rgb(var(--c-slate-400))]', // 고리는 회색 (11-27)
}
export const dotClass = (shape: DotShape, state: DotState) =>
  cx(dot.base, shape === 'man' ? dot.square : dot.round, state === 'sel' || state === 'act' ? dot.sel : dot[shape], (state === 'act' || state === 'open') && dot.open)

// 점 범례 — 트리 점에 마우스를 올리면 (TooltipLayer). on = 올린 점의 모양·상태 (그 줄을 진하게)
const LEGEND: { group: string; rows: { key: string; icon: ReactNode; label: string }[] }[] = [
  {
    group: '글 종류',
    rows: [
      { key: 'idle', icon: <span className={dotClass('idle', '')} />, label: '글' },
      { key: 'fork', icon: <span className={dotClass('fork', '')} />, label: '여기서 갈래가 나뉘는 글' },
      { key: 'man', icon: <span className={dotClass('man', '')} />, label: '컬렉션 소개 글' },
    ],
  },
  {
    group: '열린 곳',
    rows: [
      { key: 'sel', icon: <span className={dotClass('idle', 'sel')} />, label: '이어읽기 칸에 연 글' },
      { key: 'act', icon: <span className={dotClass('idle', 'act')} />, label: '건너읽기 칸에 펼친 글' },
      { key: 'open', icon: <span className={dotClass('idle', 'open')} />, label: '접힌 글 (띠에 있음)' },
    ],
  },
  {
    group: '오른쪽 표시',
    rows: [
      { key: 'in', icon: <ArrowDownLeft size={13} className="text-slate-500" />, label: '보고 있는 글을 가리키는 글' },
      { key: 'out', icon: <ArrowUpRight size={13} className="text-slate-500" />, label: '보고 있는 글이 가리키는 글' },
    ],
  },
]

export function DotLegend({ on }: { on: string[] }) {
  return (
    <div className="flex flex-col gap-2 [--dot-bg:var(--page-bg)]" data-dot-legend>
      {LEGEND.map((g) => (
        <div key={g.group}>
          <p className="mb-0.5 text-[10.5px] font-semibold text-slate-400">{g.group}</p>
          {g.rows.map((r) => (
            <p key={r.key} className={cx('flex h-6 items-center gap-1.5 whitespace-nowrap text-[12px]', on.includes(r.key) ? 'font-semibold text-slate-900' : 'text-slate-500')} data-on={on.includes(r.key) || undefined}>
              <span className="relative grid h-4 w-4 shrink-0 place-items-center">{r.icon}</span>
              {r.label}
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}
