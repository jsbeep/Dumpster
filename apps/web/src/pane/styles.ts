// 칸 틀 모양 — 칸(Pane)과 첫 화면(Home)이 같이 쓴다. 11-27 평평한 판: 카드 없이 왼쪽 1px 선으로 이웃과 나뉜다
// 폭: 두 칸이면 흐름 칸은 반으로 묶고(띠는 연관 쪽에서만 빠진다) 나머지는 남는 폭 — width 클래스는 부르는 쪽이 하나만 고른다
// 폰(≤720px, B3 11-27)은 문서가 스크롤된다: 칸을 자르지 않고 화면 높이 이상으로 늘어나고, 스크롤 상자 대신 scrollPage.
// 칸 머리 묶음은 화면에 고정(fixed, 11-27 — Chirpy처럼): sticky는 문서 안에 있어서 맨 위·아래에서 튕길 때(iOS 바운스) 같이 끌려갔다.
//   fixed는 조상에 transform·컨테이너(@container)가 있으면 그 조상에 붙어 버린다 → 폰은 컨테이너를 칸 대신 본문 묶음에(cq),
//   서랍이 밀 때도 칸 묶음 통째가 아니라 머리·본문을 따로 민다(push — 바깥 --push 값, Explorer)
export const frame = {
  card: 'relative flex min-w-0 flex-col bg-page',
  cq: '@container', // 칸 폭에 따른 본문 여백·제목 크기(@[560px]:) — PC는 칸에, 폰은 본문 묶음에
  head: 48, // 폰 칸 머리 높이(px) = header h-12 — 본문을 그만큼 내린다. 찾기 줄(h-12)이 열리면 그만큼 더
  clip: 'overflow-hidden', // PC — 칸 크기 애니메이션 동안 제 상자 밖을 잘라 보여 준다
  phone: 'min-h-dvh',
  edge: 'border-l border-line', // 왼쪽 이웃(사이드바·칸·띠)과 나누는 선. 폰은 한 칸이라 없음
  grow: 'flex-1 basis-0',
  half: 'w-1/2 flex-none',
  header: 'flex h-11 max-[720px]:h-12 shrink-0 items-center gap-0.5 border-b px-2 transition-colors',
  scroll: 'relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
  scrollPage: 'relative min-w-0 flex-1 overflow-x-clip', // 폰 — 늘어나기만 (clip은 스크롤 상자를 안 만들어 sticky가 산다)
  // 폰 — 칸 머리 · 찾기 줄 · 목차를 화면 위에 고정. 글 바꾸기 슬라이드(ui/viewTransition) 땐 이름을 따로 줘서 본문만 미끄러지고 머리는 제자리
  // before: 머리 바탕을 위로 늘려 상태바 밑까지 칠해 둔다 (11-28). iOS 26 사파리는 상태바 칸을 '맨 위 가운데 점'에 걸린 고정 요소
  //   (= 이 머리) 색으로 덮는데, 서랍이 열려 머리가 밀려나면 덮개를 걷고 밑에 그려진 걸 보여 준다 — 덮든 걷든(또는 걷힌 채 남든) 같아 보이게
  sticky: 'fixed inset-x-0 top-0 z-30 bg-page [view-transition-name:phone-head] before:absolute before:inset-x-0 before:bottom-full before:h-40 before:bg-page',
  // 폰 서랍 (11-28). iOS 26 사파리는 상태바·주소창 칸 색을 '화면 위·아래 끝에서 4px 안, 가로 가운데 한 점'에 걸린 고정(fixed·sticky) 요소로
  //   정한다(WebKit LocalFrameView::fixedContainerEdges). 서랍(폭 78%)이 그 점에 걸리면 '사이드바'로 보고 픽셀을 떠서 주소창 칸을 불투명하게
  //   덮었고, 닫아도 다시 재지 않아 새로고침까지 남았다 (Chirpy 같은 고정 사이드바 블로그도 같은 일). →
  //   고정 상자는 위·아래 끝에서 12px 떨어뜨려 그 점이 서랍 밑(밀린 칸 본문 — 고정 요소 아님)으로 빠지게 하고,
  //   틈과 상태바·주소창 밑은 그림자로 칠한다 — 그림자는 누르기 검사에 안 걸린다. 바탕은 위·아래로 200px 옮긴 복사본,
  //   오른쪽 1px 선(aside border-r)이 이어지게 바탕만 왼쪽으로 1px
  drawer:
    'fixed bottom-3 left-0 top-3 z-[100] shadow-[-1px_-200px_0_var(--side),0_-200px_0_var(--line),-1px_200px_0_var(--side),0_200px_0_var(--line)]',
  // 폰 서랍 미끄러짐 — CSS transition(GPU 쪽, iOS 저전력 모드에서도 부드럽게). 곡선은 ui/motion QUICK, 길이 0.28초(11-27 사용자)
  slide: 'transition-transform duration-[280ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
  push: 'translate-x-[var(--push,0px)]', // 서랍이 열리면 바깥(Explorer)이 --push = 서랍 폭
  page: 'mx-auto max-w-[760px] pb-16 @[560px]:pb-[72px]',
  // 좌우 여백 — 오른쪽 위 목차 줄(PC, 헤딩 둘 이상)이 있으면 그 자리(칸 끝에서 약 52px)만큼 오른쪽을 넓힌다(제목 줄과 안 겹치게).
  // 없으면(폰·첫 화면·헤딩 적은 글) 같게. 칸이 560px 넘으면 둘 다 넓게, 880px 넘으면 본문(최대 760px)이 가운데라 목차와 안 겹쳐 다시 같게
  padEven: 'px-[22px] @[560px]:px-11',
  padToc: 'pl-[22px] pr-14 @[560px]:pl-11 @[560px]:pr-16 @[880px]:pr-11',
} as const
