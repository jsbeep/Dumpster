import { cx } from '@dumpster/blocks'
import type { GraphIndex } from '@dumpster/schema'
import { useMemo } from 'react'
import { DocLink } from '../ui/DocLink'
import { item } from './shared'

// 태그 탭 — 태그 칩(많이 쓴 순) → 고르면 그 태그 글 목록(제목순)

const styles = {
  tag: 'rounded border px-2 py-0.5 text-[12px] transition-colors',
  tagIdle: 'border-line text-slate-600 hover:bg-side-hover',
  tagOn: 'border-transparent bg-selected font-medium text-slate-900',
  sectionHead: 'mx-2 mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400',
} as const

export function Tags(p: { ix: GraphIndex; main: string | null; tag: string | null; setTag: (t: string | null) => void; onOpen: (id: string) => void }) {
  const { ix, tag } = p
  const tags = useMemo(() => {
    const count = new Map<string, number>()
    for (const d of ix.graph.docs) for (const t of d.tags) count.set(t, (count.get(t) ?? 0) + 1)
    return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [ix])
  const list = tag ? ix.graph.docs.filter((d) => d.tags.includes(tag)).sort((a, b) => a.title.localeCompare(b.title, 'ko')) : []
  return (
    <>
      <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-1.5">
        {tags.map(([t, n]) => (
          <button key={t} type="button" className={cx(styles.tag, tag === t ? styles.tagOn : styles.tagIdle)} aria-pressed={tag === t} onClick={() => p.setTag(tag === t ? null : t)}>
            #{t}
            <span className="ml-1 tabular-nums text-slate-400">{n}</span>
          </button>
        ))}
      </div>
      {tag && (
        <>
          <p className={styles.sectionHead}>#{tag}</p>
          {list.map((d) => (
            <DocLink key={d.id} id={d.id} onGo={() => p.onOpen(d.id)} className={cx(item.row, p.main === d.id ? item.on : item.idle)}>
              <span className={item.title}>{d.title}</span>
              <span className={item.meta}>{ix.collectionsById.get(d.collectionId)?.title}</span>
            </DocLink>
          ))}
        </>
      )}
    </>
  )
}
