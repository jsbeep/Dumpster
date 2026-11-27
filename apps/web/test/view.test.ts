import { slideOf } from '../src/core/slide'
import { buildGraphIndex, type Relation } from '@dumpster/schema'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// 빌더를 상대경로로 바로 부른다 (테스트 전용). 짜가 볼트로 진짜 그래프를 만들어서
// 시나리오 표에 적힌 링크·이전/다음 글이 데이터에 정말 있는지도 같이 본다
import { buildGraph } from '../../builder/src/build'
import { hashOf, parseHash } from '../src/core/route'
import { HOME, activeOf, freshDocs, isView, reduce, routeOf, shownDocs, viewOfRoute, type Action, type Result, type View } from '../src/core/view'

const vaultDir = fileURLToPath(new URL('../../../fixtures/vault', import.meta.url))
const FIXED = { created: '2026-11-24T12:00:00+09:00', updated: '2026-11-24T12:00:00+09:00' }
const { graph } = buildGraph({
  vaultDir,
  publicFolders: ['홈서버 구축기', '홈서버 구축기/시즌2', '블록 견본'],
  dates: () => FIXED,
  vaultCommit: null,
  now: () => new Date(0),
})
const index = buildGraphIndex(graph)

const id = (title: string) => {
  const d = graph.docs.find((x) => x.title === title)
  if (!d) throw new Error(`문서 없음: ${title}`)
  return d.id
}
const title = (docId: string | null) => (docId ? (index.docsById.get(docId)?.title ?? `?${docId}`) : null)
const nextTitles = (t: string) => (index.nextOf.get(id(t)) ?? []).map((d) => d.title)

// 칸 상태를 제목으로 만들고 읽는다. active는 펼친 탭 제목
const view = (main: string, tabs: string[] = [], active?: string): View => ({
  main: id(main),
  tabs: tabs.map(id),
  active: active ? tabs.indexOf(active) : Math.max(0, tabs.length - 1),
  collapsed: null,
})
const show = (v: View) => ({ main: title(v.main), tabs: v.tabs.map(title), active: title(activeOf(v)) })

// 본문에서 보이는 글자로 문서 링크 찾기 — 블록 모양에 기대지 않게 JSON을 통째로 훑는다
// undefined = 그런 링크 없음, null = 링크는 있는데 갈 곳이 없음(없는 글·비공개·draft → 회색 글자)
function bodyLink(from: string, text: string): string | null | undefined {
  let found: string | null | undefined
  const walk = (x: unknown): void => {
    if (found !== undefined || !x || typeof x !== 'object') return
    if (Array.isArray(x)) return x.forEach(walk)
    const o = x as Record<string, unknown>
    const link = o.link as { kind?: string; docId?: string | null } | undefined
    if (o.text === text && link?.kind === 'doc') {
      found = link.docId ?? null
      return
    }
    Object.values(o).forEach(walk)
  }
  walk(index.docsById.get(id(from))!.blocks)
  return found
}
const edge = (from: string, relation: Relation, label: string) =>
  graph.edges.find((e) => e.source === id(from) && e.relation === relation && e.targetLabel === label)

const run = (v: View, ...actions: Action[]): Result => {
  let r: Result = { view: v, history: 'none', flash: null, slot: null }
  for (const a of actions) r = reduce(r.view, a)
  return r
}

