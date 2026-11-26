import { useEffect, useRef, useState, type PointerEvent } from 'react'

// 손잡이 끌기 (mongolive 그대로) — 끄는 동안의 '날 것' 너비(raw). 4px 넘게 움직여야 끌기로 친다 — 그 전에 놓으면 onClick
//   start(시작 너비) → onPointerDown, handlers → 같은 요소에 펼쳐 넣는다 (포인터 캡처)
export function useDrag(onCommit: (raw: number) => void, onClick?: () => void) {
  const dragRef = useRef<{ startX: number; startWidth: number; pointerId: number; moved: boolean } | null>(null)
  const [raw, setRaw] = useState<number | null>(null)
  const dragging = raw !== null

  // 끄는 동안 화면 어디서든 col-resize 커서 · 글자 선택 막기
  useEffect(() => {
    if (!dragging) return
    const { cursor, userSelect } = document.body.style
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = cursor
      document.body.style.userSelect = userSelect
    }
  }, [dragging])

  const start = (startWidth: number) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startWidth, pointerId: e.pointerId, moved: false }
  }
  const handlers = {
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const dx = e.clientX - drag.startX
      if (!drag.moved && Math.abs(dx) < 4) return
      drag.moved = true
      setRaw(drag.startWidth + dx)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null
      setRaw(null)
      if (drag.moved) onCommit(drag.startWidth + (e.clientX - drag.startX))
      else onClick?.()
    },
    onPointerCancel: () => {
      dragRef.current = null
      setRaw(null)
    },
  }
  return { raw, dragging, start, handlers }
}

export type Drag = ReturnType<typeof useDrag>
