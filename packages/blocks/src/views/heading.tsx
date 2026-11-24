import type { BlockOf } from '../context'
import { useStyles } from '../styles'
import { cx } from '../cx'
import { Inlines } from '../inline'

// 크기는 em — 본문 크기(BlockRenderer root)를 따라간다. 첫 블록이면 위 여백을 없앤다
// 굵기·색은 단계마다 따로 (base와 겹치면 Tailwind CSS 순서로 이기는 쪽이 정해져서)
export function HeadingView({ block }: { block: BlockOf<'heading'> }) {
  const S = useStyles().heading
  const Tag = `h${block.level}` as const
  return (
    <Tag id={block.anchor} className={cx(S.base, S.level[block.level])}>
      <Inlines inlines={block.inlines} />
    </Tag>
  )
}