// 매니페스트(fixtures/vault/홈서버 구축기/OT.홈서버 구축기.md) "탐색 시나리오" 표 — 줄 번호 그대로
describe('탐색 시나리오 (매니페스트 표)', () => {
  it('1 트리에서 용량 부족 사태 → 흐름 교체', () => {
    const r = reduce(HOME, { type: 'open', id: id('용량 부족 사태') })
    expect(show(r.view)).toEqual({ main: '용량 부족 사태', tabs: [], active: null })
    expect([r.history, r.slot]).toEqual(['push', 'main'])
  })

  it('2 하단 다음 → 외장 SSD 달기 (흐름 교체)', () => {
    expect(nextTitles('용량 부족 사태')).toEqual(['외장 SSD 달기'])
    const r = reduce(view('용량 부족 사태'), { type: 'step', slot: 'main', id: id('외장 SSD 달기') })
    expect(show(r.view).main).toBe('외장 SSD 달기')
    expect(r.slot).toBe('main') // 트리 선택이 따라감 = 지금 보는 칸이 흐름
  })

  it('3 도커 설치 다음 글 = 갈래 3개, draft는 안 보임', () => {
    expect(nextTitles('도커 설치')).toEqual(['포트포워딩 삽질', '컨테이너 뭐 올리지', '회고 - 도커 쓸만한가'])
    expect(graph.docs.some((d) => d.title === '몰래 쓰는 중')).toBe(false)
  })

  it('4 회고 다음 글 k3s 도전기 → 흐름 교체, 컬렉션 넘어감, 연관 탭은 그대로', () => {
    expect(nextTitles('회고 - 도커 쓸만한가')).toEqual(['k3s 도전기'])
    const v = view('회고 - 도커 쓸만한가', ['모니터링 붙이기'])
    const r = reduce(v, { type: 'step', slot: 'main', id: id('k3s 도전기') })
    expect(show(r.view)).toEqual({ main: 'k3s 도전기', tabs: ['모니터링 붙이기'], active: '모니터링 붙이기' })
    expect(index.docsById.get(r.view.main!)!.collectionId).not.toBe(index.docsById.get(v.main!)!.collectionId)
  })

  it('5 용량 부족 사태 본문 "처음에 깐 OS" → 연관 칸 새 탭', () => {
    expect(bodyLink('용량 부족 사태', '처음에 깐 OS')).toBe(id('OS 설치'))
    const r = reduce(view('용량 부족 사태'), { type: 'link', id: id('OS 설치') })
    expect(show(r.view)).toEqual({ main: '용량 부족 사태', tabs: ['OS 설치'], active: 'OS 설치' })
    expect([r.history, r.slot]).toEqual(['push', 'rel'])
  })

  it('6 거기서 바로가기 → OS 설치가 흐름으로, 탭에서 빠짐', () => {
    const r = reduce(view('용량 부족 사태', ['OS 설치']), { type: 'promote' })
    expect(show(r.view)).toEqual({ main: 'OS 설치', tabs: [], active: null })
    expect(r.slot).toBe('main')
  })

  it('7 HTTPS 인증서 본문 Nextcloud 올리기 → 새 탭 (다른 갈래)', () => {
    expect(bodyLink('HTTPS 인증서', 'Nextcloud 올리기')).toBe(id('Nextcloud 올리기'))
    expect(index.ancestors(id('Nextcloud 올리기'))).not.toContain(id('HTTPS 인증서'))
    const r = reduce(view('HTTPS 인증서'), { type: 'link', id: id('Nextcloud 올리기') })
    expect(show(r.view).tabs).toEqual(['Nextcloud 올리기'])
  })

  it('8 회고 see_also 모니터링 붙이기 → 새 탭', () => {
    expect(edge('회고 - 도커 쓸만한가', 'see_also', '모니터링 붙이기')?.target).toBe(id('모니터링 붙이기'))
    const r = reduce(view('회고 - 도커 쓸만한가'), { type: 'link', id: id('모니터링 붙이기') })
    expect(show(r.view).tabs).toEqual(['모니터링 붙이기'])
  })

  // A~D: 아무 글이나 (탭 규칙만 본다)
  const [A, B, C, D] = ['라즈베리파이 고르기', 'OS 설치', '고정 IP 설정', 'DDNS 붙이기']
  const abc = view('도커 설치', [A, B, C], B) // [A] *B [C]

  it('9 [A] *B [C]에서 링크 D → 펼친 탭 바로 뒤에 끼움, 오른쪽 띠 그대로', () => {
    const r = reduce(abc, { type: 'link', id: id(D) })
    expect(show(r.view)).toEqual({ main: '도커 설치', tabs: [A, B, D, C], active: D })
  })

  it('10 왼쪽 띠 A 누르기 → 그 탭 펼침, 닫히는 탭 없음', () => {
    const r = run(abc, { type: 'link', id: id(D) }, { type: 'pick', index: 0 })
    expect(show(r.view)).toEqual({ main: '도커 설치', tabs: [A, B, D, C], active: A })
    expect([r.history, r.slot]).toEqual(['push', 'rel'])
  })

  it('11 펼친 탭 × → 오른쪽 탭, 없으면 왼쪽 탭', () => {
    expect(show(reduce(abc, { type: 'close', index: 1 }).view)).toEqual({ main: '도커 설치', tabs: [A, C], active: C })
    const last = view('도커 설치', [A, B], B)
    expect(show(reduce(last, { type: 'close', index: 1 }).view)).toEqual({ main: '도커 설치', tabs: [A], active: A })
    // 펼치지 않은 탭을 닫으면 펼친 탭은 그대로, 지금 보는 칸도 그대로
    const r = reduce(abc, { type: 'close', index: 0 })
    expect(show(r.view)).toEqual({ main: '도커 설치', tabs: [B, C], active: B })
    expect(r.slot).toBeNull()
    // 마지막 탭을 닫으면 연관 칸이 사라지고 흐름 칸으로
    const one = reduce(view('도커 설치', [A]), { type: 'close', index: 0 })
    expect([one.view.tabs.length, one.slot]).toEqual([0, 'main'])
  })

  it('12 연관 칸에서 이전/다음 → 펼친 탭만 바뀜, 흐름 칸 그대로', () => {
    expect(nextTitles(B)).toEqual([C])
    const r = reduce(abc, { type: 'step', slot: 'rel', id: id(C) }) // C는 이미 탭 → 그 탭 펼침
    expect(show(r.view)).toEqual({ main: '도커 설치', tabs: [A, B, C], active: C })
    const r2 = reduce(view('도커 설치', [A, B], B), { type: 'step', slot: 'rel', id: id(C) })
    expect(show(r2.view)).toEqual({ main: '도커 설치', tabs: [A, C], active: C })
    expect(r2.slot).toBe('rel')
  })

  it('13~15 회색 글자 — 없는 글 · 비공개 · draft는 갈 곳이 없다', () => {
    expect(bodyLink('회고 - 도커 쓸만한가', '공유기 설정')).toBeNull() // 없는 글
    expect(bodyLink('고정 IP 설정', '통장 비번')).toBeNull() // 비공개
    expect(edge('고정 IP 설정', 'see_also', '통장 비번')?.target).toBeNull()
    expect(edge('회고 - 도커 쓸만한가', 'see_also', '몰래 쓰는 중')?.target).toBeNull() // draft
  })

  it('16 이미 열린 글로 가는 링크 — 탭이면 그 탭 펼침, 흐름 칸 글이면 반짝만', () => {
    const r = reduce(abc, { type: 'link', id: id(A) })
    expect(show(r.view)).toEqual({ main: '도커 설치', tabs: [A, B, C], active: A })
    const flash = reduce(abc, { type: 'link', id: id('도커 설치') })
    expect(flash.view).toBe(abc)
    expect([flash.history, flash.flash]).toEqual(['none', 'main'])
    const flashRel = reduce(abc, { type: 'link', id: id(B) }) // 펼친 탭 글 → 연관 칸 반짝
    expect([flashRel.view === abc, flashRel.flash]).toEqual([true, 'rel'])
  })

  it('17 기록 — 이동은 push, 접기·훑기(j/k)는 덮어쓰기, 안 바뀌면 안 쌓음', () => {
    expect(reduce(abc, { type: 'pick', index: 2 }).history).toBe('push')
    expect(reduce(abc, { type: 'collapse', slot: 'rel' }).history).toBe('replace')
    expect(reduce(abc, { type: 'open', id: id(D), scan: true }).history).toBe('replace')
    expect(reduce(abc, { type: 'open', id: id('도커 설치') }).history).toBe('none')
  })

  it('18 주소 → 새 탭: 흐름 글 + 펼친 탭만 따라온다', () => {
    const r = routeOf(abc)
    expect([title(r.main), title(r.rel)]).toEqual(['도커 설치', B])
    const opened = viewOfRoute(parseHash(hashOf(r)))
    expect(show(opened)).toEqual({ main: '도커 설치', tabs: [B], active: B })
    expect(viewOfRoute({ main: null, rel: null })).toBe(HOME)
    expect(viewOfRoute({ main: id(A), rel: id(A) }).tabs).toEqual([]) // 같은 글이 두 칸에 안 보이게
  })
})

