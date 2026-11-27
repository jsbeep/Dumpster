import { cx } from '@dumpster/blocks'
import type { GraphIndex } from '@dumpster/schema'
import { m } from 'framer-motion'
import { ChevronDown, ChevronLeft, Menu, PanelLeftClose, PanelRightClose, Search, SquareArrowUpRight, X } from 'lucide-react'
import type { Action, Slot, View } from '../core/view'
import { IconButton } from '../ui/IconButton'
import { frame } from './styles'

// 칸 머리: [☰ 폰 목록] [‹ 폰 뒤로] 이어읽기|건너읽기 n/m [이어읽기 칸으로] (스크롤하면 제목 + 밑줄) [찾기] [모두 닫기] [접기] [×]
// 폰에서 헤딩이 둘 이상이면 가운데가 목차 버튼(B4) — 지금 읽는 헤딩 ▾, 누르면 머리 밑으로 목록 (Pane · Toc TocSheet)

const styles = {
  lane: 'shrink-0 whitespace-nowrap px-1.5 text-[11.5px] font-semibold',
  laneIdle: 'text-slate-400',
  laneFocus: 'text-slate-900',
  textBtn: 'h-7 max-[720px]:h-10 shrink-0 whitespace-nowrap rounded-md px-2 text-[12px] text-slate-500 transition-colors hover:bg-hover hover:text-slate-900',
  headTitle: 'min-w-0 flex-1 truncate px-1.5 text-[13px] max-[720px]:text-[15px] font-semibold text-slate-700',
  tocBtn: 'flex h-10 min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 text-left text-[15px]', // 폰 전용 (11-27 사용자: 키움)
  back: 'flex h-10 max-w-[46%] shrink-0 items-center gap-1 rounded-md pl-1 pr-2 text-[13.5px] text-slate-500 hover:bg-hover hover:text-slate-900',
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
  focused: boolean // 칸이 둘일 때 "이어읽기"/"건너읽기" 글자를 진하게
  onMenu?: () => void
  onFind: () => void
  toc?: { label: string | null; open: boolean; onToggle: () => void } // 폰 목차 버튼 (label 없으면 '목차')
  onReveal: (docId: string) => void
  dispatch: (action: Action) => void
}

export function PaneHeader({ ix, view, slot, docId, title, showTitle, canFind, phone, focused, onMenu, onFind, toc, onReveal, dispatch }: Props) {
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
          {slot === 'main' ? '이어읽기' : '건너읽기'}
          {slot === 'rel' && n > 1 && <span className="ml-1 font-medium tabular-nums">{`${view.active + 1}/${n}`}</span>}
        </span>
      )}
      {slot === 'rel' && (
        <IconButton
          label="이어읽기 칸으로 옮기기"
          tip="이어읽기 칸으로 — 이 글을 이어읽기 칸에 열고 트리에서 보이기"
          onClick={() => {
            dispatch({ type: 'promote' })
            onReveal(docId)
          }}
        >
          <SquareArrowUpRight size={16} />
        </IconButton>
      )}
      {toc ? (
        <button type="button" className={styles.tocBtn} onClick={toc.onToggle} aria-expanded={toc.open} aria-label={`목차 — ${toc.label ?? title}`} data-phone-toc>
          <span className={cx('truncate', toc.label ? 'font-semibold text-slate-700' : 'font-medium text-slate-400')}>{toc.label ?? '목차'}</span>
          <ChevronDown size={17} className={cx('shrink-0 text-slate-400', toc.open && 'rotate-180')} aria-hidden />
        </button>
      ) : (
        <m.span className={styles.headTitle} initial={false} animate={{ opacity: showTitle ? 1 : 0 }} transition={{ duration: 0.15 }} data-head-title={showTitle || undefined}>
          {title}
        </m.span>
      )}
      {canFind && (
        <IconButton label="이 글에서 찾기" tip="이 글에서 찾기 (Ctrl+F)" onClick={() => onFind()} data-find-open>
          <Search size={15} />
        </IconButton>
      )}
      {slot === 'rel' ? (
        <>
          {n > 1 && (
            <button type="button" className={styles.textBtn} onClick={() => dispatch({ type: 'closeAll' })} data-tt="건너읽기 탭을 모두 닫기">
              모두 닫기
            </button>
          )}
          {!phone && (
            <IconButton label="건너읽기 칸 접기" onClick={() => dispatch({ type: 'collapse', slot: 'rel' })}>
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
          <IconButton label="이어읽기 칸 접기" onClick={() => dispatch({ type: 'collapse', slot: 'main' })}>
            <PanelLeftClose size={16} />
          </IconButton>
        )
      )}
    </div>
  )
}
