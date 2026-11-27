import { cx, type BlockOf } from '@dumpster/blocks'
import { AnimatePresence, m } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { popIn } from '../ui/motion'

// 목차 — PC: 칸 오른쪽 위 줄(헤딩마다 한 줄, 수준별 길이). 마우스를 올리면 열리고(조금 늦게 닫힘), 누르기로도 연다
//        폰(B4): 칸 머리 가운데 = 지금 읽는 헤딩, 누르면 머리 밑으로 펼쳐지는 목록(TocSheet). 움직임 없이 바로 열고 닫는다

const TOC_W = [24, 18, 13, 10, 8, 8] // 11-27 사용자: 키움 (전엔 18·13·9·7·6·6)
export const headText = (h: BlockOf<'heading'>) => h.inlines.map((x) => x.text).join('')

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
      className="absolute right-3 top-14 z-10"
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
      <button type="button" className="flex flex-col items-end gap-[9px] rounded-lg px-2 py-2.5" onClick={() => setOpen((o) => !o)} aria-label="목차" aria-expanded={open} data-toc-bars>
        {heads.map((h) => (
          <i key={h.anchor} className={cx('block h-[2.5px] rounded-sm', h.anchor === current ? 'bg-slate-700' : 'bg-slate-300')} style={{ width: TOC_W[h.level - minLv] }} />
        ))}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            {...popIn}
            className="absolute right-0 top-0 max-h-[min(62vh,480px)] w-[min(300px,calc(100cqw-32px))] overflow-auto rounded-lg border border-line bg-page p-1.5 shadow-pop"
            data-toc-panel
          >
            {heads.map((h) => (
              <button
                key={h.anchor}
                type="button"
                className={cx(
                  'block w-full rounded-md px-2.5 py-[7px] text-left text-[14px] leading-snug transition-colors hover:bg-hover hover:text-slate-900',
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

// 폰 목차 — 칸 머리 묶음([data-sticky]) 안, 머리 밑에 펼쳐진다. 밖을 누르면 닫힘(머리의 여닫기 버튼 [data-phone-toc]은 제가 토글).
// 맨 위는 글 제목(11-27 사용자) — 누르면 글 맨 위로. 아직 첫 헤딩 전이면 제목이 지금 자리(진하게)
// 헤딩을 누르면 닫고 나서 간다 — 열린 목록 높이까지 칸 머리로 쳐서 자리를 재면 그만큼 덜 내려간다
export function TocSheet({
  title,
  heads,
  current,
  onTop,
  onGo,
  onClose,
}: {
  title: string
  heads: BlockOf<'heading'>[]
  current: string | null
  onTop: () => void
  onGo: (anchor: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const t = e.target as Element
      if (!ref.current?.contains(t) && !t.closest('[data-phone-toc]')) onClose()
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [onClose])
  const minLv = Math.min(...heads.map((h) => h.level))
  return (
    <nav ref={ref} aria-label="목차" className="max-h-[60vh] overflow-y-auto overscroll-contain border-b border-line py-1" data-toc-sheet>
      <button
        type="button"
        className={cx('block w-full py-2.5 pl-4 pr-4 text-left text-[15px] font-bold leading-snug', current ? 'text-slate-500' : 'text-slate-900')}
        onClick={() => {
          onClose()
          requestAnimationFrame(onTop)
        }}
        data-toc-title
      >
        {title}
      </button>
      {heads.map((h) => (
        <button
          key={h.anchor}
          type="button"
          className={cx('block w-full py-2.5 pr-4 text-left text-[15px] leading-snug', h.anchor === current ? 'font-semibold text-slate-900' : 'text-slate-500')}
          style={{ paddingLeft: 16 + (h.level - minLv) * 14 }}
          onClick={() => {
            onClose()
            requestAnimationFrame(() => onGo(h.anchor))
          }}
          data-toc-item
          data-on={h.anchor === current || undefined}
        >
          {headText(h)}
        </button>
      ))}
    </nav>
  )
}
