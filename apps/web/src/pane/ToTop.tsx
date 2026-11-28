import { cx } from '@dumpster/blocks'
import { ArrowUp } from 'lucide-react'
import { frame } from './styles'

// 맨 위로 (11-28) — 칸마다 하나라 탭마다 따로: 그 칸에서 한 화면 넘게 내려오면 오른쪽 아래에 나타난다 (useScrollSpy far)
//   PC: 칸 오른쪽 아래 (absolute — 칸 section 기준)
//   폰: 화면 오른쪽 아래 (fixed), 서랍이 열리면 칸과 같이 밀린다 (frame.push). 고정 요소지만 작고 가운데가 아니라
//       사파리 상태바·주소창 색(frame.drawer 설명)엔 안 걸린다
// 나타나기·사라지기는 CSS transition. 폰에서 미는 transform과 안 겹치게 미는 건 바깥, 움직임은 안쪽 버튼
const styles = {
  pc: 'absolute bottom-4 right-5 z-10',
  phone: cx('fixed bottom-4 right-4 z-30', frame.push, frame.slide),
  // 그림자는 살짝만 (11-28 사용자: shadow-pop은 과하고 폰 주소창 칸에 잘렸다 — 버튼 밑 16px 안에서 끝나게)
  btn: 'flex h-9 w-9 max-[720px]:h-11 max-[720px]:w-11 items-center justify-center rounded-md border border-line bg-page text-slate-500 shadow-[0_1px_3px_rgb(0_0_0/0.08)] transition-[opacity,transform,visibility,color] duration-150 hover:text-slate-900 motion-reduce:transition-none',
  on: 'visible translate-y-0 opacity-100',
  off: 'invisible translate-y-1 opacity-0', // invisible — 숨은 동안 Tab으로도 안 잡힌다
} as const

export function ToTop({ show, phone, onClick }: { show: boolean; phone: boolean; onClick: () => void }) {
  return (
    <div className={phone ? styles.phone : styles.pc}>
      <button type="button" className={cx(styles.btn, show ? styles.on : styles.off)} onClick={onClick} aria-label="맨 위로" data-tt="맨 위로" data-to-top>
        <ArrowUp size={phone ? 19 : 16} />
      </button>
    </div>
  )
}
