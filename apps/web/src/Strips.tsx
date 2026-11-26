import { cx } from '@dumpster/blocks'
import type { GraphIndex } from '@dumpster/schema'
import { AnimatePresence, m } from 'framer-motion'
import { Link2, PanelRightOpen, X } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState, type ReactElement } from 'react'
import { paneVariants, popIn, QUICK } from './ui/motion'
import type { Action, View } from './core/view'

// 띠 (design.md §3 "칸") — 46px 세로 줄, 사이드바 바탕색. 왼쪽 1px 선으로 이웃과 나뉜다 (11-27 평평한 판)
//   FlowSpine: 접힌 흐름 칸 — 누르면 펼침
//   Stack    : 펼치지 않은 연관 탭. 왼쪽 = 펼친 탭 앞쪽, 오른쪽 = 뒤쪽, 둘 다 위가 펼친 탭에 가까운 글.
//              연관 칸까지 접으면 펼친 탭도 왼쪽 띠 맨 위로. 한쪽 5개 넘으면 먼 건 +n 목록(거기서도 닫기)
//              탭마다 layoutId — 띠를 누르면 사이 탭들이 반대쪽 띠로 미끄러져 간다

const MAX_SEG = 5

const styles = {
  card: 'relative flex w-[46px] shrink-0 flex-col border-l border-line bg-side',
  // 세로쓰기 제목 — 끝 글자가 잘리지 않게 pb-2 (한글은 글자 상자가 커서 overflow-hidden 끝에서 아래가 깎인다)
  vtitle: 'min-h-0 shrink overflow-hidden text-ellipsis whitespace-nowrap pb-2 text-[13px] font-semibold text-slate-700 [writing-mode:vertical-rl]',
  // 탭 한 칸 = 제목 길이만큼 (길면 240px에서 말줄임). 많아서 넘치면 다 같이 줄어든다
  seg: 'group flex max-h-60 min-h-0 shrink flex-col border-b border-line',
  segBtn: 'flex min-h-0 flex-col items-center gap-2 pt-3 transition-colors hover:bg-side-hover hover:text-slate-900',
  segIdle: 'text-slate-400',
  segCur: 'text-slate-900',
  close: 'grid h-7 shrink-0 place-items-center text-slate-400 opacity-50 transition-colors hover:bg-side-hover hover:text-rose-600 group-hover:opacity-100',
} as const

const motionProps = (dir: number, z: number) => ({
  style: { zIndex: z },
  custom: dir,
  variants: paneVariants,
  initial: 'enter',
  animate: 'center',
  exit: 'exit',
  transition: QUICK,
  layout: true,
})

export const FlowSpine = forwardRef<HTMLElement, { title: string; z: number; dispatch: (a: Action) => void }>(function FlowSpine({ title, z, dispatch }, ref) {
  return (
    <m.section ref={ref} {...motionProps(-1, z)} className={cx(styles.card, 'overflow-hidden')} data-slot="main" data-spine>
      <button
        type="button"
        className="flex h-full w-full flex-col items-center gap-2.5 pt-3 text-slate-500 transition-colors hover:bg-side-hover"
        onClick={() => dispatch({ type: 'expand' })}
        aria-label="흐름 칸 펼치기"
        data-tt={`흐름 칸 펼치기 — ${title}`}
      >
        <span className="shrink-0 text-[11px] font-bold text-slate-500">흐름</span>
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
  z: number
  phone: boolean
  dispatch: (a: Action) => void
}

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack({ ix, view, side, z, phone, dispatch }, ref) {
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
    <m.nav ref={ref} {...motionProps(side === 'left' ? -1 : 1, z)} className={styles.card} aria-label={`${side === 'left' ? '앞쪽' : '뒤쪽'} 연관 탭 (위가 가까운 글)`} data-stack={side}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 띠 사이를 옮겨 가는 탭은 layoutId로 미끄러지기만 — 나가는 쪽을 페이드로 남기면 옮겨 간 쪽과 겹쳐 보인다 */}
        {shown.map((it) => (
          <m.div
            key={it.id}
            layoutId={`tab:${it.id}`}
            transition={QUICK}
            className={styles.seg}
            data-seg={it.id}
            data-cur={it.cur || undefined}
          >
            <button
              type="button"
              className={cx(styles.segBtn, it.cur ? styles.segCur : styles.segIdle)}
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
        className="grid h-10 w-full place-items-center border-t border-line text-[12px] font-semibold tabular-nums text-slate-500 transition-colors hover:bg-side-hover hover:text-slate-900"
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
            className={cx(
              'absolute bottom-0 z-20 w-60 rounded-lg border border-line bg-page p-1.5 shadow-pop',
              side === 'left' ? 'left-[calc(100%+6px)]' : 'right-[calc(100%+6px)]',
            )}
          >
            {items.map((it) => (
              <div key={it.id} className="group flex items-center rounded-md hover:bg-hover">
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
