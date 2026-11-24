import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { BlockOf } from '../context'
import { useStyles } from '../styles'

// 색은 전부 --code-* 변수(bg-code-bg …) — slate 단계는 다크에서 뒤집혀서 코드 바탕으로 못 쓴다

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

// 스타일 메모 (styles.json "code"): copy — 터치 화면엔 hover가 없으니 늘 보인다
export function CodeView({ block }: { block: BlockOf<'code'> }) {
  const S = useStyles().code
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
    <div className={S.box}>
      <button type="button" onClick={copy} aria-label="코드 복사" title="코드 복사" className={S.copy}>
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
      {block.language && <div className={S.label}>{block.language}</div>}
      <pre className={S.pre}>
        <code>{block.text}</code>
      </pre>
    </div>
  )
}
