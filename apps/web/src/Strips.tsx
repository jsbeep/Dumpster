import type { GraphIndex } from '@dumpster/schema'
import { AnimatePresence, m } from 'framer-motion'
import { Link2, PanelRightOpen, X } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState, type ReactElement } from 'react'
import { paneVariants, popIn, SPRING_COLUMN, SPRING_SNAPPY } from './motion'
import { cn } from './ui'
import type { Action, View } from './view'

// 띠 (design.md §3 "칸") — 좁은 카드 (mongolive 밀러 컬럼 카드를 세로로 접은 모양)
//   FlowSpine: 접힌 흐름 칸 — 누르면 펼침
//   Stack    : 펼치지 않은 연관 탭. 왼쪽 = 펼친 탭 앞쪽, 오른쪽 = 뒤쪽, 둘 다 위가 펼친 탭에 가까운 글.
//              연관 칸까지 접으면 펼친 탭도 왼쪽 띠 맨 위로. 한쪽 5개 넘으면 먼 건 +n 목록(거기서도 닫기)
//              탭마다 layoutId — 띠를 누르면 사이 탭들이 반대쪽 띠로 미끄러져 간다

const MAX_SEG = 5

const styles = {
  card: 'relative flex w-11 shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-white/70 shadow-panel',
  vtitle: 'min-h-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-slate-700 [writing-mode:vertical-rl]',
  seg: 'group flex max-h-60 min-h-0 flex-1 basis-0 flex-col border-b border-slate-100 last:border-b-0',
  segBtn: 'flex min-h-0 flex-1 flex-col items-center gap-2.5 pb-1.5 pt-3 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800',
  close: 'grid h-7 shrink-0 place-items-center text-slate-400 opacity-50 transition-colors hover:bg-slate-100 hover:text-rose-600 group-hover:opacity-100',
} as const

const motionProps = (dir: number) => ({
  custom: dir,
  variants: paneVariants,
  initial: 'enter',
  animate: 'center',
  exit: 'exit',
  transition: SPRING_COLUMN,
  layout: true,
})

export const FlowSpine = forwardRef<HTMLElement, { title: string; dispatch: (a: Action) => void }>(function FlowSpine({ title, dispatch }, ref) {
  return (
    <m.section ref={ref} {...motionProps(-1)} className={cn(styles.card, 'overflow-hidden')} data-slot="main" data-spine>
      <button
        type="button"
        className="flex h-full w-full flex-col items-center gap-3 py-3 text-slate-500 transition-colors hover:bg-slate-100"
        onClick={() => dispatch({ type: 'expand' })}
        aria-label="흐름 칸 펼치기"
        data-tt={`흐름 칸 펼치기 — ${title}`}
      >
        <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">흐름</span>
        <span className={styles.vtitle} data-spine-title>
          {title}
        </span>
      </button>
    </m.section>
  )
})

interface Item {
  id: string
  i: number // tabs 안 위치
  cur?: boolean // 접힌 연관 칸의 펼친 탭
}

interface StackProps {
  ix: GraphIndex
  view: View
  side: 'left' | 'right'
  phone: boolean
  dispatch: (a: Action) => void
}

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack({ ix, view, side, phone, dispatch }, ref) {
  const { tabs, active } = view
  let items: Item[]
  if (side === 'left') {
    items = tabs
      .slice(0, active)
      .map((id, i) => ({ id, i }))
      .reverse()
    if (view.collapsed === 'rel' && !phone) items.unshift({ id: tabs[active], i: active, cur: true })
  } else items = tabs.slice(active + 1).map((id, k) => ({ id, i: active + 1 + k }))

  const title = (id: string) => ix.docsById.get(id)?.title ?? '없는 글'
  const close = (it: Item) => (
    <button type="button" className={styles.close} onClick={() => dispatch({ type: 'close', index: it.i })} aria-label={`${title(it.id)} 닫기`} data-tt="닫기">
      <X size={13} />
    </button>
  )
  const shown = items.slice(0, MAX_SEG)
  const hidden = items.slice(MAX_SEG)
  return (
    <m.nav ref={ref} {...motionProps(side === 'left' ? -1 : 1)} className={styles.card} aria-label={`${side === 'left' ? '앞쪽' : '뒤쪽'} 연관 탭 (위가 가까운 글)`} data-stack={side}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <AnimatePresence initial={false}>
          {shown.map((it) => (
            <m.div
              key={it.id}
              layoutId={`tab:${it.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING_SNAPPY}
              className={styles.seg}
              data-seg={it.id}
              data-cur={it.cur || undefined}
            >
              <button
                type="button"
                className={cn(styles.segBtn, it.cur && 'text-emerald-700')}
                data-hl={it.id}
                onClick={() => dispatch(it.cur ? { type: 'expand' } : { type: 'pick', index: it.i })}
                data-tt={`${title(it.id)}${it.cur ? ' — 펼치기' : ''}`}
              >
                {it.cur ? <PanelRightOpen size={14} className="shrink-0" /> : <Link2 size={14} className="shrink-0" />}
                <span className={styles.vtitle} data-seg-title>
                  {title(it.id)}
                </span>
              </button>
              {close(it)}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
      {hidden.length > 0 && <More items={hidden} side={side} title={title} close={close} dispatch={dispatch} />}
    </m.nav>
  )
})

function More({ items, side, title, close, dispatch }: { items: Item[]; side: 'left' | 'right'; title: (id: string) => string; close: (it: Item) => ReactElement; dispatch: (a: Action) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        className="grid h-10 w-full place-items-center rounded-b-2xl border-t border-slate-100 text-[12px] font-semibold tabular-nums text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-tt={`더 먼 탭 ${items.length}개`}
        data-more
      >
        +{items.length}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            {...popIn}
            className={cn(
              'absolute bottom-0 z-20 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevated',
              side === 'left' ? 'left-[calc(100%+6px)] origin-bottom-left' : 'right-[calc(100%+6px)] origin-bottom-right',
            )}
          >
            {items.map((it) => (
              <div key={it.id} className="group flex items-center rounded-md hover:bg-slate-100">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-[13px] text-slate-600"
                  data-hl={it.id}
                  onClick={() => dispatch({ type: 'pick', index: it.i })}
                >
                  {title(it.id)}
                </button>
                <span className="w-7 [&>button]:rounded-md">{close(it)}</span>
              </div>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
