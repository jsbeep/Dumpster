import {
  SCHEMA_VERSION,
  blocksToSections,
  docIdOf,
  edgeIdOf,
  inlinesToText,
  slugify,
  type Block,
  type Collection,
  type Doc,
  type Edge,
  type Graph,
  type Relation,
} from '@dumpster/schema'
import { parseMarkdown, type BodyRef } from '@dumpster/markdown'
import { createAssetIndex, type AssetCopy } from './assets'
import { splitFrontmatter, normalizeMeta, type DocMeta } from './frontmatter'
import { readGitInfo, type FileDates } from './git'
import { scanVault, type VaultNote } from './vault'

export interface BuildOptions {
  vaultDir: string
  publicFolders: string[]
  // 테스트에서 git 대신 고정 날짜를 넣을 때 (이때는 '커밋 안 된 수정'도 없는 것으로 본다)
  dates?: (relPath: string) => FileDates | undefined
  vaultCommit?: string | null
  now?: () => Date
}

// 빌드 리포트는 콘솔에만 찍는다 — 비공개·draft 문서 이름이 들어 있으므로 graph.json에 절대 넣지 않는다.
export interface BuildReport {
  warnings: string[]
  skipped: { relPath: string; reason: string }[]
  privateRefs: string[] // '고정 IP 설정 → [[통장 비번]] (see_also)'
  missingRefs: string[]
  missingFolders: string[]
  drafts: { relPath: string; id: string }[] // 태그 _draft로 숨긴 글 (id는 빌드 비교 때 "draft로 숨김" 표시용)
}

export interface BuildResult {
  graph: Graph
  report: BuildReport
  assets: AssetCopy[] // graph.json 옆 assets/로 복사할 이미지 (cli가 복사)
}

interface Entry {
  note: VaultNote
  meta: DocMeta
  doc: Doc
  body: string
  refs: BodyRef[]
  gitCreated: string // ID 겹칠 때 "먼저 생긴 글"을 가리는 데만 씀
}

