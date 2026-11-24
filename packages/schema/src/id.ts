// 문서 ID = slug(이름) + '-' + createdAt 스탬프(yyMMddHHmm, KST)
//   '도커 설치' + 2026-11-04T19:40+09:00 → '도커-설치-2611041940'
// 이름을 바꾸면 ID도 바뀐다. 탐색기는 URL을 찾을 때 스탬프(stampOf)로 한 번 더 찾아서 옛 링크도 살린다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

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

export function docIdOf(title: string, createdAtIso: string): string {
  return `${slugify(title)}-${stampOfDate(createdAtIso)}`
}

// ID에서 스탬프만 꺼낸다. 충돌 때 붙는 '-2' 같은 꼬리는 무시
export function stampOf(docId: string): string | null {
  return docId.match(/-(\d{10})(?:-\d+)?$/)?.[1] ?? null
}
