// mongolive components/common/TooltipLayer.tsx 그대로 — 컨트롤은 data-tt="설명"만 단다 (title 속성 대신)
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DotLegend } from './dots'

// ── 툴팁 레이어 ───────────────────────────────────────────────────────────────
// 앱 전체에 하나만 마운트되는 툴팁. 각 컨트롤은 `data-tt="설명"` 속성만 달면 되고
// (옵션: data-tt-side="top", data-tt-align="left") 여기서 이벤트 위임으로 처리한다.
//
// 왜 CSS ::after가 아니라 portal인가 —
//   ① 컬럼(칸)이 framer-motion layout 애니메이션으로 transform이 걸리고 그 부모가 stacking context를
//      만들지 않아서, 헤더 안에 그려진 툴팁이 z-index를 올려도 컬럼에 가린다.
//   ② 컬럼은 layout 애니메이션 때문에 transform이 걸린 overflow-hidden 요소라
//      containing block이 된다 — position:fixed로도 클리핑을 못 벗어난다.
// 둘 다 "조상 밖으로 나가야" 풀리는 문제라서 body portal이 유일한 해법이다.

const SHOW_DELAY_MS = 650
const LEGEND_DELAY_MS = 300 // 트리 점 범례 (data-legend="모양 상태") — 점이 작아서 금방 띄운다
const GAP = 6; // 앵커와 툴팁 사이 간격
const EDGE = 8; // 뷰포트 가장자리 최소 여백

interface TipState {
  text: string
  legend?: string[]
  anchor: DOMRect
  side: 'top' | 'bottom'
  align: 'left' | 'right'
}

export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null)
  // 실제 좌표는 툴팁을 한 번 그려서 크기를 재야 정해진다 — 그 전엔 화면 밖에 숨겨둔다.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<number | null>(null)
  // 현재 띄워둔(또는 띄우기로 예약한) 앵커. pointerover는 앵커 안의 자식 위를 지날
  // 때마다 다시 발생하므로, 이게 없으면 같은 버튼 안에서 마우스만 움직여도
  // 타이머와 좌표가 계속 리셋돼 툴팁이 깜빡인다.
  const anchorRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const hide = () => {
      clearTimer()
      anchorRef.current = null
      setTip(null)
      setPos(null)
    }

    const findAnchor = (node: EventTarget | null): HTMLElement | null =>
      node instanceof Element ? (node.closest('[data-tt], [data-legend]') as HTMLElement | null) : null

    const handleOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return // 손가락·펜으로 누를 땐 툴팁 없음 — 폰에서 눌린 뒤 남아 있지 않게
      const anchor = findAnchor(event.target)
      const text = anchor?.dataset.tt ?? ''
      const legend = anchor?.dataset.legend
      if (!anchor || (!text && legend === undefined)) return
      // 같은 앵커 안에서 자식 사이를 이동한 것뿐이면 그대로 둔다
      if (anchor === anchorRef.current) return

      clearTimer()
      anchorRef.current = anchor
      setPos(null)
      timerRef.current = window.setTimeout(() => {
        setTip({
          text,
          legend: legend?.split(' '),
          anchor: anchor.getBoundingClientRect(),
          side: anchor.dataset.ttSide === 'top' ? 'top' : 'bottom',
          align: anchor.dataset.ttAlign === 'left' ? 'left' : 'right',
        })
      }, legend === undefined ? SHOW_DELAY_MS : LEGEND_DELAY_MS)
    }

    const handleOut = (event: PointerEvent) => {
      const anchor = findAnchor(event.target)
      if (!anchor) return
      // 자식 요소로 이동한 것뿐이면 계속 띄워둔다
      if (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) return
      hide()
    }

    document.addEventListener('pointerover', handleOver)
    document.addEventListener('pointerout', handleOut)
    document.addEventListener('pointerdown', hide)
    // 캡처 단계로 받아야 컬럼 내부 스크롤까지 잡힌다 (스크롤되면 앵커 좌표가 무효)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)

    return () => {
      clearTimer()
      document.removeEventListener('pointerover', handleOver)
      document.removeEventListener('pointerout', handleOut)
      document.removeEventListener('pointerdown', hide)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  useLayoutEffect(() => {
    const el = tipRef.current
    if (!tip || !el) return

    const { width, height } = el.getBoundingClientRect()
    const { anchor } = tip

    const preferredLeft = tip.align === 'left' ? anchor.left : anchor.right - width
    const left = Math.min(Math.max(preferredLeft, EDGE), window.innerWidth - width - EDGE)

    const below = anchor.bottom + GAP
    const above = anchor.top - height - GAP
    let top = tip.side === 'top' ? above : below
    // 선호 방향에 공간이 없으면 반대쪽으로 뒤집는다
    if (top + height > window.innerHeight - EDGE) top = above
    if (top < EDGE) top = below

    setPos({ left, top })
  }, [tip])

  if (!tip) return null

  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      className={
        tip.legend
          ? 'pointer-events-none fixed z-[900] rounded-lg border border-line bg-page px-3 py-2.5 shadow-pop transition-opacity duration-100'
          : 'pointer-events-none fixed z-[900] max-w-[216px] rounded-md bg-slate-900 px-2 py-1.5 text-[11px] font-medium leading-snug text-slate-50 shadow-pop transition-opacity duration-100'
      }
      style={{
        // 좌표를 재기 전(pos === null)엔 화면 밖에 둔다 — opacity만 0으로 두면
        // 전환 중인 프레임이 (0,0)에 잠깐 보인다.
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        opacity: pos ? 1 : 0,
      }}
    >
      {tip.legend ? <DotLegend on={tip.legend} /> : tip.text}
    </div>,
    document.body,
  )
}
