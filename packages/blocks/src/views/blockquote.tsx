import { BlockView } from '../BlockRenderer'
import type { BlockOf } from '../context'
import { useStyles } from '../styles'

export function BlockquoteView({ block }: { block: BlockOf<'blockquote'> }) {
  const S = useStyles().blockquote
  return (
    <blockquote className={S.quote}>
      {block.children.map((child, i) => (
        <BlockView key={i} block={child} />
      ))}
    </blockquote>
  )
}
