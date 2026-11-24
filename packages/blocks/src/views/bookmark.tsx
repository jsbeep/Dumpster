import { Globe } from 'lucide-react'
import { useImageLoading, type BlockOf } from '../context'
import { safeHref } from '../cx'

// blog-explorer 북마크 카드 — 글은 왼쪽, 미리보기 그림은 오른쪽에 붙인다
export const STYLE = {
  card: 'flex min-w-0 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white no-underline transition-colors hover:bg-slate-50',
  body: 'flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3',
  title: 'truncate text-[0.875em] font-medium text-slate-800',
  description: 'line-clamp-2 text-[0.75em] leading-[1.5] text-slate-500',
  url: 'mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.75em] text-slate-400',
  icon: 'h-3.5 w-3.5 shrink-0 rounded-sm',
  image: 'w-28 shrink-0 object-cover sm:w-40',
}

export function BookmarkView({ block }: { block: BlockOf<'bookmark'> }) {
  const href = safeHref(block.href) ?? undefined
  const loading = useImageLoading()
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={STYLE.card}>
      <div className={STYLE.body}>
        <p className={STYLE.title}>{block.title || block.href}</p>
        {block.description && <p className={STYLE.description}>{block.description}</p>}
        <p className={STYLE.url}>
          {block.icon ? <img src={block.icon} alt="" className={STYLE.icon} /> : <Globe className={STYLE.icon} aria-hidden />}
          <span className="truncate">{block.href}</span>
        </p>
      </div>
      {block.image && <img src={block.image} alt="" loading={loading} className={STYLE.image} />}
    </a>
  )
}
