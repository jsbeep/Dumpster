import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { BlockOf } from '../context'
import { cx, SCROLL_X } from '../cx'

// 색은 전부 --code-* 변수(bg-code-bg …) — slate 단계는 다크에서 뒤집혀서 코드 바탕으로 못 쓴다
export const STYLE = {
  box: 'group/code relative min-w-0 overflow-hidden rounded-lg border border-code-border bg-code-bg text-code-fg',
  label: 'flex h-9 select-none items-center border-b border-code-border px-4 font-mono text-[0.6875em] uppercase tracking-wider text-code-muted',
  // 터치 화면엔 hover가 없으니 늘 보인다
  copy:
    'absolute right-1.5 top-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border border-code-border bg-code-bg text-code-muted opacity-0 transition hover:text-code-fg focus-visible:opacity-100 group-hover/code:opacity-100 [@media(hover:none)]:opacity-100',
  pre: cx(SCROLL_X, 'px-4 py-3 font-mono text-[0.8125em] leading-[1.6] [tab-size:4]'),
}

// http로 띄운 Pi 개발 서버처럼 clipboard API가 없는 곳을 위해 옛 방식도
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 아래 방식으로
  }
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  return ok
}

export function CodeView({ block }: { block: BlockOf<'code'> }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async () => {
    if (!(await copyText(block.text))) return
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className={STYLE.box}>
      <button type="button" onClick={copy} aria-label="코드 복사" title="코드 복사" className={STYLE.copy}>
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
      {block.language && <div className={STYLE.label}>{block.language}</div>}
      <pre className={STYLE.pre}>
        <code>{block.text}</code>
      </pre>
    </div>
  )
}
