// %%주석%% 제거 — 공개 금지 내용이라 문법 트리를 만들기 전에 원문에서 지운다 (여러 줄 주석이 블록 경계를 넘을 수 있어서).
// protect: 코드 블록·인라인 코드 범위 [시작, 끝). 옵시디언은 코드 안의 %%를 주석으로 보지 않고 그대로 보여준다.

export interface StripResult {
  text: string
  removed: number // 지운 주석 개수
  unclosed: boolean // 닫는 %% 없이 문서 끝까지 지움
}

export function stripComments(src: string, protect: Array<[number, number]> = []): StripResult {
  const ranges = [...protect].sort((a, b) => a[0] - b[0])
  let out = ''
  const cuts: number[] = [] // 지운 자리 (out 기준 위치)
  let removed = 0
  let unclosed = false
  let i = 0
  let r = 0
  while (i < src.length) {
    while (r < ranges.length && ranges[r][1] <= i) r++
    if (r < ranges.length && ranges[r][0] <= i) {
      out += src.slice(i, ranges[r][1])
      i = ranges[r][1]
      continue
    }
    if (src.startsWith('%%', i)) {
      cuts.push(out.length)
      removed++
      const close = src.indexOf('%%', i + 2)
      if (close === -1) {
        unclosed = true // 옵시디언도 닫히지 않은 %%는 문서 끝까지 주석으로 본다
        break
      }
      i = close + 2
      if (/[ \t]$/.test(out) && src[i] === ' ') i++ // '앞 %%주석%% 뒤' → '앞 뒤' (공백 두 칸 안 남게)
      continue
    }
    const nextComment = src.indexOf('%%', i)
    const nextRange = r < ranges.length ? ranges[r][0] : src.length
    const stop = Math.min(nextComment === -1 ? src.length : nextComment, nextRange)
    out += src.slice(i, stop)
    i = stop
  }
  if (!cuts.length) return { text: out, removed, unclosed }

  // 주석만 있던 줄(인용 '>' 포함)은 줄째로 없앤다 — 빈 줄이 남으면 문단·인용이 엉뚱하게 갈라진다
  const kept: string[] = []
  let pos = 0
  let c = 0
  for (const line of out.split('\n')) {
    const end = pos + line.length
    let cut = false
    while (c < cuts.length && cuts[c] <= end) {
      if (cuts[c] >= pos) cut = true
      c++
    }
    if (!(cut && /^[\s>]*$/.test(line))) kept.push(line)
    pos = end + 1
  }
  return { text: kept.join('\n'), removed, unclosed }
}
