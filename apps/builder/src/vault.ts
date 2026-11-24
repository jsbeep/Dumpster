import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, posix } from 'node:path'
import { IMAGE_EXTENSIONS, extensionOf } from '@dumpster/markdown'
import { toKstIso } from './dates'

export interface VaultNote {
  relPath: string // 볼트 기준 posix 경로: '홈서버 구축기/도커 설치.md'
  folder: string // '홈서버 구축기'
  title: string // '도커 설치'
  raw: string
  mtime: string // ISO +09:00
}

export interface VaultScan {
  notes: VaultNote[] // 공개 폴더의 비어 있지 않은 .md
  skipped: { relPath: string; reason: string }[]
  // 비공개 .md의 이름(소문자 basename, 소문자 경로-확장자). 링크가 비공개를 가리키는지 리포트할 때만 쓴다.
  // 비공개 파일은 내용을 절대 읽지 않는다.
  privateNames: Set<string>
  // 이미지는 공개 폴더 아래(그 하위 _image/ 같은 첨부 폴더 포함)에 있는 것만 쓴다
  assets: VaultAsset[]
  privateAssetNames: Set<string> // 그 밖 이미지의 소문자 파일 이름. 리포트용 — 내용은 안 읽는다
  missingFolders: string[]
}

export interface VaultAsset {
  relPath: string // '블록 견본/_image/견본.png'
  folder: string // '블록 견본/_image'
}

const norm = (p: string) => p.normalize('NFC').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')

export function scanVault(vaultDir: string, publicFolders: string[]): VaultScan {
  const publicSet = new Set(publicFolders.map(norm).filter(Boolean))
  const scan: VaultScan = { notes: [], skipped: [], privateNames: new Set(), assets: [], privateAssetNames: new Set(), missingFolders: [] }
  const underPublic = (folder: string) => [...publicSet].some((f) => folder === f || folder.startsWith(`${f}/`))

  for (const folder of publicSet) {
    if (!existsSync(join(vaultDir, folder))) scan.missingFolders.push(folder)
  }

  const walk = (relDir: string) => {
    for (const entry of readdirSync(join(vaultDir, relDir), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue // .obsidian .trash .git .makemd .space …
      const relPath = norm(relDir ? posix.join(relDir, entry.name) : entry.name)
      if (entry.isDirectory()) {
        walk(relPath)
        continue
      }
      if (!entry.isFile()) continue
      const folder = norm(relDir)
      if (IMAGE_EXTENSIONS.has(extensionOf(entry.name))) {
        if (underPublic(folder)) scan.assets.push({ relPath, folder })
        else scan.privateAssetNames.add(entry.name.normalize('NFC').toLowerCase())
        continue
      }
      if (!entry.name.toLowerCase().endsWith('.md')) continue
      const title = entry.name.slice(0, -3).normalize('NFC')
      if (!publicSet.has(folder)) {
        scan.privateNames.add(title.toLowerCase())
        scan.privateNames.add(relPath.slice(0, -3).toLowerCase())
        continue
      }
      const abs = join(vaultDir, relDir, entry.name)
      const stat = statSync(abs)
      if (stat.size === 0) {
        scan.skipped.push({ relPath, reason: '빈 파일 (폴더 노트 등)' })
        continue
      }
      scan.notes.push({ relPath, folder, title, raw: readFileSync(abs, 'utf8'), mtime: toKstIso(stat.mtimeMs) })
    }
  }
  walk('')
  scan.notes.sort((a, b) => a.relPath.localeCompare(b.relPath, 'ko'))
  return scan
}
