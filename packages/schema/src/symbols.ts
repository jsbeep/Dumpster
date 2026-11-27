// 기호 바꾸기 — 옵시디언 Symbols prettifier 플러그인(README 목록 10개)과 같은 글자.
// 플러그인은 화면에만 그리고 파일은 안 고친다 → 볼트 원문엔 '->'가 그대로라 파서가 바꾼다 (코드 밖 글자만).
// 파서(본문)·[[문서#헤딩]] 앵커·찾기칸 검색어가 같은 표를 써야 서로 맞는다.
//   '--'(→ –)·'!='·'==='는 뺀다 — 코드 표시 없이 쓴 명령 옵션(`gpg --dearmor`)이 깨진다. '-->'는 '→'로

export const SYMBOLS: Readonly<Record<string, string>> = {
  '<->': '↔',
  '<=>': '⇔',
  '-->': '→',
  '->': '→',
  '<-': '←',
  '<=': '⇐',
  '=>': '⇒',
  '=<': '≤',
  '>=': '≥',
  '+-': '±',
  '-+': '∓',
}

// 긴 것부터 ('<->'가 '<-'보다 먼저)
export const SYMBOL_PATTERN = new RegExp(
  Object.keys(SYMBOLS)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[+]/g, '\\$&'))
    .join('|'),
  'g',
)

export function prettifySymbols(text: string): string {
  return text.replace(SYMBOL_PATTERN, (m) => SYMBOLS[m])
}
