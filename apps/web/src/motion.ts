// 움직임 값 — mongolive(utils/motionPresets.ts · MillerColumns · Sidebar)와 blog-explorer에서 그대로 옮김
export const SPRING_SNAPPY = { type: 'spring', stiffness: 400, damping: 35 } as const
export const SPRING_HOVER = { type: 'spring', stiffness: 400, damping: 30 } as const
export const SPRING_SOFT = { type: 'spring', stiffness: 300, damping: 28 } as const
export const SPRING_SHARP = { type: 'spring', stiffness: 600, damping: 28 } as const
export const SPRING_SIDEBAR = { type: 'spring', stiffness: 420, damping: 40 } as const // Sidebar
export const SPRING_COLUMN = { type: 'spring', stiffness: 260, damping: 28 } as const // MillerColumns

// 칸 들어오기·나가기 (MillerColumns colVariants). custom = 방향: 1 = 오른쪽에서, -1 = 왼쪽에서, 0 = 제자리
// 나가는 칸은 클릭을 안 받는다 (popLayout이라 투명한 채 다른 칸 위에 떠 있다)
export const paneVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '60%' : dir < 0 ? '-60%' : 0, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1, pointerEvents: 'auto' as const },
  exit: { opacity: 0, scale: 0.94, pointerEvents: 'none' as const },
}

// 떠 있는 작은 패널 (blog-explorer FloatingEdgePanel). 위에 붙은 패널이라 아래로 내려오며 나타남
export const popIn = {
  initial: { opacity: 0, y: -6, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.96 },
  transition: SPRING_SOFT,
}

// 높이 0 ↔ auto (mongolive PageRail 목록 · 트리 갈래 접기)
export const collapseY = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: SPRING_SNAPPY,
}
