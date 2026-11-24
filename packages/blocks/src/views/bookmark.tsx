import { Globe } from 'lucide-react'
import { useImageLoading, type BlockOf } from '../context'
import { useStyles } from '../styles'
import { safeHref } from '../cx'

// blog-explorer 북마크 카드 — 글은 왼쪽, 미리보기 그림은 오른쪽에 붙인다
export function BookmarkView({ block }: { block: BlockOf<'bookmark'> }) {
  const S = useStyles().bookmark
  const href = safeHref(block.href) ?? undefined
  const loading = useImageLoading()
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={S.card}>
      <div className={S.body}>
        <p className={S.title}>{block.title || block.href}</p>
        {block.description && <p className={S.description}>{block.description}</p>}
        <p className={S.url}>
          {block.icon ? <img src={block.icon} alt="" className={S.icon} /> : <Globe className={S.icon} aria-hidden />}
          <span className="truncate">{block.href}</span>
        </p>
      </div>
      {block.image && <img src={block.image} alt="" loading={loading} className={S.image} />}
    </a>
  )
}
