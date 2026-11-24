import { ChevronRight, FileText } from 'lucide-react'
import { docHref, isPlainClick, useOpenDoc, type BlockOf } from '../context'
import { cx } from '../cx'

// ![[문서]] — 본문을 끼워 넣지 않고 문서 카드로. docId가 없으면(없는·비공개 문서) 회색으로 멈춰 있는 카드
export const STYLE = {
  card: 'flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-200 px-3.5 py-2.5 text-[0.9375em]',
  active: 'bg-white text-slate-800 no-underline transition-colors hover:border-emerald-300 hover:bg-emerald-50',
  inactive: 'cursor-default bg-slate-50 text-slate-400',
  icon: 'h-4 w-4 shrink-0',
  iconActive: 'text-emerald-600',
  label: 'min-w-0 flex-1 truncate font-medium',
  chevron: 'h-4 w-4 shrink-0 text-slate-400',
}

export function EmbedView({ block }: { block: BlockOf<'embed'> }) {
  const onOpenDoc = useOpenDoc()
  const { docId, label } = block
  if (docId === null) {
    return (
      <div className={cx(STYLE.card, STYLE.inactive)} aria-disabled="true">
        <FileText className={STYLE.icon} aria-hidden />
        <span className={STYLE.label}>{label}</span>
      </div>
    )
  }
  return (
    <a
      href={docHref(docId)}
      className={cx(STYLE.card, STYLE.active)}
      onClick={(e) => {
        if (!onOpenDoc || !isPlainClick(e)) return
        e.preventDefault()
        onOpenDoc(docId)
      }}
    >
      <FileText className={cx(STYLE.icon, STYLE.iconActive)} aria-hidden />
      <span className={STYLE.label}>{label}</span>
      <ChevronRight className={STYLE.chevron} aria-hidden />
    </a>
  )
}
