import { cx } from '@dumpster/blocks'
import type { Doc, GraphIndex } from '@dumpster/schema'
import { Folder } from 'lucide-react'
import { Fragment } from 'react'
import { forkTrail } from '../core/treeRows'
import { DocLink } from '../ui/DocLink'

// 본문 맨 위 줄 — 컬렉션 이름(누르면 사이드바 트리에서 이 글 보이기).
// 사이드바 트리가 화면에 없을 때(폰·좁은 창·접은 사이드바, P4.4)는 브레드크럼으로 늘어난다:
//   📁 컬렉션 › 분기점 › 분기점 — 이 글까지 거쳐 온 분기점(트리에서 들여쓰기가 늘어나는 곳 = 폴더 경로, core/treeRows forkTrail).
//   분기점을 누르면 이 칸에서 그 글로 (이전/다음과 같은 이동 — 그 글 끝에 '다음 · 갈래 n' 목록이 있다).
//   지금 글은 안 넣는다(제목이 바로 아래). 분기점은 가까운 MAX개까지, 더 있으면 앞쪽은 '…'(누르면 트리에서 보기) — 폰 폭(본문 ~330px)

const MAX = 2
const styles = {
  row: '-ml-1.5 mt-3.5 flex max-w-full items-center text-[12.5px] text-slate-500',
  item: 'min-w-0 rounded-md px-1.5 py-0.5 transition-colors hover:bg-hover hover:text-slate-900',
  sep: 'shrink-0 select-none text-slate-300',
} as const

interface Props {
  ix: GraphIndex
  doc: Doc
  trail: boolean // 분기점까지 (사이드바 트리가 안 보일 때)
  onReveal: (docId: string) => void
  onStep: (docId: string) => void
}

export function Crumbs({ ix, doc, trail, onReveal, onStep }: Props) {
  const col = ix.collectionsById.get(doc.collectionId)
  const forks = trail ? forkTrail(ix, doc.id) : []
  const cut = forks.length > MAX
  const shown = cut ? forks.slice(-MAX) : forks
  const sep = <span className={styles.sep} aria-hidden>›</span>
  return (
    <nav className={styles.row} aria-label="트리에서 이 글의 자리" data-crumbs={forks.length || undefined} data-nofind>
      <button type="button" className={cx(styles.item, 'inline-flex shrink-0 items-center gap-1.5', forks.length > 0 && 'max-w-[45%]')} onClick={() => onReveal(doc.id)} data-tt="사이드바 트리에서 보기">
        <Folder size={13} className="shrink-0" aria-hidden />
        <span className="truncate">{col?.path.join(' › ')}</span>
      </button>
      {cut && (
        <>
          {sep}
          <button type="button" className={cx(styles.item, 'shrink-0')} onClick={() => onReveal(doc.id)} aria-label={`분기점 ${forks.length - shown.length}개 더 — 트리에서 보기`} data-tt={`분기점 ${forks.length - shown.length}개 더 — 트리에서 보기`} data-crumb-more>
            …
          </button>
        </>
      )}
      {shown.map((id) => (
        <Fragment key={id}>
          {sep}
          <DocLink id={id} onGo={() => onStep(id)} className={cx(styles.item, 'truncate')} data-crumb>
            {ix.docsById.get(id)?.title}
          </DocLink>
        </Fragment>
      ))}
    </nav>
  )
}
