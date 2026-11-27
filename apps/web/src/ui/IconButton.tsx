import { cx } from '@dumpster/blocks'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

// 아이콘만 있는 네모 버튼 — 툴팁(data-tt, TooltipLayer)과 화면 읽기(aria-label)를 label 하나로
//   size  : xs 검색칸 안 지우기 · sm 사이드바 줄 안 · md 칸 머리·찾기 줄 · lg 사이드바 머리 · xl 레일
//           폰(≤720px)에선 md·lg가 40px 네모 + 아이콘 19px (손가락 — 28px은 너무 작았다, 11-27)
//   tone  : 놓인 바탕 — page 칸 위(반투명 호버) · side 사이드바 머리·레일 · row 사이드바 줄 안(줄 호버 바탕보다 한 단계 진하게)
//   on    : 고른 상태(레일의 지금 목록 탭) — 바탕·글자색을 tone 대신 이것 하나로
//   reveal: 줄에 마우스를 올려야(또는 키보드로 줄 안에 포커스) 보임 — display를 inline-flex 대신 hidden + group-hover
//   tip   : 툴팁이 label과 다를 때 (단축키·설명을 덧붙임)
// 같은 속성 클래스를 두 개 겹치지 않게 크기·색·display는 각각 하나만 고른다 (cx는 겹친 클래스를 정리하지 않는다).
// className은 자리(absolute 등)에만 쓴다
const SIZE = {
  xs: 'h-5 w-5 rounded',
  sm: 'h-6 w-6 rounded-md',
  md: 'h-7 w-7 rounded-md max-[720px]:h-10 max-[720px]:w-10 max-[720px]:[&>svg]:size-[19px]',
  lg: 'h-8 w-8 rounded-md max-[720px]:h-10 max-[720px]:w-10 max-[720px]:[&>svg]:size-[19px]',
  xl: 'h-9 w-9 rounded-md',
} as const
const TONE = {
  page: 'text-slate-400 hover:bg-hover hover:text-slate-900',
  side: 'text-slate-500 hover:bg-side-hover hover:text-slate-900',
  row: 'text-slate-400 hover:bg-selected hover:text-slate-900',
} as const
const ON = 'bg-selected text-slate-900'
const SHOW = 'inline-flex'
// 키보드로 줄에 들어왔을 때도 보이게 — focus-within이 아니라 :focus-visible만 (마우스로 줄을 누르면 포커스가 남아 다른 데를 누를 때까지 떠 있었다, 11-27)
const REVEAL = 'hidden group-hover:inline-flex group-has-[:focus-visible]:inline-flex'
const BASE = 'shrink-0 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-40'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children' | 'type'> {
  label: string
  tip?: string
  size?: keyof typeof SIZE
  tone?: keyof typeof TONE
  on?: boolean
  reveal?: boolean
  children: ReactNode
}

export function IconButton({ label, tip, size = 'md', tone = 'page', on = false, reveal = false, className, children, ...rest }: Props) {
  return (
    <button type="button" className={cx(reveal ? REVEAL : SHOW, BASE, SIZE[size], on ? ON : TONE[tone], className)} aria-label={label} data-tt={tip ?? label} {...rest}>
      {children}
    </button>
  )
}
