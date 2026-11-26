import { docHref } from '@dumpster/blocks'
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'

// 여러 화면 조각이 같이 쓰는 작은 것들

export const cn = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

export const ymd = (iso: string) => iso.slice(0, 10)
export const md = (iso: string) => iso.slice(5, 10)

// 새 탭·새 창으로 열려는 클릭(Ctrl/⌘/Shift/가운데 버튼)은 브라우저에 맡긴다 — 블록 렌더러 링크와 같은 규칙
const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

// 글로 가는 것은 전부 진짜 링크(#/d/{id}) — 그냥 누르면 앱이 칸을 바꾸고, Ctrl·가운데 클릭은 브라우저 새 탭.
// 글자색·밑줄은 Tailwind preflight가 지운다 (a { color: inherit; text-decoration: inherit })
export function DocLink({
  id,
  onGo,
  className,
  children,
  ...rest
}: { id: string; onGo: () => void; className?: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'onClick'
>) {
  return (
    <a
      href={docHref(id)}
      className={className}
      onClick={(e) => {
        if (!plainClick(e)) return
        e.preventDefault()
        onGo()
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
