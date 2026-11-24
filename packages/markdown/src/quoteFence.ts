// 함정 ①: 인용·콜아웃 안에서 연 코드펜스 중간에 '>'가 빠진 줄이 있어도 옵시디언 읽기 화면은
// 닫는 펜스까지 콜아웃 안 코드로 잇는다 ('>'가 붙은 줄은 '>'만 떼고 코드로). CommonMark라면 거기서 인용·코드가 끊긴다.
// → remark 전에 원문에서 빠진 '>'를 채워 옵시디언과 같게 만든다.
//
// - 닫는 펜스를 못 찾으면 그 펜스는 건드리지 않는다 (CommonMark대로 인용 끝에서 끊기고, 파서가 "안 닫힘" 경고)
// - 닫는 펜스는 '>'가 있든 없든 인정 — 옵시디언은 '>' 없는 줄도 코드로 먹으니 '>' 없는 ```에서 닫힌다
// - 줄 머리에 붙이기만 하므로 줄 수가 그대로 → 경고 줄 번호가 원문과 맞는다

const MARKER = /^ {0,3}>[ \t]?/
const FENCE = /^([ \t]*)(`{3,}|~{3,})(.*)$/

export interface QuoteFenceResult {
  text: string
  fixed: number[] // '>'를 채운 줄 (1부터)
}

export function fillQuoteFences(src: string): QuoteFenceResult {
  if (!src.includes('>')) return { text: src, fixed: [] }
  const lines = src.split('\n')
  const fixed: number[] = []
  let i = 0
  while (i < lines.length) {
    const quoted = stripMarkers(lines[i], Infinity)
    const fence = quoted.depth ? FENCE.exec(quoted.rest) : null
    if (!quoted.depth) {
      // 인용 밖 코드펜스 — 안의 '> ```' 예시를 열기로 오해하지 않게 통째로 건너뛴다
      const top = FENCE.exec(lines[i])
      if (top && isOpening(top)) {
        const close = findClose(lines, i + 1, top, 0)
        i = close === -1 ? lines.length : close + 1
        continue
      }
      i++
      continue
    }
    // 들여쓰기는 안 따진다 — '> - 항목' 아래 '>   ```'처럼 리스트 안 펜스는 3칸을 넘을 수 있다
    if (!fence || !isOpening(fence)) {
      i++
      continue
    }
    const depth = quoted.depth
    const close = findClose(lines, i + 1, fence, depth)
    if (close === -1) {
      i++
      continue
    }
    // 여는 줄의 '>' 머리 + 펜스 들여쓰기 (리스트 안 펜스면 들여쓰기까지 있어야 그 항목 안에 남는다)
    const prefix = lines[i].slice(0, lines[i].length - quoted.rest.length) + fence[1]
    for (let k = i + 1; k <= close; k++) {
      const m = stripMarkers(lines[k], depth)
      if (m.depth >= depth) continue
      lines[k] = prefix + m.rest
      fixed.push(k + 1)
    }
    i = close + 1
  }
  return { text: fixed.length ? lines.join('\n') : src, fixed }
}

// 줄 머리의 '>'를 최대 max개까지 뗀다
function stripMarkers(line: string, max: number): { depth: number; rest: string } {
  let rest = line
  let depth = 0
  while (depth < max) {
    const m = MARKER.exec(rest)
    if (!m) break
    rest = rest.slice(m[0].length)
    depth++
  }
  return { depth, rest }
}

// 백틱 펜스의 정보 글자엔 백틱이 못 들어간다 (CommonMark) — 들어 있으면 인라인 코드
function isOpening(m: RegExpExecArray): boolean {
  return !(m[2][0] === '`' && m[3].includes('`'))
}

function findClose(lines: string[], from: number, open: RegExpExecArray, depth: number): number {
  const char = open[2][0]
  const close = new RegExp(`^[ \\t]*\\${char}{${open[2].length},}[ \\t]*$`)
  for (let k = from; k < lines.length; k++) {
    if (close.test(stripMarkers(lines[k], depth).rest)) return k
  }
  return -1
}
