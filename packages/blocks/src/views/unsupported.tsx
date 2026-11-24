import type { BlockOf } from '../context'
import { useStyles } from '../styles'

// 아직 못 그리는 문법(수식·각주 …) — 지우지 않고 원문 그대로 + 이유 배지
export function UnsupportedView({ block }: { block: BlockOf<'unsupported'> }) {
  const S = useStyles().unsupported
  return (
    <div className={S.box}>
      <div className={S.head}>
        <span className={S.tag}>unsupported</span>
        <span className={S.reason}>{block.reason}</span>
      </div>
      <pre className={S.raw}>{block.raw}</pre>
    </div>
  )
}