describe('칸 동작 나머지', () => {
  const abc = view('도커 설치', ['라즈베리파이 고르기', 'OS 설치', '고정 IP 설정'], 'OS 설치')

  it('트리에서 고른 글이 탭에 있으면 탭에서 빠지고 이웃 탭이 펼쳐짐', () => {
    const r = reduce(abc, { type: 'open', id: id('OS 설치') })
    expect(show(r.view)).toEqual({ main: 'OS 설치', tabs: ['라즈베리파이 고르기', '고정 IP 설정'], active: '고정 IP 설정' })
  })

  it('폰 서랍에서 고르기(solo) — 칸이 하나라 탭을 비우고 그 글만, 지금 흐름 글이어도 탭이 있으면 비움', () => {
    const r = reduce(abc, { type: 'open', id: id('외장 SSD 달기'), solo: true })
    expect([show(r.view), r.history, r.slot]).toEqual([{ main: '외장 SSD 달기', tabs: [], active: null }, 'push', 'main'])
    const same = reduce(abc, { type: 'open', id: id('도커 설치'), solo: true })
    expect([show(same.view), same.history]).toEqual([{ main: '도커 설치', tabs: [], active: null }, 'push'])
    const alone = view('도커 설치')
    expect(reduce(alone, { type: 'open', id: id('도커 설치'), solo: true }).history).toBe('none')
  })

  it('폰 ‹ — 지금 탭을 닫고 왼쪽 탭으로, 맨 앞이면 흐름 글로', () => {
    expect(show(reduce(abc, { type: 'back' }).view).active).toBe('라즈베리파이 고르기')
    const first = { ...abc, active: 0 }
    const r = reduce(first, { type: 'back' })
    expect([r.view.tabs.length, r.slot]).toEqual([0, 'main']) // 폰엔 띠가 안 보여서 오른쪽 탭을 남기지 않는다
  })

  it('접기 — 탭이 없으면 못 접고, 연관 칸이 접힌 채 링크·띠를 누르면 펴짐', () => {
    expect(reduce(view('도커 설치'), { type: 'collapse', slot: 'main' }).history).toBe('none')
    const folded = reduce(abc, { type: 'collapse', slot: 'rel' }).view
    expect(folded.collapsed).toBe('rel')
    expect(reduce(folded, { type: 'link', id: id('DDNS 붙이기') }).view.collapsed).toBeNull()
    const picked = reduce(folded, { type: 'pick', index: 1 }) // 펼친 탭 띠 = 펴기만
    expect([picked.view.collapsed, picked.view.active, picked.history]).toEqual([null, 1, 'replace'])
    expect(reduce(folded, { type: 'collapse', slot: 'rel' }).view.collapsed).toBeNull() // 토글
  })

  it('모두 닫기 · 첫 화면 · 첫 화면에서 링크', () => {
    expect(reduce(abc, { type: 'closeAll' }).view.tabs).toEqual([])
    expect(reduce(abc, { type: 'home' }).view).toEqual(HOME)
    expect(show(reduce(HOME, { type: 'link', id: id('OS 설치') }).view)).toEqual({ main: 'OS 설치', tabs: [], active: null })
  })

  it('범위 밖 띠 번호는 무시', () => {
    for (const a of [{ type: 'pick', index: 9 }, { type: 'close', index: -1 }, { type: 'pick', index: 0.5 }] as Action[]) {
      expect(reduce(abc, a).view).toBe(abc)
    }
  })

  it('isView — 기록에서 꺼낸 값 검사', () => {
    expect(isView(abc)).toBe(true)
    expect(isView(HOME)).toBe(true)
    const bad = [
      null, 'x', { ...abc, tabs: [abc.tabs[0], abc.tabs[0]] }, { ...abc, tabs: [abc.main] }, { ...abc, active: 3 },
      { ...HOME, tabs: [abc.main] }, { ...abc, collapsed: 'side' }, { ...view('도커 설치'), collapsed: 'rel' }, { ...abc, active: 1.5 },
    ]
    for (const v of bad) expect(isView(v)).toBe(false)
  })
})

