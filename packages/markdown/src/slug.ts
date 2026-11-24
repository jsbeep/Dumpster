// heading 앵커 — GitHub(github-slugger)식: 소문자, 글자·숫자·_·-·공백만 남기고 공백 하나 = '-' 하나.
// 렌더러와 [[문서#헤딩]] 링크가 같은 함수를 써야 스크롤 위치가 맞는다.
export function slugifyHeading(text: string): string {
  return text
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-')
}

// 같은 문서 안 중복 헤딩: a, a-1, a-2 … (github-slugger와 같은 규칙)
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>()
  return (text) => {
    const base = slugifyHeading(text)
    let slug = base
    while (seen.has(slug)) {
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      slug = `${base}-${n}`
    }
    seen.set(slug, 0)
    return slug
  }
}
