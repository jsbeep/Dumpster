// 본문 블록 계약 — 마크다운 파서(P2)가 만들고 렌더러(P3)가 그린다.
// 매핑 근거는 docs/design.md §4. 플래그는 true일 때만 넣어서 JSON을 작게 유지한다(레거시는 매 글자 조각마다 false 4개).

export type InlineLink =
  | { kind: 'url'; href: string }
  | { kind: 'doc'; docId: string | null; heading?: string } // docId null = 없는/비공개 문서 → 회색 글자

export interface Inline {
  text: string
  bold?: true
  italic?: true
  code?: true
  strike?: true
  highlight?: true
  link?: InlineLink
}

export interface ListItem {
  inlines: Inline[]
  checked?: boolean // - [ ] / - [x]
  children: Block[] // 들여쓰기로 딸린 하위 블록
}

export type TableAlign = 'left' | 'center' | 'right' | null

export type CalloutFold = 'none' | 'open' | 'closed' // [!x] / [!x]+ / [!x]-

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; anchor: string; inlines: Inline[] }
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'list'; ordered: boolean; start?: number; items: ListItem[] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'callout'; kind: string; title: Inline[]; fold: CalloutFold; children: Block[] }
  | { type: 'code'; language: string | null; text: string }
  | { type: 'table'; align: TableAlign[]; header: Inline[][]; rows: Inline[][][] }
  | { type: 'hr' }
  | { type: 'image'; src: string; alt: string; width: number | null; height: number | null }
  | { type: 'bookmark'; href: string; title: string; description: string; icon: string | null; image: string | null }
  | { type: 'embed'; docId: string | null; label: string } // ![[문서]] 트랜스클루전
  | { type: 'unsupported'; raw: string; reason: string } // 수식·각주 등 아직 못 그리는 것 — 원문 그대로 보여준다

export function inlinesToText(inlines: Inline[]): string {
  return inlines.map((i) => i.text).join('')
}

export function blockToText(block: Block): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return inlinesToText(block.inlines)
    case 'list':
      return block.items
        .map((item) => [inlinesToText(item.inlines), ...item.children.map(blockToText)].filter(Boolean).join('\n'))
        .join('\n')
    case 'blockquote':
      return blocksToText(block.children)
    case 'callout':
      return [inlinesToText(block.title), blocksToText(block.children)].filter(Boolean).join('\n')
    case 'code':
      return block.text
    case 'table':
      return [block.header, ...block.rows].map((row) => row.map(inlinesToText).join(' | ')).join('\n')
    case 'image':
      return block.alt
    case 'bookmark':
      return block.title
    case 'embed':
      return block.label
    case 'unsupported':
      return block.raw
    case 'hr':
      return ''
  }
}

export function blocksToText(blocks: Block[]): string {
  return blocks
    .map(blockToText)
    .filter((t) => t.trim() !== '')
    .join('\n')
    .trim()
}
