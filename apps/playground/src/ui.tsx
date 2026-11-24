import { Check, Copy, RotateCcw, Save } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

// 플레이그라운드 화면 부품. 색은 블록 프리셋 그대로 — white·slate가 다크에서 알아서 뒤집힌다

export const BTN =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
export const BTN_PRIMARY =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40'
export const INPUT =
  'w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-800 outline-none focus:border-emerald-500'
export const LABEL = 'font-mono text-[11px] text-slate-400'

export const CAN_SAVE = import.meta.env.DEV

type SaveResult = { ok: true } | { ok: false; error: string }

// dev 서버 엔드포인트(devApi.ts)로 JSON 저장
export async function saveJson(name: 'styles' | 'fences', data: unknown): Promise<SaveResult> {
  try {
    const res = await fetch(`/__dumpster/${name}`, { method: 'PUT', body: JSON.stringify(data) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return res.ok ? { ok: true } : { ok: false, error: body.error ?? `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-md bg-slate-100 p-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs transition-colors ${
            value === item.id ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'amber' | 'emerald' }) {
  const color = { slate: 'bg-slate-200 text-slate-600', amber: 'bg-amber-100 text-amber-800', emerald: 'bg-emerald-100 text-emerald-800' }[tone]
  return <span className={`inline-flex min-w-[1.25rem] justify-center rounded px-1 font-mono text-[10px] leading-4 ${color}`}>{children}</span>
}

export function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      className={BTN}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          return
        }
        setDone(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setDone(false), 1200)
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {label}
    </button>
  )
}

// 스타일·펜스 탭 위쪽 줄: 바뀐 개수 · 검사 오류 · 되돌리기 · 저장
export function SaveBar({
  file,
  dirty,
  error,
  onReset,
  onSave,
}: {
  file: string
  dirty: number
  error: string | null
  onReset: () => void
  onSave: () => Promise<SaveResult>
}) {
  const [status, setStatus] = useState<{ kind: 'saving' | 'saved' | 'failed'; text: string } | null>(null)
  useEffect(() => {
    if (dirty) setStatus((s) => (s?.kind === 'saved' ? null : s))
  }, [dirty])
  const save = async () => {
    setStatus({ kind: 'saving', text: '저장 중…' })
    const r = await onSave()
    setStatus(r.ok ? { kind: 'saved', text: '저장함' } : { kind: 'failed', text: r.error })
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2">
      <code className="min-w-0 truncate text-[11px] text-slate-400">{file}</code>
      <span className="flex-1" />
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : status ? (
        <span className={`text-xs ${status.kind === 'failed' ? 'text-red-600' : 'text-slate-500'}`}>{status.text}</span>
      ) : dirty ? (
        <span className="text-xs text-amber-700">바뀐 곳 {dirty}</span>
      ) : (
        <span className="text-xs text-slate-400">저장된 그대로</span>
      )}
      <button type="button" className={BTN} disabled={!dirty} onClick={onReset} title="저장된 값으로">
        <RotateCcw size={13} />
        되돌리기
      </button>
      <button
        type="button"
        className={BTN_PRIMARY}
        disabled={!dirty || !!error || !CAN_SAVE || status?.kind === 'saving'}
        onClick={save}
        title={CAN_SAVE ? '파일에 저장' : '저장은 vite dev 서버에서만'}
      >
        <Save size={13} />
        저장
      </button>
    </div>
  )
}
