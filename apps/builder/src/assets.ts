import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { extensionOf } from '@dumpster/markdown'
import type { VaultAsset } from './vault'

// 본문에 실제로 쓴 이미지만 복사 목록에 올린다. 복사는 cli가 (테스트는 복사 없이 목록만 본다).
export interface AssetCopy {
  src: string // graph.json 옆 기준 경로: 'assets/<sha256 앞 16자>.<ext>' — 내용이 같으면 경로도 같다
  file: string // 볼트 안 절대 경로
}

export interface AssetIndex {
  // 옵시디언처럼 이름으로 찾는다: 노트 기준 상대 경로 > 볼트 기준 경로 > 파일 이름 (같은 폴더 > 그 아래 > 짧은 경로)
  resolve(fromFolder: string, name: string): AssetCopy | null
  copies(): AssetCopy[]
}

export function createAssetIndex(vaultDir: string, assets: VaultAsset[]): AssetIndex {
  const byPath = new Map<string, VaultAsset>()
  const byName = new Map<string, VaultAsset[]>()
  for (const a of assets) {
    const key = a.relPath.toLowerCase()
    byPath.set(key, a)
    const name = posix.basename(key)
    byName.set(name, [...(byName.get(name) ?? []), a])
  }

  const used = new Map<string, AssetCopy>() // relPath → 복사본
  const pick = (candidates: VaultAsset[], from: string) =>
    candidates.find((c) => c.folder === from) ??
    candidates.find((c) => c.folder.startsWith(`${from}/`)) ??
    [...candidates].sort((a, b) => a.relPath.length - b.relPath.length)[0]

  return {
    resolve(fromFolder, name) {
      const key = name.normalize('NFC').replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase()
      const hit =
        byPath.get(posix.join(fromFolder.toLowerCase(), key)) ??
        byPath.get(key) ??
        (byName.has(posix.basename(key)) ? pick(byName.get(posix.basename(key))!, fromFolder) : undefined)
      if (!hit) return null
      let copy = used.get(hit.relPath)
      if (!copy) {
        const file = join(vaultDir, hit.relPath)
        const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16)
        copy = { src: `assets/${hash}.${extensionOf(hit.relPath)}`, file }
        used.set(hit.relPath, copy)
      }
      return copy
    },
    copies() {
      const bySrc = new Map<string, AssetCopy>()
      for (const c of used.values()) if (!bySrc.has(c.src)) bySrc.set(c.src, c) // 내용이 같은 파일은 처음 쓴 것 하나만
      return [...bySrc.values()].sort((a, b) => (a.src < b.src ? -1 : a.src > b.src ? 1 : 0))
    },
  }
}
