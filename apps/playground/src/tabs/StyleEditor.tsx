import { BlockRenderer, type BlockStyles, type OpenDoc } from '@dumpster/blocks'
import { kitchenSink } from '@dumpster/blocks/samples'
import type { Block } from '@dumpster/schema'
import { Undo2 } from 'lucide-react'
import { Badge, LABEL, SaveBar, saveJson } from '../ui'

// 스타일 편집 — packages/blocks/src/styles.json의 클래스 글자를 고치고 저장한다.
// 저장 전 초안은 BlockRenderer styles로 바로 그려지고, 처음 쓰는 클래스는 dev 서버가 .draft에 적어 Tailwind가 CSS를 만든다.
// 키는 View 코드가 쓰는 자리라 여기선 값만 바꾼다 (키를 늘리려면 View를 고친다).

export type Path = (string | number)[]
type Tree = string | Tree[] | { [key: string]: Tree }

export function leaves(node: Tree, path: Path = []): [Path, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (Array.isArray(node)) return node.flatMap((child, i) => leaves(child, [...path, i]))
  return Object.entries(node).flatMap(([key, child]) => leaves(child, [...path, key]))
}

function getIn(node: Tree, path: Path): Tree | undefined {
  let cur: Tree | undefined = node
  for (const key of path) cur = cur === undefined || typeof cur === 'string' ? undefined : (cur as Record<string, Tree>)[key as string]
  return cur
}

function setIn<T extends Tree>(node: T, path: Path, value: string): T {
  if (!path.length) return value as T
  const [key, ...rest] = path
  if (Array.isArray(node)) return node.map((child, i) => (i === key ? setIn(child, rest, value) : child)) as T
  const obj = node as Record<string, Tree>
  return { ...obj, [key]: setIn(obj[key as string], rest, value) } as T
}

export function countChanged(a: BlockStyles, b: BlockStyles): number {
  return leaves(a as unknown as Tree).filter(([path, v]) => getIn(b as unknown as Tree, path) !== v).length
}

// 섹션별 미리보기 견본
function samplesFor(section: string): Block[] {
  if (section === 'renderer') return kitchenSink
  if (section === 'inline') return kitchenSink.filter((b) => b.type === 'paragraph' || b.type === 'table')
  return kitchenSink.filter((b) => b.type === section)
}

export function StyleEditor({
  draft,
  saved,
  section,
  onSection,
  onDraft,
  onSaved,
  onOpenDoc,
  widthClass,
}: {
  draft: BlockStyles
  saved: BlockStyles
  section: string
  onSection: (s: string) => void
  onDraft: (s: BlockStyles) => void
  onSaved: (s: BlockStyles) => void
  onOpenDoc: OpenDoc
  widthClass: string
}) {
  const tree = draft as unknown as Tree
  const savedTree = saved as unknown as Tree
  const sections = Object.keys(draft)
  const current = sections.includes(section) ? section : sections[0]
  const fields = leaves(getIn(tree, [current])!, [current])
  const dirty = countChanged(draft, saved)

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      <SaveBar
        file="packages/blocks/src/styles.json"
        dirty={dirty}
        error={null}
        onReset={() => onDraft(saved)}
        onSave={async () => {
          const r = await saveJson('styles', draft)
          if (r.ok) onSaved(draft)
          return r
        }}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:grid-rows-1">
        <section className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
          <nav className="flex flex-wrap gap-1 border-b border-slate-200 px-3 py-2">
            {sections.map((s) => {
              const n = leaves(getIn(tree, [s])!, [s]).filter(([p, v]) => getIn(savedTree, p) !== v).length
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSection(s)}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] ${
                    s === current ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {s}
                  {n > 0 && <Badge tone="amber">{n}</Badge>}
                </button>
              )
            })}
          </nav>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3">
            {fields.map(([path, value]) => {
              const original = getIn(savedTree, path) as string
              const changed = original !== value
              const key = path.slice(1).join('.')
              return (
                <label key={key} className="block">
                  <span className="mb-1 flex items-center gap-1.5">
                    <span className={`${LABEL} ${changed ? 'font-semibold text-amber-700' : ''}`}>{key}</span>
                    {changed && (
                      <button
                        type="button"
                        title={`저장된 값: ${original}`}
                        onClick={(e) => {
                          e.preventDefault()
                          onDraft(setIn(tree, path, original) as unknown as BlockStyles)
                        }}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <Undo2 size={12} />
                      </button>
                    )}
                  </span>
                  <textarea
                    value={value}
                    spellCheck={false}
                    rows={Math.max(1, Math.ceil(value.length / 52))}
                    onChange={(e) => onDraft(setIn(tree, path, e.target.value.replace(/\s*\n\s*/g, ' ')) as unknown as BlockStyles)}
                    className={`w-full resize-none rounded-md border bg-white px-2 py-1.5 font-mono text-[12px] leading-[1.45] text-slate-800 outline-none focus:border-emerald-500 ${
                      changed ? 'border-amber-400' : 'border-slate-200'
                    }`}
                  />
                </label>
              )
            })}
          </div>
        </section>
        <section className="min-h-0 overflow-auto">
          <div className={`mx-auto px-6 py-6 ${widthClass}`}>
            <p className={`${LABEL} mb-4`}>미리보기 — {current === 'renderer' ? '견본 전체' : current === 'inline' ? '문단·표 견본' : `${current} 견본`}</p>
            <BlockRenderer blocks={samplesFor(current)} styles={draft} onOpenDoc={onOpenDoc} imageLoading="eager" />
          </div>
        </section>
      </div>
    </div>
  )
}
