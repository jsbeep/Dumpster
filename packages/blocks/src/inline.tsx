import type { Inline } from '@dumpster/schema'
import type { ReactNode } from 'react'
import { docHref, isPlainClick, useOpenDoc } from './context'
import { cx, safeHref } from './cx'
import { useStyles } from './styles'

// 색은 링크 > 코드 > 굵게 순으로 하나만 — 링크 안의 굵은 글자·코드도 링크 색으로 보이게 나눠 둔다
// 스타일 메모 (styles.json "inline"):
// - highlight: <mark>는 기본 글자색이 검정이라 inherit
// - missing: 없는 문서·비공개 문서는 똑같이 보여야 한다 (비공개 문서가 있다는 사실도 새면 안 됨)

export function InlineView({ inline }: { inline: Inline }) {
  const onOpenDoc = useOpenDoc()
  const S = useStyles().inline
  const link = inline.link
  let node: ReactNode = inline.text
  if (inline.code) node = <code className={cx(S.code, !inline.highlight && S.codeBg, !link && S.codeText)}>{node}</code>
  if (inline.highlight) node = <mark className={S.highlight}>{node}</mark>
  if (inline.strike) node = <s className={S.strike}>{node}</s>
  if (inline.italic) node = <em className={S.italic}>{node}</em>
  if (inline.bold) node = <strong className={cx(S.bold, !link && S.boldColor)}>{node}</strong>

  if (!link) return <>{node}</>
  if (link.kind === 'url') {
    const href = safeHref(link.href)
    if (href === null) return <>{node}</>
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={S.url}>
        {node}
      </a>
    )
  }
  if (link.docId === null) return <span className={S.missing}>{node}</span>
  const { docId, heading } = link
  return (
    <a
      href={docHref(docId)}
      className={S.doc}
      onClick={(e) => {
        if (!onOpenDoc || !isPlainClick(e)) return
        e.preventDefault()
        onOpenDoc(docId, heading)
      }}
    >
      {node}
    </a>
  )
}

export function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((inline, i) => (
        <InlineView key={i} inline={inline} />
      ))}
    </>
  )
}
