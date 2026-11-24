import type { BlockOf } from '../context'
import { cx } from '../cx'
import { Inlines } from '../inline'

// 크기는 em — 본문 크기(BlockRenderer root)를 따라간다. 첫 블록이면 위 여백을 없앤다
// 굵기·색은 단계마다 따로 (base와 겹치면 Tailwind CSS 순서로 이기는 쪽이 정해져서)
export const STYLE = {
  base: 'scroll-mt-4 leading-snug tracking-[-0.01em] first:mt-0',
  level: {
    1: 'mt-8 text-[1.875em] font-bold text-slate-900',
    2: 'mt-7 text-[1.5em] font-bold text-slate-900',
    3: 'mt-6 text-[1.25em] font-semibold text-slate-900',
    4: 'mt-5 text-[1.125em] font-semibold text-slate-900',
    5: 'mt-4 text-[1em] font-semibold text-slate-900',
    6: 'mt-4 text-[0.9375em] font-semibold text-slate-500',
  },
}

export function HeadingView({ block }: { block: BlockOf<'heading'> }) {
  const Tag = `h${block.level}` as const
  return (
    <Tag id={block.anchor} className={cx(STYLE.base, STYLE.level[block.level])}>
      <Inlines inlines={block.inlines} />
    </Tag>
  )
}
