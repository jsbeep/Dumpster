import { cx } from '@dumpster/blocks'
import type { GraphIndex } from '@dumpster/schema'
import { useMemo } from 'react'
import { DocLink } from '../ui/DocLink'
import { md } from '../ui/format'
import { item } from './shared'

// 최근 탭 — 고친 날짜순 16개
export function Recent({ ix, main, onOpen }: { ix: GraphIndex; main: string | null; onOpen: (id: string) => void }) {
  const list = useMemo(
    () => [...ix.graph.docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title, 'ko')).slice(0, 16),
    [ix],
  )
  return (
    <>
      {list.map((d) => (
        <DocLink key={d.id} id={d.id} onGo={() => onOpen(d.id)} className={cx(item.row, main === d.id ? item.on : item.idle)} data-recent>
          <span className={item.title}>{d.title}</span>
          <span className={item.meta}>
            <span className="truncate">{ix.collectionsById.get(d.collectionId)?.title}</span>
            <span>{md(d.updatedAt)}</span>
          </span>
        </DocLink>
      ))}
    </>
  )
}
