import { m } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { QUICK } from '../ui/motion'
import type { Drag } from './useDrag'

// 완전 접힘 — 화면 왼쪽 끝 당김 핸들 (아이폰 PiP를 옆으로 치워 둔 모양).
// 늘 얇게 보이고 마우스가 다가가면 커진다. 누르면 접기 전 단계로(pointerup이라 합성 click은 안 닿음 — Enter로도), 끌면 끄는 만큼
export function PullHandle({ drag, onRestore }: { drag: Drag; onRestore: () => void }) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    let frame = 0
    const onMove = (e: globalThis.PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setNear(e.clientX < 56))
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  const big = near || drag.dragging
  return (
    <button
      type="button"
      className="fixed left-0 top-1/2 z-[95] flex h-28 w-6 -translate-y-1/2 touch-none items-center outline-none"
      aria-label="사이드바 꺼내기"
      data-tt={drag.dragging ? undefined : '사이드바 꺼내기 — 끌어서 꺼내도 된다'}
      onPointerDown={drag.start(0)}
      {...drag.handlers}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRestore()
        }
      }}
    >
      <m.span
        className="flex items-center justify-center overflow-hidden rounded-r-md border border-l-0 border-line bg-side text-slate-500 shadow-pop"
        initial={false}
        animate={big ? { width: 20, height: 72, opacity: 1 } : { width: 5, height: 48, opacity: 0.85 }}
        transition={QUICK}
      >
        {big && <ChevronRight size={14} aria-hidden />}
      </m.span>
    </button>
  )
}