export function buildGraph(opts: BuildOptions): BuildResult {
  const scan = scanVault(opts.vaultDir, opts.publicFolders)
  const report: BuildReport = {
    warnings: [],
    skipped: scan.skipped,
    privateRefs: [],
    missingRefs: [],
    missingFolders: scan.missingFolders,
    drafts: [],
  }

  let dates = opts.dates
  let dirty = new Set<string>()
  let vaultCommit = opts.vaultCommit ?? null
  if (!dates) {
    const git = readGitInfo(opts.vaultDir)
    dates = (relPath) => git.dates.get(relPath)
    dirty = git.dirty
    if (opts.vaultCommit === undefined) vaultCommit = git.commit
  }

  // --- 1. 노트 → 항목 (draft는 여기서 빠진다. 링크 해석에선 비공개 문서와 똑같이 취급) ---
  const entries: Entry[] = []
  const hiddenNames = new Set<string>()
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

    if (meta.draft) {
      hiddenNames.add(note.title.toLowerCase())
      hiddenNames.add(note.relPath.slice(0, -3).toLowerCase())
      report.drafts.push({ relPath: note.relPath, id: meta.oid ?? docIdOf(note.title, createdAt) })
      continue
    }
    const rawOid = split.data?.oid
    if (split.data && (rawOid === undefined || rawOid === null || rawOid === '')) warn('oid 없음 → 임시 ID')

    entries.push({
      note,
      meta,
      body: split.body,
      refs: [],
      gitCreated: fileDates?.created ?? note.mtime,
      doc: {
        id: '',
        title: note.title,
        aliases: meta.aliases,
        collectionId: collectionIdOf(note.folder),
        kind: meta.kind,
        order: meta.order,
        tags: meta.tags,
        ...(meta.branchTag ? { branch: true as const } : {}),
        description: meta.description,
        createdAt,
        updatedAt: dirty.has(note.relPath) || !fileDates ? note.mtime : fileDates.updated,
        blocks: [],
        sections: [],
      },
    })
  }

  // --- 2. ID: oid, 없으면 임시 ID. 겹치면 먼저 생긴 글이 갖는다 ---
  // 먼저 생긴 순서 = createdAt → git 첫 커밋 → 경로가 짧은 쪽(옵시디언 사본은 ' 1'이 붙어 길다) → 경로
  // 순서가 빌드마다 같아야 새 글이 생겨도 기존 글 ID가 안 바뀐다
  const senior = [...entries].sort(
    (a, b) =>
      Date.parse(a.doc.createdAt) - Date.parse(b.doc.createdAt) ||
      Date.parse(a.gitCreated) - Date.parse(b.gitCreated) ||
      a.note.relPath.length - b.note.relPath.length ||
      (a.note.relPath < b.note.relPath ? -1 : 1),
  )
  const owner = new Map<string, string>() // id → relPath
  for (const e of senior) {
    const warn = (msg: string) => report.warnings.push(`${e.note.relPath}: ${msg}`)
    let id = e.meta.oid
    if (id && owner.has(id)) {
      warn(`oid가 '${owner.get(id)}'와 겹침(사본·복붙?) → 임시 ID. 이 글의 oid를 지우고 새로 만드세요`)
      id = null
    }
    if (!id) {
      const base = docIdOf(e.note.title, e.doc.createdAt)
      id = base
      for (let n = 2; owner.has(id); n++) id = `${base}-${n}`
      if (id !== base) warn(`임시 ID ${base}가 '${owner.get(base)}'와 겹침 → ${id}`)
    }
    owner.set(id, e.note.relPath)
    e.doc.id = id
  }

  // --- 3. 링크 해석 (옵시디언처럼 이름으로 찾는다: 파일 이름 > 별칭, 같은 폴더 > 짧은 경로) ---
  const byTitle = new Map<string, Entry[]>()
  const byAlias = new Map<string, Entry[]>()
  const add = (map: Map<string, Entry[]>, key: string, e: Entry) => map.set(key, [...(map.get(key) ?? []), e])
  for (const e of entries) {
    add(byTitle, e.note.title.toLowerCase(), e)
    add(byTitle, e.note.relPath.slice(0, -3).toLowerCase(), e)
    for (const alias of e.meta.aliases) add(byAlias, alias.toLowerCase(), e)
  }

  const lookup = (from: Entry, label: string) => {
    const key = label.normalize('NFC').toLowerCase()
    const candidates = byTitle.get(key) ?? byAlias.get(key) ?? []
    if (!candidates.length) return null
    const pick =
      candidates.find((c) => c.note.folder === from.note.folder) ??
      [...candidates].sort((a, b) => a.note.relPath.length - b.note.relPath.length)[0]
    return { pick, count: candidates.length }
  }

  const resolve = (from: Entry, label: string, relation: Relation): string | null => {
    const hit = lookup(from, label)
    if (hit) {
      if (hit.count > 1) report.warnings.push(`${from.note.relPath}: [[${label}]] 후보 ${hit.count}개 → ${hit.pick.note.relPath}`)
      return hit.pick.doc.id
    }
    const key = label.normalize('NFC').toLowerCase()
    const ref = `${from.note.title} → [[${label}]] (${relation})`
    if (hiddenNames.has(key)) report.privateRefs.push(`${ref} — draft`)
    else if (scan.privateNames.has(key)) report.privateRefs.push(ref)
    else report.missingRefs.push(ref)
    return null
  }

  // --- 4. 본문 → 블록 (파서는 순수 함수, 문서·이미지 찾기는 여기서 넘긴다) ---
  const assets = createAssetIndex(opts.vaultDir, scan.assets)
  for (const e of entries) {
    const imageMisses = new Set<string>()
    const parsed = parseMarkdown(e.body, {
      selfId: e.doc.id,
      lineOffset: e.note.raw.split(/\r?\n/).length - e.body.split('\n').length,
      resolveDoc: (label) => lookup(e, label)?.pick.doc.id ?? null,
      resolveAsset: (name) => {
        const hit = assets.resolve(e.note.folder, name)
        if (hit) return { src: hit.src }
        if (!imageMisses.has(name)) {
          imageMisses.add(name)
          // 비공개 폴더 이미지도 결과물에선 없는 이미지와 똑같다. 어느 쪽인지는 리포트에만
          const isPrivate = scan.privateAssetNames.has(name.normalize('NFC').split('/').pop()!.toLowerCase())
          ;(isPrivate ? report.privateRefs : report.missingRefs).push(`${e.note.title} → ![[${name}]] (image)`)
        }
        return null
      },
    })
    for (const w of parsed.warnings) report.warnings.push(`${e.note.relPath}: ${w}`)
    e.doc.blocks = parsed.blocks
    e.doc.sections = blocksToSections(parsed.blocks)
    e.refs = parsed.refs
  }

  // --- 5. 컬렉션 (공개 목록의 폴더마다 하나, 루트 = 매니페스트) ---
  const collections: Collection[] = []
  for (const folder of new Set(opts.publicFolders.map((f) => f.normalize('NFC').replace(/^\/+|\/+$/g, '')))) {
    if (!folder || scan.missingFolders.includes(folder)) continue
    const members = entries.filter((e) => e.note.folder === folder)
    const manifests = members.filter((e) => e.meta.kind === 'manifest').sort((a, b) => a.doc.createdAt.localeCompare(b.doc.createdAt))
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
      description: manifest ? (manifest.meta.description ?? firstParagraph(manifest.doc.blocks)) : null,
      tags: manifest?.meta.tags ?? [],
    })
  }

  // --- 6. 엣지 (각 문서는 자기가 내보내는 엣지만 소유) ---
  const edges = new Map<string, Edge>()
  const addEdge = (from: Entry, label: string, relation: Relation, origin: Edge['origin']) => {
    const target = resolve(from, label, relation)
    if (origin === 'body' && target === from.doc.id) return // 본문에서 자기 자신을 건 링크는 엣지로 안 만든다
    const id = edgeIdOf(from.doc.id, target, label, relation)
    if (!edges.has(id)) edges.set(id, { id, source: from.doc.id, target, targetLabel: label, relation, origin })
  }
  for (const e of entries) {
    if (e.meta.prev) addEdge(e, e.meta.prev, 'prev', 'frontmatter')
    for (const label of e.meta.branch) addEdge(e, label, 'branch', 'frontmatter')
    for (const label of e.meta.seeAlso) addEdge(e, label, 'see_also', 'frontmatter')
    for (const ref of e.refs) addEdge(e, ref.label, ref.relation, 'body')
  }

  const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const graph: Graph = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: (opts.now?.() ?? new Date()).toISOString(),
    source: { vaultCommit },
    collections: collections.sort(byId),
    docs: entries.map((e) => e.doc).sort(byId),
    edges: [...edges.values()].sort(byId),
  }
  return { graph, report, assets: assets.copies() }
}

export function collectionIdOf(folder: string): string {
  return folder.split('/').map(slugify).join('/')
}

// 매니페스트에 description이 없으면 본문 첫 문단으로 컬렉션 설명을 대신한다
function firstParagraph(blocks: Block[]): string | null {
  const para = blocks.find((b) => b.type === 'paragraph')
  if (!para) return null
  const text = inlinesToText(para.inlines).replace(/\s+/g, ' ').trim()
  return text.length > 160 ? `${text.slice(0, 159)}…` : text || null
}
