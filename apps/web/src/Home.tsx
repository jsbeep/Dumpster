import { cx } from '@dumpster/blocks'
import type { GraphIndex } from '@dumpster/schema'
import { m } from 'framer-motion'
import { Menu } from 'lucide-react'
import { forwardRef, useLayoutEffect } from 'react'
import { paneVariants, QUICK } from './ui/motion'
import { frame } from './pane/styles'
import { IconButton } from './ui/IconButton'
import { SITE } from './ui/site'
import { DocLink } from './ui/DocLink'
import { md } from './ui/format'

// 첫 화면 — 컬렉션 카드 + 최근 글 (design.md 11-24). 칸 하나에 담는다. 폰은 머리에 ☰ (목록 열기)
export const Home = forwardRef<HTMLElement, { ix: GraphIndex; z: number; phone: boolean; onMenu?: () => void; onOpen: (id: string) => void }>(function Home(
  { ix, z, phone, onMenu, onOpen },
  ref,
) {
  const recent = [...ix.graph.docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title, 'ko')).slice(0, 8)
  // 폰은 문서가 스크롤된다(pane/styles frame) — 지난 글의 스크롤 자리가 남아 있으니 맨 위로. 움직임도 없음
  useLayoutEffect(() => {
    if (phone) scrollTo(0, 0)
  }, [phone])
  const motion = phone ? {} : { custom: 0, variants: paneVariants, initial: 'enter', animate: 'center', exit: 'exit', transition: QUICK }
  return (
    <m.section ref={ref} {...motion} style={{ zIndex: z }} className={cx(frame.card, phone ? frame.phone : frame.clip, frame.grow, !phone && frame.edge)} data-slot="home">
      {onMenu && (
        <div className={cx(frame.header, 'border-transparent', phone && frame.sticky)}>
          <IconButton label="목록 열기" onClick={onMenu} data-menu>
            <Menu size={18} />
          </IconButton>
        </div>
      )}
      <div className={phone ? frame.scrollPage : frame.scroll}>
        <article className={cx(frame.page, frame.padEven)}>
          <h1 className="mt-8 text-[24px] font-bold leading-[1.3] tracking-[-0.02em] text-slate-900 @[560px]:text-[28px]">{SITE.title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500">짬통에 던져 둔 글을 컬렉션별로 이어 읽는 곳.</p>
          <h2 className="mb-3 mt-9 text-[11px] font-semibold uppercase tracking-wider text-slate-400">컬렉션</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {ix.graph.collections.map((c) => {
              const first = c.manifestId && ix.docsById.has(c.manifestId) ? c.manifestId : ix.tree(c.id).rows[0]?.docId
              const card = (
                <>
                  {c.path.length > 1 && <span className="text-[11.5px] text-slate-400">{c.path.slice(0, -1).join(' / ')}</span>}
                  <span className="text-[16px] font-bold text-slate-900">{c.title}</span>
                  {c.description && <span className="line-clamp-3 text-[13px] leading-relaxed text-slate-500">{c.description}</span>}
                  <span className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-400">{ix.docsByCollection.get(c.id)?.length ?? 0}편</span>
                </>
              )
              const cls = 'flex flex-col gap-1 rounded-lg border border-line px-4 py-3.5 transition-colors'
              return first ? (
                <DocLink key={c.id} id={first} onGo={() => onOpen(first)} className={`${cls} hover:border-slate-300 hover:bg-hover`} data-home-card>
                  {card}
                </DocLink>
              ) : (
                <div key={c.id} className={cls} data-home-card>
                  {card}
                </div>
              )
            })}
          </div>
          <h2 className="mb-2 mt-9 text-[11px] font-semibold uppercase tracking-wider text-slate-400">최근 글</h2>
          <div className="flex flex-col">
            {recent.map((d) => (
              <DocLink key={d.id} id={d.id} onGo={() => onOpen(d.id)} className="-mx-2.5 flex items-baseline gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-hover" data-home-recent>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-slate-900">{d.title}</span>
                <span className="whitespace-nowrap text-[12.5px] tabular-nums text-slate-400">
                  {ix.collectionsById.get(d.collectionId)?.title} · {md(d.updatedAt)}
                </span>
              </DocLink>
            ))}
          </div>
        </article>
      </div>
    </m.section>
  )
})
