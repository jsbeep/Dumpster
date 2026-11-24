import type { Block } from '@dumpster/schema'
import { useMemo, type ComponentType } from 'react'
import { RenderContext, type BlockOf, type OpenDoc } from './context'
import { cx } from './cx'
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

// 글자 크기·줄간격은 여기 한 곳 — 블록들은 em 단위라 탐색기가 root만 바꿔도 같이 줄고 는다
// 한국어는 어절 단위로 줄바꿈(break-keep), 끊을 곳 없는 긴 주소는 break-words가 받는다
export const RENDERER_STYLE = {
  root: 'dumpster-blocks flex min-w-0 flex-col gap-3 break-words break-keep font-sans text-base leading-[1.7] text-slate-700',
  // 리스트·인용·콜아웃 안쪽 블록 묶음
  stack: 'flex min-w-0 flex-col gap-2',
  empty: 'text-sm text-slate-400',
}

const S = RENDERER_STYLE

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

export function BlockList({ blocks, className = S.stack }: { blocks: Block[]; className?: string }) {
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
}

export function BlockRenderer({ blocks, onOpenDoc, imageLoading, className }: BlockRendererProps) {
  const ctx = useMemo(() => ({ onOpenDoc, imageLoading }), [onOpenDoc, imageLoading])
  if (blocks.length === 0) return <p className={cx(S.empty, className)}>(본문 없음)</p>
  return (
    <RenderContext.Provider value={ctx}>
      <BlockList blocks={blocks} className={cx(S.root, className)} />
    </RenderContext.Provider>
  )
}
