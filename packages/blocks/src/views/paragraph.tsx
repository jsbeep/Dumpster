import type { BlockOf } from '../context'
import { useStyles } from '../styles'
import { Inlines } from '../inline'

// 옵시디언은 줄바꿈 1번이 곧 줄바꿈 — 파서가 남긴 '\n'을 pre-wrap으로 그대로 보인다
export function ParagraphView({ block }: { block: BlockOf<'paragraph'> }) {
  const S = useStyles().paragraph
  return (
    <p className={S.p}>
      <Inlines inlines={block.inlines} />
    </p>
  )
}
