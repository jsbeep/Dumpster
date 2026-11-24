import {
  SCHEMA_VERSION,
  blocksToText,
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

export interface BuildResult {
  graph: Graph
  report: BuildReport
  assets: AssetCopy[] // graph.json 옆 assets/로 복사할 이미지 (cli가 복사)
}

interface Draft {
  note: VaultNote
  meta: DocMeta
  doc: Doc
  body: string
  refs: BodyRef[]
}

export function buildGraph(opts: BuildOptions): BuildResult {
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
      body: split.body,
      refs: [],
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

  // --- 2. 링크 해석 (옵시디언처럼 이름으로 찾는다: 파일 이름 > 별칭, 같은 폴더 > 짧은 경로) ---
  const byTitle = new Map<string, Draft[]>()
  const byAlias = new Map<string, Draft[]>()
  const add = (map: Map<string, Draft[]>, key: string, d: Draft) => map.set(key, [...(map.get(key) ?? []), d])
  for (const d of drafts) {
    add(byTitle, d.note.title.toLowerCase(), d)
    add(byTitle, d.note.relPath.slice(0, -3).toLowerCase(), d)
    for (const alias of d.meta.aliases) add(byAlias, alias.toLowerCase(), d)
  }

  const lookup = (from: Draft, label: string) => {
    const key = label.normalize('NFC').toLowerCase()
    const candidates = byTitle.get(key) ?? byAlias.get(key) ?? []
    if (!candidates.length) return null
    const pick =
      candidates.find((c) => c.note.folder === from.note.folder) ??
      [...candidates].sort((a, b) => a.note.relPath.length - b.note.relPath.length)[0]
    return { pick, count: candidates.length }
  }

  const resolve = (from: Draft, label: string, relation: Relation): string | null => {
    const hit = lookup(from, label)
    if (hit) {
      if (hit.count > 1) report.warnings.push(`${from.note.relPath}: [[${label}]] 후보 ${hit.count}개 → ${hit.pick.note.relPath}`)
      return hit.pick.doc.id
    }
    const ref = `${from.note.title} → [[${label}]] (${relation})`
    if (scan.privateNames.has(label.normalize('NFC').toLowerCase())) report.privateRefs.push(ref)
    else report.missingRefs.push(ref)
    return null
  }

  // --- 3. 본문 → 블록 (파서는 순수 함수, 문서·이미지 찾기는 여기서 넘긴다) ---
  const assets = createAssetIndex(opts.vaultDir, scan.assets)
  for (const d of drafts) {
    const imageMisses = new Set<string>()
    const parsed = parseMarkdown(d.body, {
      selfId: d.doc.id,
      lineOffset: d.note.raw.split(/\r?\n/).length - d.body.split('\n').length,
      resolveDoc: (label) => lookup(d, label)?.pick.doc.id ?? null,
      resolveAsset: (name) => {
        const hit = assets.resolve(d.note.folder, name)
        if (hit) return { src: hit.src }
        if (!imageMisses.has(name)) {
          imageMisses.add(name)
          // 비공개 폴더 이미지도 결과물에선 없는 이미지와 똑같다. 어느 쪽인지는 리포트에만
          const isPrivate = scan.privateAssetNames.has(name.normalize('NFC').split('/').pop()!.toLowerCase())
          ;(isPrivate ? report.privateRefs : report.missingRefs).push(`${d.note.title} → ![[${name}]] (image)`)
        }
        return null
      },
    })
    for (const w of parsed.warnings) report.warnings.push(`${d.note.relPath}: ${w}`)
    d.doc.blocks = parsed.blocks
    d.doc.text = blocksToText(parsed.blocks)
    d.refs = parsed.refs
  }

  // --- 4. 컬렉션 (공개 목록의 폴더마다 하나, 루트 = 매니페스트) ---
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
      description: manifest ? (manifest.meta.description ?? firstParagraph(manifest.doc.blocks)) : null,
      tags: manifest?.meta.tags ?? [],
    })
  }

  // --- 5. 엣지 (각 문서는 자기가 내보내는 엣지만 소유) ---
  const edges = new Map<string, Edge>()
  const addEdge = (from: Draft, label: string, relation: Relation, origin: Edge['origin']) => {
    const target = resolve(from, label, relation)
    if (origin === 'body' && target === from.doc.id) return // 본문에서 자기 자신을 건 링크는 엣지로 안 만든다
    const id = edgeIdOf(from.doc.id, target, label, relation)
    if (!edges.has(id)) edges.set(id, { id, source: from.doc.id, target, targetLabel: label, relation, origin })
  }
  for (const d of drafts) {
    if (d.meta.prev) addEdge(d, d.meta.prev, 'prev', 'frontmatter')
    for (const label of d.meta.branch) addEdge(d, label, 'branch', 'frontmatter')
    for (const label of d.meta.seeAlso) addEdge(d, label, 'see_also', 'frontmatter')
    for (const ref of d.refs) addEdge(d, ref.label, ref.relation, 'body')
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
