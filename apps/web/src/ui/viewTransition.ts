import { flushSync } from 'react-dom'
import type { SlideDir } from '../core/slide'

// 폰 글 바꾸기 슬라이드 — View Transitions API (11-27). 브라우저가 옛 화면·새 화면을 스냅샷으로 찍어 transform으로 미끄러뜨린다:
//   JS가 프레임마다 하는 일이 없어 iOS 저전력 모드(JS 애니메이션은 30fps로 묶임)에서도 부드럽고, 칸 두 개를 겹쳐 그리지 않아도 된다
//   (폰은 문서 스크롤이라 겹쳐 그리기가 어려워서 칸 움직임을 뺐었다). 모양은 index.css ::view-transition-*, 칸 머리는 제자리(pane/styles frame.sticky)
// update는 그 자리에서 다 그려야 새 화면 스냅샷이 맞다 → flushSync, 본문도 바로(useDoc peekDoc), 스크롤 자리도 그리는 중에(useScrollMemory)
// 지원 안 하는 브라우저(Chrome 111·Safari 18·Firefox 144 전)·움직임 줄이기면 그냥 바뀐다
let n = 0
const noop = () => {}

export function slide(dir: SlideDir, update: () => void) {
  if (typeof document.startViewTransition !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return update()
  const root = document.documentElement
  const my = ++n
  root.dataset.slide = dir
  const t = document.startViewTransition(() => flushSync(update))
  // 빨리 또 누르면 앞 전환은 건너뛴다(그 약속들은 거부됨) — 콘솔에 안 남게 받아 둔다
  t.ready.catch(noop)
  t.updateCallbackDone.catch(noop)
  const done = () => {
    if (my === n) delete root.dataset.slide
  }
  t.finished.then(done, done)
}
