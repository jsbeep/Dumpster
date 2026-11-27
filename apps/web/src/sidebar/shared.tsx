import { Clock, FolderTree, Hash, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '../ui/IconButton'
import { SITE } from '../ui/site'
import { isDark, onSystemTheme, toggleTheme } from '../ui/theme'
import type { SideTab } from './useSidebarList'

// 사이드바 조각 여럿이 같이 쓰는 것 — 목록 탭, 로고, 테마 버튼, 글 줄 모양

export const TABS: { tab: SideTab; icon: LucideIcon; label: string }[] = [
  { tab: 'collections', icon: FolderTree, label: '컬렉션' },
  { tab: 'recent', icon: Clock, label: '최근' },
  { tab: 'tags', icon: Hash, label: '태그' },
]

// 글 한 줄 (찾은 글·최근·태그) — 제목 + 흐린 한 줄
export const item = {
  row: 'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 max-[720px]:py-2.5 transition-colors',
  idle: 'hover:bg-side-hover',
  on: 'bg-selected',
  title: 'truncate text-[13px] font-medium text-slate-700',
  meta: 'flex gap-1.5 text-[11px] tabular-nums text-slate-400',
} as const

// 로고 = 글자색·바탕색을 뒤집은 네모 (라이트 = 검정 바탕, 다크 = 흰 바탕).
// 평소엔 '헌', 올리면 무엇이 될지(전체 → 접기 아이콘, 레일 → 펼치기 아이콘)
const LOGO =
  'group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[13px] font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400'

export function Logo({ hoverIcon: HoverIcon, label, onClick }: { hoverIcon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" className={LOGO} onClick={onClick} aria-label={label} data-tt={label}>
      <span className="group-hover:hidden group-focus-visible:hidden" aria-hidden>
        {SITE.mark}
      </span>
      <HoverIcon size={16} className="hidden group-hover:block group-focus-visible:block" aria-hidden />
    </button>
  )
}

// 테마 — 아이콘 하나 (전체: 머리 오른쪽 lg, 레일: 맨 아래 xl)
export function ThemeToggle({ size }: { size: 'lg' | 'xl' }) {
  const [dark, setDark] = useState(isDark)
  useEffect(() => onSystemTheme(() => setDark(isDark())), [])
  const Icon = dark ? Sun : Moon
  return (
    <IconButton label={dark ? '라이트 모드' : '다크 모드'} size={size} tone="side" onClick={() => setDark(toggleTheme())}>
      <Icon size={16} />
    </IconButton>
  )
}
