import type { Inline, TableAlign } from '@dumpster/schema'
import type { BlockOf } from '../context'
import { cx, SCROLL_X } from '../cx'
import { Inlines } from '../inline'

// 셀 안 '\n'(옵시디언 표의 <br>)은 pre-wrap으로 보존. 넓은 표는 상자 안에서만 가로 스크롤
export const STYLE = {
  wrap: cx(SCROLL_X, 'min-w-0 rounded-lg border border-slate-200'),
  table: 'min-w-full border-collapse text-[0.9375em] leading-[1.6]',
  th: 'min-w-[5em] whitespace-pre-wrap border-b border-r border-slate-200 bg-slate-500/[0.05] px-3 py-2 align-bottom font-semibold text-slate-800 last:border-r-0',
  td: 'min-w-[5em] whitespace-pre-wrap border-b border-r border-slate-200 px-3 py-2 align-top last:border-r-0',
  // 마지막 줄 아래 테두리는 상자 테두리와 겹치므로 뺀다
  row: '[&:last-child>td]:border-b-0',
  align: { left: 'text-left', center: 'text-center', right: 'text-right' },
}

function alignOf(align: TableAlign | undefined) {
  return align ? STYLE.align[align] : 'text-left'
}

function Cells({ cells, align, Tag }: { cells: Inline[][]; align: TableAlign[]; Tag: 'th' | 'td' }) {
  return (
    <>
      {cells.map((cell, i) => (
        <Tag key={i} className={cx(Tag === 'th' ? STYLE.th : STYLE.td, alignOf(align[i]))}>
          <Inlines inlines={cell} />
        </Tag>
      ))}
    </>
  )
}

export function TableView({ block }: { block: BlockOf<'table'> }) {
  return (
    <div className={STYLE.wrap}>
      <table className={STYLE.table}>
        <thead>
          <tr>
            <Cells cells={block.header} align={block.align} Tag="th" />
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className={STYLE.row}>
              <Cells cells={row} align={block.align} Tag="td" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
