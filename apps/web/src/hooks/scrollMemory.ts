import { isView, shownDocs } from '../core/view'

// 칸 스크롤 기억 (P4.3, design.md §3) — 글 id → 칸 안 스크롤 위치. 같은 글이 두 칸에 동시에 안 보여서 글 id로 충분
//   세션: 칸이 스크롤될 때마다 적고(Pane), 칸이 새로 그려지면 그 자리로 → 탭 전환·접었다 펴기·흐름 칸으로 옮기기
//   기록: 스크롤이 멈추면 지금 기록(history.state.scroll)에 그 기록에서 보이는 글들의 자리를 덮어쓴다
//         → 뒤로/앞으로 때 새로 그려지는 칸은 그 기록의 자리로, 새로고침해도 그 자리로
//   처음 여는 글(직전 칸 상태에 없던 글 — freshDocs)은 기억을 지워 맨 위부터. 트리로 다시 열어도 맨 위 (useView)

export type ScrollMap = Record<string, number>

const SAVE_AFTER = 250 // 스크롤이 이만큼 멈추면 기록에 적는다 (replaceState는 자주 부르면 브라우저가 막는다)
const mem = new Map<string, number>()
let timer = 0

export const recall = (id: string): number => mem.get(id) ?? 0

export function remember(id: string, y: number) {
  mem.set(id, y)
  clearTimeout(timer)
  timer = window.setTimeout(saveNow, SAVE_AFTER)
}

// 지금 기록에 보이는 글들의 자리를 적는다 — 스크롤 멈춤 · 새 기록을 쌓기 직전 · 페이지를 떠날 때
export function saveNow() {
  clearTimeout(timer)
  const st = history.state as { view?: unknown } | null
  if (!st || !isView(st.view)) return
  const scroll: ScrollMap = {}
  for (const id of shownDocs(st.view)) {
    const y = mem.get(id)
    if (y !== undefined) scroll[id] = y
  }
  history.replaceState({ ...st, scroll }, '')
}

// 기록에서 꺼낸 자리를 기억에 — 칸이 새로 그려질 글만 넘긴다 (계속 보이던 칸은 사용자가 그 사이 움직였을 수 있다)
export function seed(scroll: unknown, ids: string[]) {
  if (!scroll || typeof scroll !== 'object') return
  for (const id of ids) {
    const y = (scroll as ScrollMap)[id]
    if (typeof y === 'number' && Number.isFinite(y) && y >= 0) mem.set(id, y)
  }
}

export function forget(ids: string[]) {
  for (const id of ids) mem.delete(id)
}
