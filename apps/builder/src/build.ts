import {
  SCHEMA_VERSION,
  docIdOf,
  edgeIdOf,
  slugify,
  type Collection,
  type Doc,
  type Edge,
  type Graph,
  type Relation,
} from '@dumpster/schema'
import { splitFrontmatter, normalizeMeta, type DocMeta } from './frontmatter'
import { readGitInfo, type FileDates } from './git'
import { scanVault, type VaultNote } from './vault'

export interface BuildOptions {
  vaultDir: string
  publicFolders: string[]
  // 테스트에서 git 대신 고정 날짜를 넣을 때
  dates?: (relPath: string) => FileDates | undefined
  vaultCommit?: string | null
  now?: () => Date
}

// 빌드 리포트는 콘솔에만 찍는다 — 비공개 문서 이름이 들어 있으므로 graph.json에 절대 넣지 않는다.
export interface BuildReport {
  warnings: string[]
  skipped: { relPath: string; reason: string }[]
  privateRefs: string[] // '고정 IP 설정 → [[통장 비번]] (see_also)'
  missingRefs: string[]
  missingFolders: string[]
}

interface Draft {
  note: VaultNote
  meta: DocMeta
  doc: Doc
}

export function buildGraph(opts: BuildOptions): { graph: Graph; report: BuildReport } {
  const scan = scanVault(opts.vaultDir, opts.publicFolders)
  const report: BuildReport = {
    warnings: [],
    skipped: scan.skipped,
    privateRefs: [],
    missingRefs: [],
    missingFolders: scan.missingFolders,
  }

  let dates = opts.dates
  let vaultCommit = opts.vaultCommit ?? null
  if (!dates) {
    const git = readGitInfo(opts.vaultDir)
    dates = (relPath) => git.dates.get(relPath)
    if (opts.vaultCommit === undefined) vaultCommit = git.commit
  }

  // --- 1. 노트 → 문서 초안 ---
  const usedIds = new Set<string>()
  const drafts: Draft[] = []
  for (const note of scan.notes) {
    const warn = (msg: string) => report.warnings.push(`${note.relPath}: ${msg}`)
    const split = splitFrontmatter(note.raw)
    if (split.warning) warn(split.warning)
    if (!split.data) warn('속성(frontmatter) 없음')
    const meta = normalizeMeta(split.data, warn)

    const fileDates = dates(note.relPath)
    let createdAt = meta.createdAt
    if (!createdAt) {
      createdAt = fileDates?.created ?? note.mtime
      warn(`createdAt 없음 → ${fileDates ? 'git 첫 커밋' : '파일 수정 시각'} 사용`)
    }

    let id = docIdOf(note.title, createdAt)
    if (usedIds.has(id)) {
      let n = 2
      while (usedIds.has(`${id}-${n}`)) n++
      warn(`ID 충돌 ${id} → ${id}-${n}`)
      id = `${id}-${n}`
    }
    usedIds.add(id)

    drafts.push({
      note,
      meta,
      doc: {
        id,
        title: note.title,
        aliases: meta.aliases,
        collectionId: collectionIdOf(note.folder),
        kind: meta.kind,
        order: meta.order,
        tags: meta.tags,
        description: meta.description,
        createdAt,
        updatedAt: fileDates?.updated ?? note.mtime,
        blocks: [],
        text: '',
      },
    })
  }

  // --- 2. 컬렉션 (공개 목록의 폴더마다 하나, 루트 = 매니페스트) ---
  const collections: Collection[] = []
  for (const folder of new Set(opts.publicFolders.map((f) => f.normalize('NFC').replace(/^\/+|\/+$/g, '')))) {
    if (!folder || scan.missingFolders.includes(folder)) continue
    const members = drafts.filter((d) => d.note.folder === folder)
    const manifests = members.filter((d) => d.meta.kind === 'manifest').sort((a, b) => a.doc.createdAt.localeCompare(b.doc.createdAt))
    if (manifests.length > 1) {
      report.warnings.push(`${folder}: 매니페스트가 ${manifests.length}개 — ${manifests[0].doc.title}만 루트로 씀`)
    }
    const manifest = manifests[0]
    const path = folder.split('/')
    collections.push({
      id: collectionIdOf(folder),
      path,
      title: path[path.length - 1],
      manifestId: manifest?.doc.id ?? null,
      description: manifest?.meta.description ?? null,
      tags: manifest?.meta.tags ?? [],
    })
  }

  // --- 3. 링크 해석 (옵시디언처럼 이름으로 찾는다: 파일 이름 > 별칭, 같은 폴더 > 짧은 경로) ---
  const byTitle = new Map<string, Draft[]>()
  const byAlias = new Map<string, Draft[]>()
  const add = (map: Map<string, Draft[]>, key: string, d: Draft) => map.set(key, [...(map.get(key) ?? []), d])
  for (const d of drafts) {
    add(byTitle, d.note.title.toLowerCase(), d)
    add(byTitle, d.note.relPath.slice(0, -3).toLowerCase(), d)
    for (const alias of d.meta.aliases) add(byAlias, alias.toLowerCase(), d)
  }

  const resolve = (from: Draft, label: string, relation: Relation): string | null => {
    const key = label.normalize('NFC').toLowerCase()
    const candidates = byTitle.get(key) ?? byAlias.get(key) ?? []
    if (candidates.length) {
      const pick =
        candidates.find((c) => c.note.folder === from.note.folder) ??
        [...candidates].sort((a, b) => a.note.relPath.length - b.note.relPath.length)[0]
      if (candidates.length > 1) report.warnings.push(`${from.note.relPath}: [[${label}]] 후보 ${candidates.length}개 → ${pick.note.relPath}`)
      return pick.doc.id
    }
    const ref = `${from.note.title} → [[${label}]] (${relation})`
    if (scan.privateNames.has(key)) report.privateRefs.push(ref)
    else report.missingRefs.push(ref)
    return null
  }

  // --- 4. 엣지 (각 문서는 자기가 내보내는 엣지만 소유) ---
  const edges = new Map<string, Edge>()
  const addEdge = (from: Draft, label: string, relation: Relation) => {
    const target = resolve(from, label, relation)
    const id = edgeIdOf(from.doc.id, target, label, relation)
    if (!edges.has(id)) edges.set(id, { id, source: from.doc.id, target, targetLabel: label, relation, origin: 'frontmatter' })
  }
  for (const d of drafts) {
    if (d.meta.prev) addEdge(d, d.meta.prev, 'prev')
    for (const label of d.meta.branch) addEdge(d, label, 'branch')
    for (const label of d.meta.seeAlso) addEdge(d, label, 'see_also')
  }

  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const graph: Graph = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: (opts.now?.() ?? new Date()).toISOString(),
    source: { vaultCommit },
    collections: collections.sort(byId),
    docs: drafts.map((d) => d.doc).sort(byId),
    edges: [...edges.values()].sort(byId),
  }
  return { graph, report }
}

export function collectionIdOf(folder: string): string {
  return folder.split('/').map(slugify).join('/')
}
