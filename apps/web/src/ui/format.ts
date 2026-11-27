// 날짜 글자 — ISO 문자열을 그대로 자른다 (빌더가 T 형식으로 고정해 둠)
export const ymd = (iso: string) => iso.slice(0, 10)
export const md = (iso: string) => iso.slice(5, 10)

// 날짜 툴팁 (11-27) — 글 위 날짜에 마우스·손가락을 대면 자세히.
// 글쓴이가 적은 벽시계 시각 그대로 쓴다(보는 사람 시간대로 안 바꿈). 00:00:00은 날짜만 적힌 글로 보고 시각을 뺀다
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
export function dateLong(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso)
  if (!m) return iso
  const [, y, mo, d, h, mi, s = '00'] = m
  const wd = WEEK[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()]
  const time = h && !(h === '00' && mi === '00' && s === '00') ? ` ${h}:${mi}` : ''
  return `${+y}년 ${+mo}월 ${+d}일 (${wd})${time}`
}

// 얼마 전 — 오늘 · 어제 · n일 전 · n주 전 · n개월 전 · n년 전
const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })
export function ago(iso: string, now = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000)
  if (!Number.isFinite(days) || days < 0) return ''
  if (days < 7) return rtf.format(-days, 'day')
  if (days < 30) return rtf.format(-Math.floor(days / 7), 'week')
  if (days < 365) return rtf.format(-Math.floor(days / 30), 'month')
  return rtf.format(-Math.floor(days / 365), 'year')
}

// 쓴 날 + 얼마 전, 고친 날이 다르면 한 줄 더
export function dateTip(created: string, updated: string, now = Date.now()): string {
  const a = ago(created, now)
  const first = `쓴 날 ${dateLong(created)}${a ? ` · ${a}` : ''}`
  return ymd(updated) !== ymd(created) ? `${first}\n고친 날 ${dateLong(updated)}` : first
}
