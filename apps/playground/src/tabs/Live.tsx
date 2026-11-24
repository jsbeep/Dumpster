import { BlockRenderer, type BlockStyles } from '@dumpster/blocks'
import { parseMarkdown, type FenceRules } from '@dumpster/markdown'
import { RotateCcw } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, BTN, LABEL, Tabs } from '../ui'
import { NOTES, noteByPath, splitFrontmatter, vaultContext } from '../vault'

// 라이브 — 마크다운 ↔ 블록. 파서를 고칠 때의 작업대: 짜가 볼트 노트를 고르거나 실제 노트를 붙여 넣고,
// 미리보기·Block JSON·경고·refs를 같이 본다. 문서 링크를 누르면 그 노트를 연다.
// 펜스 매핑·스타일은 저장 전 초안이 바로 반영된다.

const STORE = 'dumpster.playground.live'
const DEFAULT_NOTE = '블록 견본/함정 모음.md'
const LINE_PX = 20 // 편집기 leading-5

interface Saved {
  note: string | null
  text: string
}

function load(): Saved {
  const fromQuery = new URLSearchParams(location.search).get('note')
  if (fromQuery !== null) {
    const note = noteByPath(fromQuery)
    return { note: note?.path ?? null, text: note?.raw ?? '' }
  }
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null
    if (s && typeof s.text === 'string') return s
  } catch {
    // 저장소가 막혀도 기본 노트로
  }
  return { note: DEFAULT_NOTE, text: noteByPath(DEFAULT_NOTE)?.raw ?? '' }
}

const folders = [...new Set(NOTES.map((n) => n.folder))]

