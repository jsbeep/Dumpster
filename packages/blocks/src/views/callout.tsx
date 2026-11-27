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
import { useRef, type ReactNode } from 'react'
import { BlockView } from '../BlockRenderer'
import type { BlockOf } from '../context'
import { useStyles, type BlockStyles } from '../styles'
import { cx } from '../cx'
import { Inlines } from '../inline'

// 색 묶음(styles.json "callout.color")은 클래스 글자 그대로 — Tailwind가 JSON에서 클래스 이름을 찾아 CSS를 만든다
// 바탕은 강조색 500에 투명도만 줘서 라이트(흰 바탕)·다크(#1e1e1e) 어디서든 같은 틴트로 보인다
type Color = keyof BlockStyles['callout']['color']

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

export function calloutKind(kind: string): { color: Color; Icon: LucideIcon } {
  const [color, Icon] = KINDS[kind.toLowerCase()] ?? KINDS.note
  return { color, Icon }
}

// 스타일 메모 (styles.json "callout"):
// - head: 제목 안 굵은 글자도 제목 색 그대로 (본문 굵게는 진한 글자색)
// - icon·chevron mt: 제목이 두 줄이 돼도 첫 줄 가운데에 — 줄 높이 1.7em 기준
// - details: 접히는 콜아웃은 blog-explorer toggle의 높이 애니메이션. 닫힐 때도 보이게 content-visibility도 전환
// - chevron: 콜아웃이 중첩돼도 자기 <details>가 열렸을 때만 돈다 (group-open은 바깥 details에도 반응)
// - summary: 열린 접는 콜아웃의 제목줄은 칸 위에 붙는다(sticky, 11-27) — 긴 콜아웃 중간에서도 눌러서 접는다.
//   붙는 높이는 --stick-top(탐색기 폰 = 칸 머리 높이, 없으면 0). 붙은 동안 뒤 글이 비치지 않게 바탕 = 콜아웃 색(--callout-tint) + 페이지 바탕.
//   상자 위·아래 여백만큼 음수 여백으로 넓혀 붙었을 때도 상자 폭·여백 그대로. 안쪽 콜아웃 제목줄은 안 붙는다(바깥과 겹침)
// 붙은 제목줄을 눌러 접으면 제목이 제자리(위쪽 멀리)로 돌아가 화면에서 사라진다 → 누르기 직전 자리로 다시 데려온다 (scroll-mt = 붙는 높이)
export function CalloutView({ block }: { block: BlockOf<'callout'> }) {
  const pressedTop = useRef<number | null>(null)
  const S = useStyles().callout
  const { color, Icon } = calloutKind(block.kind)
  const kind = block.kind.toLowerCase()
  const foldable = block.fold !== 'none'
  // 옵시디언처럼 [!WARNING]도 제목은 'Warning'
  const title: ReactNode =
    inlinesToText(block.title).trim() === '' ? kind.charAt(0).toUpperCase() + kind.slice(1) : <Inlines inlines={block.title} />
  const head = (
    <>
      <Icon className={S.icon} aria-hidden />
      <span className={S.title}>{title}</span>
      {foldable && <ChevronRight className={S.chevron} aria-hidden />}
    </>
  )
  const body = block.children.length > 0 && (
    <div className={S.body}>
      {block.children.map((child, i) => (
        <BlockView key={i} block={child} />
      ))}
    </div>
  )
  const box = cx(S.box, S.color[color].box)
  const headClass = cx(S.head, S.color[color].title)

  if (!foldable) {
    return (
      <div className={box} data-callout={kind}>
        <div className={headClass}>{head}</div>
        {body}
      </div>
    )
  }
  return (
    <details
      className={cx(box, S.details)}
      open={block.fold === 'open'}
      data-callout={kind}
      onToggle={(e) => {
        const top = pressedTop.current
        pressedTop.current = null
        const d = e.currentTarget
        if (d.open || top === null) return
        const sm = d.querySelector(':scope > summary')
        if (sm && sm.getBoundingClientRect().top < top - 1) sm.scrollIntoView({ block: 'start' })
      }}
    >
      <summary className={cx(headClass, S.summary)} onClick={(e) => (pressedTop.current = e.currentTarget.getBoundingClientRect().top)}>
        {head}
      </summary>
      {body}
    </details>
  )
}
