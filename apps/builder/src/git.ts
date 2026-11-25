import { execFileSync } from 'node:child_process'
import { toKstIso } from './dates'

export interface FileDates {
  created: string // 그 파일이 처음 들어간 커밋 (ISO +09:00)
  updated: string // 마지막으로 바뀐 커밋
}

export interface GitInfo {
  commit: string | null
  dates: Map<string, FileDates> // 키: 볼트 기준 경로
  // 커밋 안 된 수정·새 파일 (볼트 기준 경로). 이런 파일은 git 날짜가 낡았으니 파일 수정 시각을 쓴다
  // (obsidian-git이 45분마다 커밋하니 그 사이에 빌드하면 흔하다)
  dirty: Set<string>
}

const git = (cwd: string, args: string[]) =>
  execFileSync('git', ['-C', cwd, '-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })

// git log 한 번으로 모든 파일의 처음/마지막 커밋 시각을 뽑는다 (파일마다 git을 부르면 N배 느려짐).
// 볼트가 git 레포가 아니거나 커밋이 없으면 빈 결과 — 호출부가 파일 mtime으로 대신한다.
export function readGitInfo(vaultDir: string): GitInfo {
  const empty: GitInfo = { commit: null, dates: new Map(), dirty: new Set() }
  let prefix: string
  try {
    prefix = git(vaultDir, ['rev-parse', '--show-prefix']).trim()
  } catch {
    return empty
  }
  let commit: string | null = null
  try {
    commit = git(vaultDir, ['rev-parse', 'HEAD']).trim()
  } catch {
    return empty // 커밋이 아직 없음
  }

  // porcelain 경로는 레포 루트 기준. 이름 바꾸기(R)·복사(C)는 뒤에 옛 경로가 한 칸 더 붙는다
  const dirty = new Set<string>()
  const entries = git(vaultDir, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.']).split('\0')
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.length < 4) continue
    const file = entry.slice(3)
    if (file.startsWith(prefix)) dirty.add(file.slice(prefix.length).normalize('NFC'))
    if (entry[0] === 'R' || entry[0] === 'C') i++
  }

  const dates = new Map<string, FileDates>()
  const log = git(vaultDir, ['log', '--format=%x01%aI', '--name-only', '--', '.'])
  // 최신 커밋부터 나온다: 처음 보는 파일 = updated, 이후 볼 때마다 created를 더 과거로
  for (const chunk of log.split('\x01')) {
    const [dateLine, ...files] = chunk.split('\n')
    const ms = Date.parse(dateLine?.trim() ?? '')
    if (Number.isNaN(ms)) continue
    const iso = toKstIso(ms)
    for (const file of files) {
      if (!file || !file.startsWith(prefix)) continue
      const rel = file.slice(prefix.length).normalize('NFC')
      const known = dates.get(rel)
      if (known) known.created = iso
      else dates.set(rel, { created: iso, updated: iso })
    }
  }
  return { commit, dates, dirty }
}
