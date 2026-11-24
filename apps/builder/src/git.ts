import { execFileSync } from 'node:child_process'
import { toKstIso } from './dates'

export interface FileDates {
  created: string // 그 파일이 처음 들어간 커밋 (ISO +09:00)
  updated: string // 마지막으로 바뀐 커밋
}

export interface GitInfo {
  commit: string | null
  dates: Map<string, FileDates> // 키: 볼트 기준 경로
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
  const empty: GitInfo = { commit: null, dates: new Map() }
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
  return { commit, dates }
}
