// 날짜 정규화 — 모든 시각을 KST(+09:00) ISO 문자열로 맞춘다. 형제 정렬·ID 스탬프가 이 값을 쓴다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function toKstIso(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+09:00`
  )
}

// 실제 볼트에 있는 createdAt 형식들
//   2026-11-11-14:01        템플릿(Templater)          → KST로 본다
//   2026-07-10T22:45:00     ISO, 오프셋 없음            → KST로 본다
//   2026-11-03T10:00:00Z    ISO, 오프셋 있음            → KST로 변환
//   2026-07-07              날짜만                      → 00:00 KST
export function normalizeCreatedAt(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toKstIso(value.getTime())
  if (typeof value !== 'string') return null
  const v = value.trim()
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[-T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z|[+-]\d{2}:?\d{2})?$/)
  if (!m) return null
  const [, y, mo, d, h = '00', mi = '00', s = '00', offset] = m
  if (!offset) {
    const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - KST_OFFSET_MS
    return Number.isNaN(ms) ? null : toKstIso(ms)
  }
  const ms = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}${offset === 'Z' ? 'Z' : offset.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')}`)
  return Number.isNaN(ms) ? null : toKstIso(ms)
}
