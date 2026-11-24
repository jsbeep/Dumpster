import type { BlockOf } from '../context'
import { Inlines } from '../inline'

// 옵시디언은 줄바꿈 1번이 곧 줄바꿈 — 파서가 남긴 '\n'을 pre-wrap으로 그대로 보인다
export const STYLE = {
  p: 'whitespace-pre-wrap',
}

export function ParagraphView({ block }: { block: BlockOf<'paragraph'> }) {
  return (
    <p className={STYLE.p}>
      <Inlines inlines={block.inlines} />
    </p>
  )
}