// 아무렇게나 눌러도 칸 상태가 늘 말이 되는지 — 시드 고정 난수로 3000번
describe('불변식', () => {
  it('어떤 순서로 눌러도 isView, 안 바뀌면 none · 바뀌면 push/replace', () => {
    let seed = 20261126
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const pickOf = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
    const ids = graph.docs.map((d) => d.id).slice(0, 8) // 적게 골라야 이미 열린 글로 가는 경우가 자주 나온다
    let v: View = HOME
    for (let n = 0; n < 3000; n++) {
      const i = Math.floor(rand() * (v.tabs.length + 1))
      const a = pickOf<Action>([
        { type: 'open', id: pickOf(ids) },
        { type: 'open', id: pickOf(ids), scan: true },
        { type: 'link', id: pickOf(ids) },
        { type: 'link', id: pickOf(ids) },
        { type: 'step', slot: pickOf(['main', 'rel'] as const), id: pickOf(ids) },
        { type: 'pick', index: i },
        { type: 'close', index: i },
        { type: 'promote' },
        { type: 'collapse', slot: pickOf(['main', 'rel'] as const) },
        { type: 'expand' },
        { type: 'back' },
        { type: 'closeAll' },
        { type: 'home' },
      ])
      const r = reduce(v, a)
      expect(isView(r.view), `${n}: ${JSON.stringify(a)} → ${JSON.stringify(r.view)}`).toBe(true)
      expect(r.history === 'none').toBe(r.view === v)
      v = r.view
    }
  })
})

