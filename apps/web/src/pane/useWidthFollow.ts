import { useCallback, useEffect, useLayoutEffect, useRef, type ForwardedRef } from 'react'

// ── 칸 폭이 바뀔 때 (탭 열기·닫기·접기·띠) — iOS push/pop 전환처럼 ──
// 애니메이션 동안 본문 폭 = 옛 폭과 새 폭 중 좁은 쪽 → 본문이 칸보다 넓어 양옆이 잘려 보이는 순간이 없다
//   넓어질 때: 옛(좁은) 폭·여백으로 묶었다가 움직이는 도중에 풀어서 한 번 줄바꿈 — 끝나고 툭 바뀌지 않게.
//             푸는 때 = 칸이 70%쯤 넓어졌고 새 폭 글자가 칸 안에 들어갈 때 (여백만 잘리는 건 안 보이니 봐줌)
//   좁아질 때: 묶지 않음 — 처음부터 새(좁은) 폭으로 줄바꿈
// 가운데 따라가기: 본문은 첫 프레임부터 '끝 자리'(새 칸 가운데)에 놓이고 칸의 보이는 가장자리만 움직인다 →
//   애니메이션 동안 그림마다 칸의 '보이는 상자' 가운데를 재서 본문을 거기로 옮긴다 (아래 startFollow). 칸 애니메이션이 끝나면 멈춘다
//   안 된 방법: 본문 layout="position"(옛/새 상자의 왼쪽 끝을 맞춰서 (옛 폭 − 새 폭)/2 어긋남),
//   따로 돈 스프링 x(칸 layout 애니메이션이 몇 프레임 늦게 시작해서 어긋남)
// 묶기는 그리기 전(useLayoutEffect, 렌더마다)에 — 커밋 직후 첫 화면부터 옛 폭
//
// 쓰는 쪽(Pane)이 붙일 것:
//   setCard     → 칸 카드(m.section)의 ref. AnimatePresence(popLayout)가 넘긴 ref에도 같이 넣는다
//   innerRef    → 안쪽 감싸개(m.div layout="position"). 칸과 같은 transition이어야 한다
//   articleRef  → 본문(article)
//   unfreeze    → 칸 카드의 onLayoutAnimationComplete

const EDGE = 12 // 칸 폭이 바뀌는 도중 본문 글자와 칸 테두리 사이에 남길 최소 틈

export function useWidthFollow(ref: ForwardedRef<HTMLElement>) {
  const cardRef = useRef<HTMLElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const articleRef = useRef<HTMLElement | null>(null)
  const box = useRef<{ card: number; w: number; pl: string; pr: string } | null>(null)
  const frozen = useRef(false)
  const releaseAt = useRef(Infinity) // 칸의 보이는 폭이 이만큼 되면 묶기를 푼다
  const unfreezeT = useRef(0)
  const followX = useRef(0)
  const watcher = useRef<MutationObserver | null>(null)

  const remember = () => {
    const a = articleRef.current
    const c = cardRef.current
    if (!a || !c) return
    const cs = getComputedStyle(a)
    box.current = { card: c.offsetWidth, w: a.offsetWidth, pl: cs.paddingLeft, pr: cs.paddingRight }
  }
  const stopFollow = () => {
    watcher.current?.disconnect()
    watcher.current = null
    followX.current = 0
    if (articleRef.current) articleRef.current.style.transform = ''
  }
  // 칸의 보이는 상자(transform 포함) 가운데로 본문을 옮긴다. 묶여 있고 칸이 충분히 넓어졌으면 먼저 풀고 잰다 (같은 그림)
  const follow = () => {
    const a = articleRef.current
    const c = cardRef.current
    if (!a || !c) return stopFollow()
    const cr = c.getBoundingClientRect()
    if (frozen.current && cr.width >= releaseAt.current) release()
    const ar = a.getBoundingClientRect()
    const natural = (ar.left + ar.right) / 2 - followX.current
    followX.current = (cr.left + cr.right) / 2 - natural
    a.style.transform = `translateX(${followX.current}px)`
  }
  // framer가 칸·안쪽 감싸개의 transform을 쓸 때마다 따라간다 (MutationObserver = 쓴 직후 마이크로태스크, 그리기 전).
  //   framer는 프레임 루프 말고도 다시 그리기(커밋) 직후 마이크로태스크에서 transform을 바로 쓴다 — 첫 프레임, 그리고
  //   애니메이션 도중 다른 칸의 본문이 도착해 다시 그릴 때. 프레임 루프(postRender)에 걸었더니 그 그림을 놓쳐 한 프레임씩 튀었다
  const startFollow = () => {
    if (!watcher.current) {
      const w = new MutationObserver(() => follow())
      for (const el of [cardRef.current, innerRef.current]) if (el) w.observe(el, { attributes: true, attributeFilter: ['style'] })
      watcher.current = w
    }
    follow()
  }
  const release = () => {
    releaseAt.current = Infinity
    const a = articleRef.current
    if (!frozen.current || !a) return
    frozen.current = false
    for (const k of ['width', 'maxWidth', 'marginLeft', 'marginRight', 'paddingLeft', 'paddingRight'] as const) a.style[k] = ''
    remember()
  }
  // 칸 애니메이션 끝 — 따라가기를 멈추고, 아직 묶여 있으면 (도중에 들어갈 자리가 안 났으면) 여기서 푼다
  const unfreeze = () => {
    clearTimeout(unfreezeT.current)
    stopFollow()
    release()
  }

  useLayoutEffect(() => {
    const a = articleRef.current
    const c = cardRef.current
    if (!a || !c || frozen.current) return
    const prev = box.current
    // offsetWidth는 transform(layout 애니메이션)과 상관없는 진짜 폭 — 스크롤바가 생겨 안쪽만 좁아진 건 무시
    if (prev && Math.abs(prev.card - c.offsetWidth) > 1) {
      // 움직임 줄이기(OS 설정)면 칸도 바로 바뀐다 — 묶지도 따라가지도 않음
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return remember()
      startFollow()
      clearTimeout(unfreezeT.current)
      unfreezeT.current = window.setTimeout(unfreeze, 1200) // 칸 애니메이션이 안 일어난 경우(창 크기 등) 대비
      // a.offsetWidth = 묶지 않았을 때의 새 폭 (커밋 직후, 그리기 전). 좁아지면 묶지 않는다
      if (a.offsetWidth <= prev.w + 1) return remember() // 좁아짐: 묶지 않음 (따라가기만)
      // 새 폭 본문은 칸 가운데에 놓이니 한쪽으로 (본문 − 칸)/2 삐져나온다 — 그게 여백 − EDGE 안이면 글자는 칸 안
      const cs = getComputedStyle(a)
      const slack = 2 * Math.max(0, Math.min(parseFloat(cs.paddingLeft), parseFloat(cs.paddingRight)) - EDGE)
      releaseAt.current = Math.max(prev.card + 0.7 * (c.offsetWidth - prev.card), a.offsetWidth - slack)
      frozen.current = true
      Object.assign(a.style, {
        width: `${prev.w}px`,
        maxWidth: 'none',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: prev.pl,
        paddingRight: prev.pr,
      })
      return
    }
    remember()
  })
  useEffect(
    () => () => {
      clearTimeout(unfreezeT.current)
      watcher.current?.disconnect()
    },
    [],
  )

  // 카드 ref는 둘에게 — 내 측정용 + AnimatePresence(popLayout)가 넘긴 것
  const setCard = useCallback(
    (el: HTMLElement | null) => {
      cardRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )

  return { setCard, innerRef, articleRef, unfreeze }
}