export function Live({ styles, fences, widthClass, toast }: { styles: BlockStyles; fences: FenceRules; widthClass: string; toast: (msg: string) => void }) {
  const [state, setState] = useState<Saved>(load)
  const [view, setView] = useState<'preview' | 'json'>('preview')
  const editor = useRef<HTMLTextAreaElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const note = noteByPath(state.note)

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(state))
    } catch {
      // 다음에 기본 노트로 시작할 뿐
    }
  }, [state])

  const text = useDeferredValue(state.text)
  const result = useMemo(() => {
    const { body } = splitFrontmatter(text)
    const lineOffset = text.split('\n').length - body.split('\n').length
    const started = performance.now()
    const parsed = parseMarkdown(body, { ...vaultContext(note), lineOffset, fences })
    return { ...parsed, ms: performance.now() - started }
  }, [text, note, fences])

  const openNote = useCallback((path: string | null) => setState({ note: path, text: noteByPath(path)?.raw ?? '' }), [])

  const onOpenDoc = useCallback(
    (docId: string, heading?: string) => {
      if (docId !== state.note) {
        if (!noteByPath(docId)) return toast(`onOpenDoc(${JSON.stringify(docId)})`)
        openNote(docId)
      }
      if (heading) setTimeout(() => preview.current?.querySelector(`[id="${CSS.escape(heading)}"]`)?.scrollIntoView({ block: 'start' }), 50)
    },
    [state.note, openNote, toast],
  )

  // "N번째 줄 …" 경고 → 편집기에서 그 줄 선택
  const jumpToLine = (line: number) => {
    const ta = editor.current
    if (!ta) return
    const lines = state.text.split('\n')
    const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0)
    ta.focus()
    ta.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0))
    ta.scrollTop = Math.max(0, (line - 1) * LINE_PX - ta.clientHeight / 3)
  }

  const edited = note !== null && state.text !== note.raw

  return (
    <div className="grid h-[calc(100dvh-3rem)] grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
      <section className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
          <select
            value={state.note ?? ''}
            onChange={(e) => openNote(e.target.value || null)}
            className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
          >
            <option value="">(직접 입력)</option>
            {folders.map((folder) => (
              <optgroup key={folder} label={folder || '(볼트 맨 위)'}>
                {NOTES.filter((n) => n.folder === folder).map((n) => (
                  <option key={n.path} value={n.path}>
                    {n.title}
                    {n.public ? '' : ' (비공개 폴더)'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {edited && (
            <button type="button" className={BTN} onClick={() => openNote(state.note)} title="노트 원문으로">
              <RotateCcw size={13} />
              원문으로
            </button>
          )}
        </div>
        <textarea
          ref={editor}
          value={state.text}
          onChange={(e) => setState((s) => ({ ...s, text: e.target.value }))}
          onKeyDown={(e) => {
            // 옵시디언 리스트 들여쓰기가 탭이라 Tab은 탭 글자로
            if (e.key !== 'Tab' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
            e.preventDefault()
            const ta = e.currentTarget
            const { selectionStart: a, selectionEnd: b } = ta
            setState((s) => ({ ...s, text: s.text.slice(0, a) + '\t' + s.text.slice(b) }))
            requestAnimationFrame(() => ta.setSelectionRange(a + 1, a + 1))
          }}
          spellCheck={false}
          placeholder="옵시디언 노트를 붙여 넣으세요 (frontmatter 포함 가능)"
          className="min-h-0 flex-1 resize-none bg-white px-4 py-3 font-mono text-[13px] leading-5 text-slate-800 outline-none [tab-size:4]"
        />
        <Diagnostics warnings={result.warnings} refs={result.refs} onLine={jumpToLine} onOpen={onOpenDoc} />
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
          <Tabs
            value={view}
            onChange={setView}
            items={[
              { id: 'preview', label: '미리보기' },
              { id: 'json', label: 'Block JSON' },
            ]}
          />
          <span className="flex-1" />
          <span className={LABEL}>
            블록 {result.blocks.length} · {result.ms.toFixed(1)}ms
          </span>
        </div>
        <div ref={preview} className="min-h-0 flex-1 overflow-auto">
          {view === 'preview' ? (
            <div className={`mx-auto px-6 py-6 ${widthClass}`}>
              <BlockRenderer blocks={result.blocks} styles={styles} onOpenDoc={onOpenDoc} imageLoading="eager" />
            </div>
          ) : (
            <pre className="px-4 py-3 font-mono text-[12px] leading-[1.55] text-slate-700">{JSON.stringify(result.blocks, null, 2)}</pre>
          )}
        </div>
      </section>
    </div>
  )
}

function Diagnostics({
  warnings,
  refs,
  onLine,
  onOpen,
}: {
  warnings: string[]
  refs: ReturnType<typeof parseMarkdown>['refs']
  onLine: (line: number) => void
  onOpen: (docId: string) => void
}) {
  return (
    <div className="max-h-[38%] shrink-0 overflow-auto border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-600">
        경고 <Badge tone={warnings.length ? 'amber' : 'slate'}>{warnings.length}</Badge>
      </p>
      {warnings.length === 0 && <p className="text-slate-400">없음</p>}
      <ul className="space-y-0.5">
        {warnings.map((w) => {
          const line = /^(\d+)번째 줄/.exec(w)
          return (
            <li key={w} className="text-amber-800">
              {line ? (
                <button type="button" className="text-left underline decoration-amber-300 underline-offset-2 hover:decoration-amber-600" onClick={() => onLine(Number(line[1]))}>
                  {w}
                </button>
              ) : (
                w
              )}
            </li>
          )
        })}
      </ul>
      <p className="mb-1 mt-2.5 flex items-center gap-1.5 font-medium text-slate-600">
        refs <Badge>{refs.length}</Badge>
      </p>
      {refs.length === 0 && <p className="text-slate-400">없음</p>}
      <ul className="space-y-0.5 font-mono text-[11px]">
        {refs.map((r) => (
          <li key={`${r.relation}:${r.label}`} className="flex flex-wrap gap-x-1.5 text-slate-600">
            <span className="text-slate-400">{r.relation === 'embed' ? '![[ ]]' : '[[ ]]'}</span>
            <span>{r.label}</span>
            <span className="text-slate-400">→</span>
            {r.target ? (
              <button type="button" className="text-emerald-700 hover:underline" onClick={() => onOpen(r.target!)}>
                {r.target}
              </button>
            ) : (
              <span className="text-slate-400">null (없음·비공개)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
