import { cx } from '@dumpster/blocks'
import type { GraphIndex } from '@dumpster/schema'
import { m } from 'framer-motion'
import { ChevronLeft, Menu, PanelLeftClose, PanelRightClose, Search, SquareArrowUpRight, X } from 'lucide-react'
import type { Action, Slot, View } from '../core/view'
import { IconButton } from '../ui/IconButton'
import { frame } from './styles'

// 칸 머리: [☰ 폰 목록] [‹ 폰 뒤로] 흐름|연관 n/m [흐름 칸으로] (스크롤하면 제목 + 밑줄) [찾기] [모두 닫기] [접기] [×]

const styles = {
  lane: 'shrink-0 whitespace-nowrap px-1.5 text-[11.5px] font-semibold',
  laneIdle: 'text-slate-400',
  laneFocus: 'text-slate-900',
  textBtn: 'h-7 shrink-0 whitespace-nowrap rounded-md px-2 text-[12px] text-slate-500 transition-colors hover:bg-hover hover:text-slate-900',
  headTitle: 'min-w-0 flex-1 truncate px-1.5 text-[13px] font-semibold text-slate-700',
  back: 'flex h-7 max-w-[46%] shrink-0 items-center gap-1 rounded-md pl-1 pr-2 text-[12.5px] text-slate-500 hover:bg-hover hover:text-slate-900',
} as const

interface Props {
  ix: GraphIndex
  view: View
  slot: Slot
  docId: string
  title: string
  showTitle: boolean // 제목이 위로 지나감 (useScrollSpy)
  canFind: boolean // 본문이 왔을 때만 찾기
  phone: boolean
  focused: boolean // 칸이 둘일 때 "흐름"/"연관" 글자를 진하게
  onMenu?: () => void
  onFind: () => void
  onReveal: (docId: string) => void
  dispatch: (action: Action) => void
}

export function PaneHeader({ ix, view, slot, docId, title, showTitle, canFind, phone, focused, onMenu, onFind, onReveal, dispatch }: Props) {
  const n = view.tabs.length
  const hasRel = n > 0
  const backTo = slot === 'rel' ? (view.active > 0 ? view.tabs[view.active - 1] : view.main) : null

  return (
    <div className={cx(frame.header, showTitle ? 'border-line' : 'border-transparent')}>
      {onMenu && (
        <IconButton label="목록 열기" onClick={onMenu} data-menu>
          <Menu size={18} />
        </IconButton>
      )}
      {backTo && phone && (
        <button type="button" className={styles.back} onClick={() => dispatch({ type: 'back' })} data-tt="이 탭 닫고 한 단계 전 글로">
          <ChevronLeft size={15} className="shrink-0" aria-hidden />
          <span className="truncate">{ix.docsById.get(backTo)?.title}</span>
        </button>
      )}
      {hasRel && !phone && (
        <span className={cx(styles.lane, focused ? styles.laneFocus : styles.laneIdle)} data-lane>
          {slot === 'main' ? '흐름' : '연관'}
          {slot === 'rel' && n > 1 && <span className="ml-1 font-medium tabular-nums">{`${view.active + 1}/${n}`}</span>}
        </span>
      )}
      {slot === 'rel' && (
        <IconButton
          label="흐름 칸으로 옮기기"
          tip="흐름 칸으로 — 이 글을 흐름 칸에 열고 트리에서 보이기"
          onClick={() => {
            dispatch({ type: 'promote' })
            onReveal(docId)
          }}
        >
          <SquareArrowUpRight size={16} />
        </IconButton>
      )}
      <m.span className={styles.headTitle} initial={false} animate={{ opacity: showTitle ? 1 : 0 }} transition={{ duration: 0.15 }} data-head-title={showTitle || undefined}>
        {title}
      </m.span>
      {canFind && (
        <IconButton label="이 글에서 찾기" tip="이 글에서 찾기 (Ctrl+F)" onClick={onFind} data-find-open>
          <Search size={15} />
        </IconButton>
      )}
      {slot === 'rel' ? (
        <>
          {n > 1 && (
            <button type="button" className={styles.textBtn} onClick={() => dispatch({ type: 'closeAll' })} data-tt="연관 탭을 모두 닫기">
              모두 닫기
            </button>
          )}
          {!phone && (
            <IconButton label="연관 칸 접기" onClick={() => dispatch({ type: 'collapse', slot: 'rel' })}>
              <PanelRightClose size={16} />
            </IconButton>
          )}
          <IconButton label="이 탭 닫기" onClick={() => dispatch({ type: 'close', index: view.active })}>
            <X size={16} />
          </IconButton>
        </>
      ) : (
        hasRel &&
        !phone && (
          <IconButton label="흐름 칸 접기" onClick={() => dispatch({ type: 'collapse', slot: 'main' })}>
            <PanelLeftClose size={16} />
          </IconButton>
        )
      )}
    </div>
  )
}
