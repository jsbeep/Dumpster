import type { ListItem } from '@dumpster/schema'
import { Check } from 'lucide-react'
import { createContext, useContext } from 'react'
import { BlockView } from '../BlockRenderer'
import type { BlockOf } from '../context'
import { cx } from '../cx'
import { Inlines } from '../inline'

// 표식은 단계마다 바꾼다(노션식 • ◦ ▪ / 1. a. i.) — 4단을 넘으면 처음으로 돌아간다
export const STYLE = {
  list: 'space-y-1 pl-[1.5em] marker:text-slate-400',
  unordered: ['list-disc', 'list-[circle]', 'list-[square]', 'list-disc'],
  ordered: ['list-decimal', 'list-[lower-alpha]', 'list-[lower-roman]', 'list-decimal'],
  item: 'pl-[0.2em]',
  // 체크박스는 표식 자리(왼쪽 여백)에 놓는다
  task: 'relative list-none',
  checkWrap: 'absolute -left-[1.5em] top-[0.35em] inline-flex h-[1em] w-[1em]',
  checkbox:
    'peer m-0 h-full w-full cursor-default appearance-none rounded-[4px] border-[1.5px] border-slate-300 bg-white checked:border-emerald-600 checked:bg-emerald-600',
  checkMark: 'pointer-events-none absolute inset-0 m-auto h-[0.72em] w-[0.72em] text-white',
  // 끝난 항목은 코드 글자까지 흐리게
  done: 'text-slate-400 line-through decoration-slate-300 [&_code]:text-inherit',
  children: 'mt-1 flex min-w-0 flex-col gap-1',
}

const ListDepth = createContext(0)

function Item({ item }: { item: ListItem }) {
  const task = item.checked !== undefined
  return (
    <li className={cx(STYLE.item, task && STYLE.task)}>
      {task && (
        <span className={STYLE.checkWrap}>
          <input type="checkbox" checked={item.checked} disabled readOnly className={STYLE.checkbox} />
          {item.checked && <Check className={STYLE.checkMark} strokeWidth={3.5} aria-hidden />}
        </span>
      )}
      {item.checked ? (
        <span className={STYLE.done}>
          <Inlines inlines={item.inlines} />
        </span>
      ) : (
        <Inlines inlines={item.inlines} />
      )}
      {item.children.length > 0 && (
        <div className={STYLE.children}>
          {item.children.map((child, i) => (
            <BlockView key={i} block={child} />
          ))}
        </div>
      )}
    </li>
  )
}

export function ListView({ block }: { block: BlockOf<'list'> }) {
  const depth = useContext(ListDepth)
  const marker = (block.ordered ? STYLE.ordered : STYLE.unordered)[depth % 4]
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <ListDepth.Provider value={depth + 1}>
      <Tag start={block.ordered ? block.start : undefined} className={cx(STYLE.list, marker)}>
        {block.items.map((item, i) => (
          <Item key={i} item={item} />
        ))}
      </Tag>
    </ListDepth.Provider>
  )
}
