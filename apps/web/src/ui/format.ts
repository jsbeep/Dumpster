// 날짜 글자 — ISO 문자열을 그대로 자른다 (빌더가 T 형식으로 고정해 둠)
export const ymd = (iso: string) => iso.slice(0, 10)
export const md = (iso: string) => iso.slice(5, 10)
