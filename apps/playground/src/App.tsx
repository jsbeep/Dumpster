import { DEFAULT_STYLES, type BlockStyles } from '@dumpster/blocks'
import { DEFAULT_FENCES, type FenceRules } from '@dumpster/markdown'
import { Columns2, Moon, RectangleVertical, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FenceEditor, countFenceChanges } from './tabs/FenceEditor'
import { Gallery } from './tabs/Gallery'
import { Live } from './tabs/Live'
import { StyleEditor, countChanged, leaves } from './tabs/StyleEditor'
import { Badge, BTN, CAN_SAVE, Tabs } from './ui'

// 플레이그라운드 (개발 전용) — 블록 갤러리 · 라이브 md→블록 · 스타일 편집 · 펜스 매핑 편집.
// 쿼리: ?tab=live|style|fence  ?theme=dark  ?width=wide  ?only=code,table(갤러리)  ?note=<볼트 경로>(라이브)  ?section=<키>(스타일)
// 스타일·펜스 초안은 여기서 들고 있다가 모든 탭 미리보기에 같이 쓴다 (저장 전에도 갤러리·라이브에 바로 보인다)

type Tab = 'gallery' | 'live' | 'style' | 'fence'
type Theme = 'light' | 'dark'
type Width = 'narrow' | 'wide'

// 좁게 = 밀러 컬럼 안 읽기 칸, 넓게 = 노션 기본 페이지 폭쯤
const WIDTH: Record<Width, string> = { narrow: 'max-w-[38rem]', wide: 'max-w-[52rem]' }
const TABS: Tab[] = ['gallery', 'live', 'style', 'fence']

function setQuery(key: string, value: string | null) {
  const url = new URL(location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  history.replaceState(null, '', url)
}

const query = new URLSearchParams(location.search)

export function App() {
  const [tab, setTab] = useState<Tab>(() => (TABS as string[]).includes(query.get('tab') ?? '') ? (query.get('tab') as Tab) : 'gallery')
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  const [width, setWidth] = useState<Width>(() => (query.get('width') === 'wide' ? 'wide' : 'narrow'))
  const [section, setSection] = useState(() => query.get('section') ?? 'renderer')
  const [styles, setStyles] = useState<BlockStyles>(DEFAULT_STYLES)
  const [savedStyles, setSavedStyles] = useState<BlockStyles>(DEFAULT_STYLES)
  const [fences, setFences] = useState<FenceRules>(DEFAULT_FENCES)
  const [savedFences, setSavedFences] = useState<FenceRules>(DEFAULT_FENCES)
  const [toastText, setToastText] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    setQuery('theme', theme === 'dark' ? 'dark' : null)
  }, [theme])
  useEffect(() => setQuery('width', width === 'wide' ? 'wide' : null), [width])
  useEffect(() => setQuery('tab', tab === 'gallery' ? null : tab), [tab])
  useEffect(() => setQuery('section', tab === 'style' && section !== 'renderer' ? section : null), [tab, section])
  useEffect(() => () => clearTimeout(timer.current), [])

  // 초안의 클래스를 dev 서버에 알린다 → .draft/classes.txt → Tailwind가 처음 보는 클래스도 CSS로 만든다
  const sentClasses = useRef('')
  useEffect(() => {
    if (!CAN_SAVE) return
    const id = setTimeout(() => {
      const text = leaves(styles as never)
        .map(([, v]) => v)
        .join('\n')
      if (text === sentClasses.current) return
      sentClasses.current = text
      fetch('/__dumpster/draft-classes', { method: 'PUT', body: text }).catch(() => {})
    }, 250)
    return () => clearTimeout(id)
  }, [styles])

  const toast = useCallback((msg: string) => {
    setToastText(msg)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToastText(null), 2500)
  }, [])
  const onOpenDoc = useCallback(
    (docId: string, heading?: string) => toast(`onOpenDoc(${JSON.stringify(docId)}${heading ? `, ${JSON.stringify(heading)}` : ''})`),
    [toast],
  )

  const styleDirty = countChanged(styles, savedStyles)
  const fenceDirty = countFenceChanges(fences, savedFences)
  const widthClass = WIDTH[width]

  return (
    <div className="min-h-screen font-sans text-slate-700">
      <header className="sticky top-0 z-20 h-12 border-b border-slate-200 bg-page">
        <div className="flex h-full items-center gap-3 px-4">
          <h1 className="hidden text-sm font-semibold text-slate-900 sm:block">플레이그라운드</h1>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'gallery', label: '갤러리' },
              { id: 'live', label: '라이브' },
              { id: 'style', label: <>스타일{styleDirty > 0 && <Badge tone="amber">{styleDirty}</Badge>}</> },
              { id: 'fence', label: <>펜스{fenceDirty > 0 && <Badge tone="amber">{fenceDirty}</Badge>}</> },
            ]}
          />
          <span className="flex-1" />
          <button type="button" className={BTN} onClick={() => setWidth(width === 'narrow' ? 'wide' : 'narrow')} title="미리보기 폭">
            {width === 'narrow' ? <RectangleVertical size={14} /> : <Columns2 size={14} />}
            <span className="hidden sm:inline">{width === 'narrow' ? '좁게' : '넓게'}</span>
          </button>
          <button type="button" className={BTN} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
            <span className="hidden sm:inline">{theme === 'light' ? '라이트' : '다크'}</span>
          </button>
        </div>
      </header>

      <main>
        {tab === 'gallery' && <Gallery styles={styles} onOpenDoc={onOpenDoc} widthClass={widthClass} />}
        {tab === 'live' && <Live styles={styles} fences={fences} widthClass={widthClass} toast={toast} />}
        {tab === 'style' && (
          <StyleEditor
            draft={styles}
            saved={savedStyles}
            section={section}
            onSection={setSection}
            onDraft={setStyles}
            onSaved={setSavedStyles}
            onOpenDoc={onOpenDoc}
            widthClass={widthClass}
          />
        )}
        {tab === 'fence' && (
          <FenceEditor
            draft={fences}
            saved={savedFences}
            onDraft={setFences}
            onSaved={setSavedFences}
            styles={styles}
            onOpenDoc={onOpenDoc}
            widthClass={widthClass}
          />
        )}
      </main>

      {toastText && (
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-1.5 font-mono text-xs text-white shadow-lg">
          {toastText}
        </div>
      )}
    </div>
  )
}
