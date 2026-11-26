import { cx, type BlockOf } from '@dumpster/blocks'
import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { popIn } from '../ui/motion'

// 목차 — 칸 오른쪽 위 줄(헤딩마다 한 줄, 수준별 길이). 마우스를 올리면 열리고(조금 늦게 닫힘), 누르기로도 연다(폰)

const TOC_W = [18, 13, 9, 7, 6, 6]
const headText = (h: BlockOf<'heading'>) => h.inlines.map((x) => x.text).join('')

export function Toc({ heads, current, onGo }: { heads: BlockOf<'heading'>[]; current: string | null; onGo: (anchor: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const closeT = useRef(0)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  useEffect(() => () => clearTimeout(closeT.current), [])
  const minLv = Math.min(...heads.map((h) => h.level))
  return (
    <nav
      className="absolute right-3 top-4 z-10"
      aria-label="목차"
      ref={ref}
      onMouseEnter={() => {
        clearTimeout(closeT.current)
        setOpen(true)
      }}
      onMouseLeave={() => {
        closeT.current = window.setTimeout(() => setOpen(false), 150)
      }}
    >
      <button type="button" className="flex flex-col items-end gap-[7px] rounded-lg px-1.5 py-2" onClick={() => setOpen((o) => !o)} aria-label="목차" aria-expanded={open} data-toc-bars>
        {heads.map((h) => (
          <i key={h.anchor} className={cx('block h-0.5 rounded-sm', h.anchor === current ? 'bg-slate-700' : 'bg-slate-300')} style={{ width: TOC_W[h.level - minLv] }} />
        ))}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            {...popIn}
            className="absolute right-0 top-0 max-h-[min(62vh,480px)] w-[min(264px,calc(100cqw-32px))] overflow-auto rounded-lg border border-line bg-page p-1.5 shadow-pop"
            data-toc-panel
          >
            {heads.map((h) => (
              <button
                key={h.anchor}
                type="button"
                className={cx(
                  'block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors hover:bg-hover hover:text-slate-900',
                  h.anchor === current ? 'font-semibold text-slate-900' : 'text-slate-500',
                )}
                style={{ paddingLeft: 10 + (h.level - minLv) * 14 }}
                onClick={() => {
                  setOpen(false)
                  onGo(h.anchor)
                }}
                data-toc-item
                data-on={h.anchor === current || undefined}
              >
                {headText(h)}
              </button>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
