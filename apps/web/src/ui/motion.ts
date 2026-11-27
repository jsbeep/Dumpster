// 움직임 값 — 11-27 사용자: 확대·축소(scale)와 튕기는 스프링은 빼고, 미끄러지기만 빠르게 (기교 없이)
// 빠르게 출발해서 부드럽게 멈추는 곡선 하나 + 길이 둘
const EASE = [0.2, 0, 0, 1] as const
export const QUICK = { type: 'tween', ease: EASE, duration: 0.2 } as const // 칸·사이드바·띠 탭이 옮겨 갈 때
export const FAST = { type: 'tween', ease: EASE, duration: 0.12 } as const // 나가기·팝오버·높이 접기

// 칸 들어오기·나가기. custom = 방향: 1 = 오른쪽에서, -1 = 왼쪽에서, 0 = 제자리
// 나가는 칸은 클릭을 안 받는다 (popLayout이라 투명한 채 다른 칸 위에 떠 있다)
export const paneVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '24%' : dir < 0 ? '-24%' : 0, opacity: 0 }),
  center: { x: 0, opacity: 1, pointerEvents: 'auto' as const },
  exit: { opacity: 0, pointerEvents: 'none' as const, transition: FAST },
}

// 떠 있는 작은 패널(목차·+n 목록). 위에 붙은 패널이라 살짝 내려오며 나타남
export const popIn = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: FAST,
}

// 높이 0 ↔ auto (트리 갈래 접기 · 컬렉션 펼치기)
export const collapseY = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: FAST,
}
// 폰은 펼치기·접기를 바로 (11-27 사용자). 높이 애니메이션은 CSS로 해도 매 프레임 레이아웃이라 GPU로 못 넘긴다 —
// iOS 저전력 모드에선 어차피 30fps라 차라리 뺀다. AnimatePresence 안에서 그대로 바꿔 끼우게 모양은 collapseY와 같게
export const collapseNow = { ...collapseY, initial: false as const, transition: { duration: 0 } }
