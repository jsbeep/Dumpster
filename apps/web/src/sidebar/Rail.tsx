import { cx } from '@dumpster/blocks'
import { ChevronsLeft, PanelLeftOpen, Search } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { Logo, TABS, ThemeToggle } from './shared'
import type { SideTab } from './useSidebarList'

// 아이콘 레일 — 아이콘만. 검색·목록 아이콘을 누르면 그걸로 펼친다. 맨 아래 = 테마 · 완전히 접기

const railList = 'flex flex-col items-center gap-1'

export function Rail({ tab, onExpand, onHide, onSearch, onTab }: { tab: SideTab; onExpand: () => void; onHide: () => void; onSearch: () => void; onTab: (t: SideTab) => void }) {
  return (
    <>
      <div className="mt-2 flex h-12 shrink-0 items-center justify-center">
        <Logo hoverIcon={PanelLeftOpen} label="사이드바 펼치기" onClick={onExpand} />
      </div>
      <nav className={cx(railList, 'pt-3')} aria-label="목록 보기">
        <IconButton label="제목 찾기" size="xl" tone="side" onClick={onSearch}>
          <Search size={16} />
        </IconButton>
        {TABS.map(({ tab: t, icon: Icon, label }) => (
          <IconButton key={t} label={label} size="xl" tone="side" on={t === tab} onClick={() => onTab(t)}>
            <Icon size={16} />
          </IconButton>
        ))}
      </nav>
      <div className="flex-1" />
      <div className={cx(railList, 'pb-3')}>
        <ThemeToggle size="xl" />
        <div className="my-1 h-px w-6 bg-line" />
        <IconButton label="사이드바 숨기기" tip="사이드바 숨기기 — 왼쪽 끝에서 다시 꺼낸다" size="xl" tone="side" onClick={onHide}>
          <ChevronsLeft size={16} />
        </IconButton>
      </div>
    </>
  )
}
