import type { ListItem } from '@dumpster/schema'
import { Check } from 'lucide-react'
import { createContext, useContext } from 'react'
import { BlockView } from '../BlockRenderer'
import type { BlockOf } from '../context'
import { useStyles } from '../styles'
import { cx } from '../cx'
import { Inlines } from '../inline'

const ListDepth = createContext(0)

// 스타일 메모 (styles.json "list"):
// - task·checkWrap: 체크박스는 표식 자리(왼쪽 여백)에 놓는다
// - done: 끝난 항목은 코드 글자까지 흐리게
function Item({ item }: { item: ListItem }) {
  const S = useStyles().list
  const task = item.checked !== undefined
  return (
    <li className={cx(S.item, task && S.task)}>
      {task && (
        <span className={S.checkWrap}>
          <input type="checkbox" checked={item.checked} disabled readOnly className={S.checkbox} />
          {item.checked && <Check className={S.checkMark} strokeWidth={3.5} aria-hidden />}
        </span>
      )}
      {item.checked ? (
        <span className={S.done}>
          <Inlines inlines={item.inlines} />
        </span>
      ) : (
        <Inlines inlines={item.inlines} />
      )}
      {item.children.length > 0 && (
        <div className={S.children}>
          {item.children.map((child, i) => (
            <BlockView key={i} block={child} />
          ))}
        </div>
      )}
    </li>
  )
}

// 표식은 단계마다 바꾼다(노션식 • ◦ ▪ / 1. a. i.) — 4단을 넘으면 처음으로 (unordered·ordered 배열)
export function ListView({ block }: { block: BlockOf<'list'> }) {
  const S = useStyles().list
  const depth = useContext(ListDepth)
  const marker = (block.ordered ? S.ordered : S.unordered)[depth % 4]
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <ListDepth.Provider value={depth + 1}>
      <Tag start={block.ordered ? block.start : undefined} className={cx(S.list, marker)}>
        {block.items.map((item, i) => (
          <Item key={i} item={item} />
        ))}
      </Tag>
    </ListDepth.Provider>
  )
}
