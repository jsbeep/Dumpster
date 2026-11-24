import { BlockRenderer } from '@dumpster/blocks'
import { kitchenSink } from '@dumpster/blocks/samples'
import type { Block } from '@dumpster/schema'
import { Columns2, Moon, RectangleVertical, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// 블록 갤러리 — kitchenSink를 최상위 블록 타입별로 묶어 보여주는 시각 회귀 화면.
// 쿼리: ?theme=dark(다크로 시작) ?width=wide(넓게) ?only=code,table(그 타입만 — 스크린샷을 나눠 찍을 때)

type Theme = 'light' | 'dark'
type Width = 'narrow' | 'wide'

// 좁게 = 밀러 컬럼 안 읽기 칸, 넓게 = 노션 기본 페이지 폭쯤
const WIDTH: Record<Width, string> = { narrow: 'max-w-[38rem]', wide: 'max-w-[52rem]' }

function groupByType(blocks: Block[]): [Block['type'], Block[]][] {
  const groups = new Map<Block['type'], Block[]>()
  for (const block of blocks) {
    const list = groups.get(block.type) ?? []
    list.push(block)
    groups.set(block.type, list)
  }
  return [...groups]
}

function setQuery(key: string, value: string | null) {
  const url = new URL(location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  history.replaceState(null, '', url)
}

const query = new URLSearchParams(location.search)
const only = query.get('only')?.split(',') ?? null
const sections = groupByType(kitchenSink).filter(([type]) => !only || only.includes(type))

export function App() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  const [width, setWidth] = useState<Width>(() => (query.get('width') === 'wide' ? 'wide' : 'narrow'))
  const [opened, setOpened] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    setQuery('theme', theme === 'dark' ? 'dark' : null)
  }, [theme])
  useEffect(() => setQuery('width', width === 'wide' ? 'wide' : null), [width])
  useEffect(() => () => clearTimeout(timer.current), [])

  const onOpenDoc = (docId: string, heading?: string) => {
    setOpened(`onOpenDoc(${JSON.stringify(docId)}${heading ? `, ${JSON.stringify(heading)}` : ''})`)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpened(null), 2500)
  }

  const button =
    'inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-600 transition-colors hover:bg-slate-50'

  return (
    <div className="min-h-screen font-sans text-slate-700">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-page">
        <div className="mx-auto flex max-w-[52rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <h1 className="text-sm font-semibold text-slate-900">블록 갤러리</h1>
          <nav className="flex min-w-0 flex-1 flex-wrap gap-1">
            {sections.map(([type]) => (
              <a key={type} href={`#b-${type}`} className="rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-500 hover:bg-slate-100">
                {type}
              </a>
            ))}
          </nav>
          <button type="button" className={button} onClick={() => setWidth(width === 'narrow' ? 'wide' : 'narrow')}>
            {width === 'narrow' ? <RectangleVertical size={14} /> : <Columns2 size={14} />}
            {width === 'narrow' ? '좁게' : '넓게'}
          </button>
          <button type="button" className={button} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'light' ? '라이트' : '다크'}
          </button>
        </div>
      </header>

      <main className={`mx-auto flex flex-col gap-12 px-4 py-8 ${WIDTH[width]}`}>
        {sections.map(([type, blocks]) => (
          <section key={type} id={`b-${type}`} className="scroll-mt-16">
            <h2 className="mb-4 flex items-baseline gap-2 border-b border-dashed border-slate-200 pb-1.5 font-mono text-xs text-slate-400">
              <span className="font-semibold text-slate-500">{type}</span>
              <span>×{blocks.length}</span>
            </h2>
            {/* 검수 화면이라 그림을 미루지 않는다 — 헤드리스 스크린샷에도 다 찍히게 */}
            <BlockRenderer blocks={blocks} onOpenDoc={onOpenDoc} imageLoading="eager" />
          </section>
        ))}
      </main>

      {opened && (
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-1.5 font-mono text-xs text-white shadow-lg">
          {opened}
        </div>
      )}
    </div>
  )
}
