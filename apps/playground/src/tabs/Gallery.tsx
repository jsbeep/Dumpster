import { BlockRenderer, type BlockStyles, type OpenDoc } from '@dumpster/blocks'
import { kitchenSink } from '@dumpster/blocks/samples'
import type { Block } from '@dumpster/schema'

// 블록 갤러리 — kitchenSink를 최상위 블록 타입별로 묶어 보여주는 시각 회귀 화면.
// ?only=code,table (그 타입만 — 스크린샷을 나눠 찍을 때)

export function groupByType(blocks: Block[]): [Block['type'], Block[]][] {
  const groups = new Map<Block['type'], Block[]>()
  for (const block of blocks) {
    const list = groups.get(block.type) ?? []
    list.push(block)
    groups.set(block.type, list)
  }
  return [...groups]
}

const only = new URLSearchParams(location.search).get('only')?.split(',') ?? null
const sections = groupByType(kitchenSink).filter(([type]) => !only || only.includes(type))

export function Gallery({ styles, onOpenDoc, widthClass }: { styles: BlockStyles; onOpenDoc: OpenDoc; widthClass: string }) {
  return (
    <div className={`mx-auto px-4 py-6 ${widthClass}`}>
      <nav className="mb-8 flex flex-wrap gap-1">
        {sections.map(([type]) => (
          <a key={type} href={`#b-${type}`} className="rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-500 hover:bg-slate-100">
            {type}
          </a>
        ))}
      </nav>
      <div className="flex flex-col gap-12">
        {sections.map(([type, blocks]) => (
          <section key={type} id={`b-${type}`} className="scroll-mt-16">
            <h2 className="mb-4 flex items-baseline gap-2 border-b border-dashed border-slate-200 pb-1.5 font-mono text-xs text-slate-400">
              <span className="font-semibold text-slate-500">{type}</span>
              <span>×{blocks.length}</span>
            </h2>
            {/* 검수 화면이라 그림을 미루지 않는다 — 헤드리스 스크린샷에도 다 찍히게 */}
            <BlockRenderer blocks={blocks} onOpenDoc={onOpenDoc} imageLoading="eager" styles={styles} />
          </section>
        ))}
      </div>
    </div>
  )
}
