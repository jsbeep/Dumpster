// 칸 틀 모양 — 칸(Pane)과 첫 화면(Home)이 같이 쓴다. 11-27 평평한 판: 카드 없이 왼쪽 1px 선으로 이웃과 나뉜다
// 폭: 두 칸이면 흐름 칸은 반으로 묶고(띠는 연관 쪽에서만 빠진다) 나머지는 남는 폭 — width 클래스는 부르는 쪽이 하나만 고른다
export const frame = {
  card: 'relative flex min-w-0 flex-col overflow-hidden bg-page @container',
  edge: 'border-l border-line', // 왼쪽 이웃(사이드바·칸·띠)과 나누는 선. 폰은 한 칸이라 없음
  grow: 'flex-1 basis-0',
  half: 'w-1/2 flex-none',
  header: 'flex h-11 max-[720px]:h-12 shrink-0 items-center gap-0.5 border-b px-2 transition-colors',
  scroll: 'relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
  page: 'mx-auto max-w-[760px] pb-16 pl-[22px] pr-10 @[560px]:px-11 @[560px]:pb-[72px]',
} as const
