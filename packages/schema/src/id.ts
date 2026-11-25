// 문서 ID
//   기본: frontmatter `oid` — ObjectId(24자리 hex = 앞 8자리 생성 시각 + 랜덤) 또는 UUID. 이름·createdAt을 바꿔도 그대로다
//   임시: oid가 없거나 이상하면 slug(이름) + '-' + createdAt 스탬프(yyMMddHHmm, KST)
//         '도커 설치' + 2026-11-04T19:40+09:00 → '도커-설치-2611041940'
//         이름을 바꾸면 바뀌므로 탐색기는 임시 ID URL을 스탬프(stampOf)로 한 번 더 찾는다

const OBJECT_ID = /^[0-9a-f]{24}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function isOid(value: string): boolean {
  return OBJECT_ID.test(value) || UUID.test(value)
}

export function slugify(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\\/#?%"<>|:*[\]^`{}]/g, '')
    .replace(/[\s._]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ISO 시각 → KST 기준 'yyMMddHHmm'
export function stampOfDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
}

// oid가 없을 때 쓰는 임시 ID
export function docIdOf(title: string, createdAtIso: string): string {
  return `${slugify(title)}-${stampOfDate(createdAtIso)}`
}

// 임시 ID에서 스탬프만 꺼낸다. 충돌 때 붙는 '-2' 같은 꼬리는 무시
export function stampOf(docId: string): string | null {
  if (isOid(docId)) return null
  return docId.match(/-(\d{10})(?:-\d+)?$/)?.[1] ?? null
}
