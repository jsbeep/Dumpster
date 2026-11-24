import type { Inline, TableAlign } from '@dumpster/schema'
import type { BlockOf } from '../context'
import { useStyles, type BlockStyles } from '../styles'
import { cx } from '../cx'
import { Inlines } from '../inline'

// 셀 안 '\n'(옵시디언 표의 <br>)은 pre-wrap으로 보존. 넓은 표는 상자 안에서만 가로 스크롤
function alignOf(S: BlockStyles['table'], align: TableAlign | undefined) {
  return align ? S.align[align] : 'text-left'
}

function Cells({ cells, align, Tag }: { cells: Inline[][]; align: TableAlign[]; Tag: 'th' | 'td' }) {
  const S = useStyles().table
  return (
    <>
      {cells.map((cell, i) => (
        <Tag key={i} className={cx(Tag === 'th' ? S.th : S.td, alignOf(S, align[i]))}>
          <Inlines inlines={cell} />
        </Tag>
      ))}
    </>
  )
}

// 스타일 메모: row — 마지막 줄 아래 테두리는 상자 테두리와 겹치므로 뺀다
export function TableView({ block }: { block: BlockOf<'table'> }) {
  const S = useStyles().table
  return (
    <div className={S.wrap}>
      <table className={S.table}>
        <thead>
          <tr>
            <Cells cells={block.header} align={block.align} Tag="th" />
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className={S.row}>
              <Cells cells={row} align={block.align} Tag="td" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
