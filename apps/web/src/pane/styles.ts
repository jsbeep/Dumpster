// 칸 틀 모양 — 칸(Pane)과 첫 화면(Home)이 같이 쓴다. 11-27 평평한 판: 카드 없이 왼쪽 1px 선으로 이웃과 나뉜다
// 폭: 두 칸이면 흐름 칸은 반으로 묶고(띠는 연관 쪽에서만 빠진다) 나머지는 남는 폭 — width 클래스는 부르는 쪽이 하나만 고른다
// 폰(≤720px, B3 11-27)은 문서가 스크롤된다: 칸을 자르지 않고(자르면 칸 머리가 화면 위에 안 붙는다 — sticky) 화면 높이 이상으로 늘어나고,
// 스크롤 상자 대신 scrollPage, 칸 머리 묶음은 sticky. 폰엔 칸 움직임이 없다 (사용자: 폰은 단순하게)
export const frame = {
  card: 'relative flex min-w-0 flex-col bg-page @container',
  clip: 'overflow-hidden', // PC — 칸 크기 애니메이션 동안 제 상자 밖을 잘라 보여 준다
  phone: 'min-h-dvh',
  edge: 'border-l border-line', // 왼쪽 이웃(사이드바·칸·띠)과 나누는 선. 폰은 한 칸이라 없음
  grow: 'flex-1 basis-0',
  half: 'w-1/2 flex-none',
  header: 'flex h-11 max-[720px]:h-12 shrink-0 items-center gap-0.5 border-b px-2 transition-colors',
  scroll: 'relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
  scrollPage: 'relative min-w-0 flex-1 overflow-x-clip', // 폰 — 늘어나기만 (clip은 스크롤 상자를 안 만들어 sticky가 산다)
  // 폰 — 칸 머리 · 찾기 줄 · 목차를 화면 위에 붙인다. 글 바꾸기 슬라이드(ui/viewTransition) 땐 이름을 따로 줘서 본문만 미끄러지고 머리는 제자리
  sticky: 'sticky top-0 z-30 bg-page [view-transition-name:phone-head]',
  page: 'mx-auto max-w-[760px] pb-16 @[560px]:px-11 @[560px]:pb-[72px]',
  // 좁은 칸(<560px)의 좌우 여백 — 오른쪽 위 목차 줄(PC, 헤딩 둘 이상)이 있으면 그 자리만큼 오른쪽을 넓힌다. 없으면(폰·첫 화면·헤딩 적은 글) 같게
  padEven: 'px-[22px]',
  padToc: 'pl-[22px] pr-10',
} as const
