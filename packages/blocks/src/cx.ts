export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// 노트에 붙여넣은 링크라도 스크립트 주소는 링크로 만들지 않는다
export function safeHref(href: string): string | null {
  return /^\s*(javascript|vbscript|data):/i.test(href) ? null : href
}