// P4.3 — 칸에 들어온 글이 '처음 여는 글'(맨 위부터)인지 '돌아온 글'(읽던 자리로)인지
describe('스크롤 기억: 처음 여는 글', () => {
  const after = (v: View, a: Action) => reduce(v, a).view
  const fresh = (v: View, a: Action) => freshDocs(v, after(v, a)).map(title)

  it('보이는 글 = 흐름 글 + 펼친 탭 (첫 화면은 없음)', () => {
    expect(shownDocs(view('용량 부족 사태', ['OS 설치', '외장 SSD 달기'], 'OS 설치')).map(title)).toEqual(['용량 부족 사태', 'OS 설치'])
    expect(shownDocs(HOME)).toEqual([])
  })
  it('트리·이전/다음·새 링크로 연 글은 처음부터', () => {
    expect(fresh(view('용량 부족 사태'), { type: 'open', id: id('OS 설치') })).toEqual(['OS 설치'])
    expect(fresh(view('도커 설치'), { type: 'step', slot: 'main', id: id('고정 IP 설정') })).toEqual(['고정 IP 설정'])
    expect(fresh(view('용량 부족 사태'), { type: 'link', id: id('외장 SSD 달기') })).toEqual(['외장 SSD 달기'])
  })
  it('예전에 읽던 글이라도 지금 칸 상태에 없으면 처음부터 (트리로 다시 열기)', () => {
    let v = view('용량 부족 사태')
    v = after(v, { type: 'open', id: id('OS 설치') })
    expect(fresh(v, { type: 'open', id: id('용량 부족 사태') })).toEqual(['용량 부족 사태'])
  })
  it('탭에 있던 글이 다시 보이면 읽던 자리로 — 띠 누르기 · 탭 닫기 · 흐름 칸으로 · 트리에서 탭 글 고르기', () => {
    const v = view('용량 부족 사태', ['OS 설치', '외장 SSD 달기'], '외장 SSD 달기')
    expect(fresh(v, { type: 'pick', index: 0 })).toEqual([])
    expect(fresh(v, { type: 'close', index: 1 })).toEqual([])
    expect(fresh(v, { type: 'promote' })).toEqual([])
    expect(fresh(v, { type: 'open', id: id('OS 설치') })).toEqual([])
  })
  it('j/k(scan)도 새 글이면 처음부터', () => {
    expect(fresh(view('OS 설치'), { type: 'open', id: id('고정 IP 설정'), scan: true })).toEqual(['고정 IP 설정'])
  })
})

describe('폰 글 바꾸기 슬라이드 방향 (core/slide)', () => {
  it('이전/다음 — 이전 글·분기점이면 prev, 다음 글이면 next', () => {
    const v = view('용량 부족 사태')
    expect(slideOf(index, v, { type: 'step', slot: 'main', id: id('외장 SSD 달기') })).toBe('next')
    expect(slideOf(index, v, { type: 'step', slot: 'main', id: id('Nextcloud 올리기') })).toBe('prev')
    const fork = index.ancestors(id('용량 부족 사태'))[0]
    expect(slideOf(index, v, { type: 'step', slot: 'main', id: fork })).toBe('prev')
  })
  it('링크(새 탭)는 next, ‹·탭 닫기·모두 닫기는 prev', () => {
    const v = view('용량 부족 사태', ['OS 설치', '외장 SSD 달기'], '외장 SSD 달기')
    expect(slideOf(index, view('용량 부족 사태'), { type: 'link', id: id('OS 설치') })).toBe('next')
    expect(slideOf(index, v, { type: 'back' })).toBe('prev')
    expect(slideOf(index, v, { type: 'close', index: 1 })).toBe('prev')
    expect(slideOf(index, v, { type: 'closeAll' })).toBe('prev')
  })
  it('보이는 글이 그대로면(반짝만)·서랍에서 고르기·첫 화면은 안 미끄러짐', () => {
    const v = view('용량 부족 사태')
    expect(slideOf(index, v, { type: 'link', id: id('용량 부족 사태') })).toBeNull()
    expect(slideOf(index, v, { type: 'open', id: id('OS 설치'), solo: true })).toBeNull()
    expect(slideOf(index, v, { type: 'home' })).toBeNull()
    expect(slideOf(index, view('용량 부족 사태', ['OS 설치'], 'OS 설치'), { type: 'promote' })).toBeNull()
  })
})
