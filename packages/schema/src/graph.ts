import type { Block } from './blocks'

// graph.json — 빌더가 만들고 탐색기·플레이그라운드가 읽는 유일한 계약.
// 레거시(tistory-doc-graph ↔ blog-explorer)는 이 타입을 두 레포에 복붙하다 어긋났다 → 여기 한 곳에만 둔다.

export const SCHEMA_VERSION = 3

export interface Graph {
  schemaVersion: typeof SCHEMA_VERSION
  generatedAt: string // ISO
  source: { vaultCommit: string | null } // 어느 볼트 커밋에서 빌드했나 (git 아니면 null)
  collections: Collection[]
  docs: Doc[]
  edges: Edge[]
}

// 컬렉션 = 공개 목록에 올린 폴더 하나. 하위 폴더는 따로 올려야 별도 컬렉션이 된다.
export interface Collection {
  id: string // 폴더 경로 세그먼트를 slug해서 '/'로 이음: '홈서버-구축기/시즌2'
  path: string[] // ['홈서버 구축기', '시즌2']
  title: string // 마지막 폴더 이름
  manifestId: string | null // type: manifest 문서 (트리의 루트)
  description: string | null
  tags: string[]
}

export type DocKind = 'manifest' | 'moc' | 'doc'

export interface Doc {
  id: string // frontmatter oid('6aeb0b8091f37a98e7007350'). 없으면 임시 ID '도커-설치-2611041940' (id.ts 참고)
  title: string // 파일 이름 (.md 제외)
  aliases: string[]
  collectionId: string
  kind: DocKind
  order: string | null // lexorank. 형제 정렬에 쓴다
  tags: string[]
  description: string | null
  createdAt: string // ISO +09:00. frontmatter → git 첫 커밋 → 파일 mtime 순으로 채움
  updatedAt: string // ISO. git 마지막 커밋 → mtime
  blocks: Block[] // P2(마크다운 파서) 전까지 빈 배열
  text: string // 검색용 평문. P2 전까지 ''
}

// prev     : source가 target의 다음 글 (트리의 뼈대, 문서당 최대 1개)
// branch   : 옛 스키마 호환용. 트리에는 안 쓰고 엣지 패널에만 보인다
// see_also : frontmatter의 짬통 관계
// link     : 본문 [[링크]]   embed: 본문 ![[문서]]   (둘 다 P2부터)
export type Relation = 'prev' | 'branch' | 'see_also' | 'link' | 'embed'

// 각 문서는 자기가 내보내는 엣지만 소유한다 — "새 글 쓸 때 이전 글은 절대 수정 안 함" 원칙과 같은 규칙.
export interface Edge {
  id: string // `${source}->${target ?? '?' + targetLabel}:${relation}` 결정적
  source: string
  target: string | null // null = 없는 문서 또는 비공개 문서 (둘을 구분하지 않는다 — 존재 여부도 안 샌다)
  targetLabel: string // 원문 [[...]] 안의 대상 이름
  relation: Relation
  origin: 'frontmatter' | 'body'
}

export function edgeIdOf(source: string, target: string | null, targetLabel: string, relation: Relation): string {
  return `${source}->${target ?? `?${targetLabel}`}:${relation}`
}
