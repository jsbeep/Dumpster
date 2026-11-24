import { inlinesToText } from '@dumpster/schema'
import {
  Bug,
  Check,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  Flame,
  Info,
  List,
  Pencil,
  Quote,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { BlockView } from '../BlockRenderer'
import type { BlockOf } from '../context'
import { cx } from '../cx'
import { Inlines } from '../inline'

// 색 묶음은 글자 그대로 적어 둔다 — Tailwind가 소스에서 클래스 이름을 찾아 CSS를 만들기 때문
// 바탕은 강조색 500에 투명도만 줘서 라이트(흰 바탕)·다크(#1e1e1e) 어디서든 같은 틴트로 보인다
const COLOR = {
  blue: { box: 'bg-blue-500/[0.08]', title: 'text-blue-600' },
  cyan: { box: 'bg-cyan-500/[0.09]', title: 'text-cyan-700' },
  emerald: { box: 'bg-emerald-500/[0.09]', title: 'text-emerald-700' },
  amber: { box: 'bg-amber-500/[0.1]', title: 'text-amber-700' },
  orange: { box: 'bg-orange-500/[0.09]', title: 'text-orange-600' },
  red: { box: 'bg-red-500/[0.08]', title: 'text-red-600' },
  violet: { box: 'bg-violet-500/[0.08]', title: 'text-violet-600' },
  slate: { box: 'bg-slate-500/[0.08]', title: 'text-slate-600' },
}

type Color = keyof typeof COLOR

// 옵시디언 콜아웃 종류 → 색·아이콘 (별칭 포함). 모르는 종류는 note처럼
const KINDS: Record<string, [Color, LucideIcon]> = {
  note: ['blue', Pencil],
  abstract: ['cyan', ClipboardList],
  summary: ['cyan', ClipboardList],
  tldr: ['cyan', ClipboardList],
  info: ['blue', Info],
  todo: ['blue', CircleCheck],
  tip: ['cyan', Flame],
  hint: ['cyan', Flame],
  important: ['cyan', Flame],
  success: ['emerald', Check],
  check: ['emerald', Check],
  done: ['emerald', Check],
  question: ['amber', CircleHelp],
  help: ['amber', CircleHelp],
  faq: ['amber', CircleHelp],
  warning: ['orange', TriangleAlert],
  caution: ['orange', TriangleAlert],
  attention: ['orange', TriangleAlert],
  failure: ['red', X],
  fail: ['red', X],
  missing: ['red', X],
  danger: ['red', Zap],
  error: ['red', Zap],
  bug: ['red', Bug],
  example: ['violet', List],
  quote: ['slate', Quote],
  cite: ['slate', Quote],
}

export const STYLE = {
  box: 'min-w-0 rounded-lg px-4 py-3',
  color: COLOR,
  // 제목 안 굵은 글자도 제목 색 그대로 (본문 굵게는 진한 글자색).
  // 제목이 두 줄이 돼도 아이콘·화살표는 첫 줄 가운데에 — mt 값은 줄 높이 1.7em 기준
  head: 'flex items-start gap-2 font-semibold [&_strong]:text-inherit',
  // 접히는 콜아웃: blog-explorer toggle의 높이 애니메이션. 닫힐 때도 보이게 content-visibility도 전환
  details:
    '[interpolate-size:allow-keywords] [&::details-content]:h-0 [&::details-content]:overflow-hidden [&::details-content]:[transition:height_0.25s_ease,content-visibility_0.25s_allow-discrete] [&[open]::details-content]:h-auto',
  summary: 'cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden',
  icon: 'mt-[0.325em] h-[1.05em] w-[1.05em] shrink-0',
  title: 'min-w-0',
  // 콜아웃이 중첩돼도 자기 <details>가 열렸을 때만 돈다 (group-open은 바깥 details에도 반응)
  chevron: 'mt-[0.35em] h-[1em] w-[1em] shrink-0 opacity-70 transition-transform duration-200 [details[open]>summary>&]:rotate-90',
  body: 'mt-2 flex min-w-0 flex-col gap-2',
}

export function calloutKind(kind: string): { color: Color; Icon: LucideIcon } {
  const [color, Icon] = KINDS[kind.toLowerCase()] ?? KINDS.note
  return { color, Icon }
}

export function CalloutView({ block }: { block: BlockOf<'callout'> }) {
  const { color, Icon } = calloutKind(block.kind)
  const kind = block.kind.toLowerCase()
  const foldable = block.fold !== 'none'
  // 옵시디언처럼 [!WARNING]도 제목은 'Warning'
  const title: ReactNode =
    inlinesToText(block.title).trim() === '' ? kind.charAt(0).toUpperCase() + kind.slice(1) : <Inlines inlines={block.title} />
  const head = (
    <>
      <Icon className={STYLE.icon} aria-hidden />
      <span className={STYLE.title}>{title}</span>
      {foldable && <ChevronRight className={STYLE.chevron} aria-hidden />}
    </>
  )
  const body = block.children.length > 0 && (
    <div className={STYLE.body}>
      {block.children.map((child, i) => (
        <BlockView key={i} block={child} />
      ))}
    </div>
  )
  const box = cx(STYLE.box, COLOR[color].box)
  const headClass = cx(STYLE.head, COLOR[color].title)

  if (!foldable) {
    return (
      <div className={box} data-callout={kind}>
        <div className={headClass}>{head}</div>
        {body}
      </div>
    )
  }
  return (
    <details className={cx(box, STYLE.details)} open={block.fold === 'open'} data-callout={kind}>
      <summary className={cx(headClass, STYLE.summary)}>{head}</summary>
      {body}
    </details>
  )
}
