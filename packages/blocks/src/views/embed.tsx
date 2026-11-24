import { ChevronRight, FileText } from 'lucide-react'
import { docHref, isPlainClick, useOpenDoc, type BlockOf } from '../context'
import { useStyles } from '../styles'
import { cx } from '../cx'

// ![[문서]] — 본문을 끼워 넣지 않고 문서 카드로. docId가 없으면(없는·비공개 문서) 회색으로 멈춰 있는 카드
export function EmbedView({ block }: { block: BlockOf<'embed'> }) {
  const S = useStyles().embed
  const onOpenDoc = useOpenDoc()
  const { docId, label } = block
  if (docId === null) {
    return (
      <div className={cx(S.card, S.inactive)} aria-disabled="true">
        <FileText className={S.icon} aria-hidden />
        <span className={S.label}>{label}</span>
      </div>
    )
  }
  return (
    <a
      href={docHref(docId)}
      className={cx(S.card, S.active)}
      onClick={(e) => {
        if (!onOpenDoc || !isPlainClick(e)) return
        e.preventDefault()
        onOpenDoc(docId)
      }}
    >
      <FileText className={cx(S.icon, S.iconActive)} aria-hidden />
      <span className={S.label}>{label}</span>
      <ChevronRight className={S.chevron} aria-hidden />
    </a>
  )
}
