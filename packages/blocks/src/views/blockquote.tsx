import { BlockView } from '../BlockRenderer'
import type { BlockOf } from '../context'

export const STYLE = {
  quote: 'flex min-w-0 flex-col gap-2 border-l-[3px] border-slate-300 py-0.5 pl-4 text-slate-600',
}

export function BlockquoteView({ block }: { block: BlockOf<'blockquote'> }) {
  return (
    <blockquote className={STYLE.quote}>
      {block.children.map((child, i) => (
        <BlockView key={i} block={child} />
      ))}
    </blockquote>
  )
}
