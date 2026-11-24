import type { Block } from '@dumpster/schema'
import { useMemo, type ComponentType } from 'react'
import { RenderContext, type BlockOf, type OpenDoc } from './context'
import { cx } from './cx'
import { DEFAULT_STYLES, StylesContext, useStyles, type BlockStyles } from './styles'
import { BlockquoteView } from './views/blockquote'
import { BookmarkView } from './views/bookmark'
import { CalloutView } from './views/callout'
import { CodeView } from './views/code'
import { EmbedView } from './views/embed'
import { HeadingView } from './views/heading'
import { HrView } from './views/hr'
import { ImageView } from './views/image'
import { ListView } from './views/list'
import { ParagraphView } from './views/paragraph'
import { TableView } from './views/table'
import { UnsupportedView } from './views/unsupported'

// 블록 레지스트리 — 타입 하나에 View 하나. 새 타입이 계약에 생기면 여기서 타입 에러가 난다
export const BLOCK_VIEWS: { [K in Block['type']]: ComponentType<{ block: BlockOf<K> }> } = {
  heading: HeadingView,
  paragraph: ParagraphView,
  list: ListView,
  blockquote: BlockquoteView,
  callout: CalloutView,
  code: CodeView,
  table: TableView,
  hr: HrView,
  image: ImageView,
  bookmark: BookmarkView,
  embed: EmbedView,
  unsupported: UnsupportedView,
}

export function BlockView({ block }: { block: Block }) {
  const View = BLOCK_VIEWS[block.type] as ComponentType<{ block: Block }>
  return <View block={block} />
}

// 스타일 메모 (styles.json "renderer"):
// - root: 글자 크기·줄간격은 여기 한 곳 — 블록들은 em 단위라 탐색기가 root만 바꿔도 같이 줄고 는다.
//   한국어는 어절 단위로 줄바꿈(break-keep), 끊을 곳 없는 긴 주소는 break-words가 받는다
// - stack: 리스트·인용·콜아웃 안쪽 블록 묶음
export function BlockList({ blocks, className }: { blocks: Block[]; className?: string }) {
  const S = useStyles().renderer
  className ??= S.stack
  return (
    <div className={className}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  )
}

export interface BlockRendererProps {
  blocks: Block[]
  // 문서 링크·임베드 클릭. 없으면 href(#/d/{docId})로 그냥 이동한다
  onOpenDoc?: OpenDoc
  imageLoading?: 'lazy' | 'eager'
  className?: string
  // 스타일 덮어쓰기 (플레이그라운드가 저장 전 초안을 넘긴다). 없으면 styles.json
  styles?: BlockStyles
}

export function BlockRenderer({ blocks, onOpenDoc, imageLoading, className, styles = DEFAULT_STYLES }: BlockRendererProps) {
  const ctx = useMemo(() => ({ onOpenDoc, imageLoading }), [onOpenDoc, imageLoading])
  const S = styles.renderer
  if (blocks.length === 0) return <p className={cx(S.empty, className)}>(본문 없음)</p>
  return (
    <StylesContext.Provider value={styles}>
      <RenderContext.Provider value={ctx}>
        <BlockList blocks={blocks} className={cx(S.root, className)} />
      </RenderContext.Provider>
    </StylesContext.Provider>
  )
}
