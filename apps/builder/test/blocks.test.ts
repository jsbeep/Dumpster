import { afterAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blocksToText, buildGraphIndex, treeToText, type Block, type Inline } from '@dumpster/schema'
import { buildGraph } from '../src/build'

// 본문 → 블록 볼트 통합 테스트 (fixtures/vault/블록 견본 + 홈서버 구축기 본문 링크).
// 파서 단독 정답은 packages/markdown/test/golden/*.json
const vaultDir = fileURLToPath(new URL('../../../fixtures/vault', import.meta.url))
const FIXED = { created: '2026-11-24T12:00:00+09:00', updated: '2026-11-24T12:00:00+09:00' }
const build = (publicFolders: string[], dir = vaultDir) =>
  buildGraph({ vaultDir: dir, publicFolders, dates: () => FIXED, vaultCommit: null, now: () => new Date(0) })

const HOME = ['홈서버 구축기', '홈서버 구축기/시즌2']
const { graph, report, assets } = build([...HOME, '블록 견본'])
const json = JSON.stringify(graph)
const index = buildGraphIndex(graph)
const doc = (title: string) => {
  const d = graph.docs.find((x) => x.title === title)
  if (!d) throw new Error(`문서 없음: ${title}`)
  return d
}
const edgesFrom = (title: string, relation: 'link' | 'embed') =>
  graph.edges
    .filter((e) => e.source === doc(title).id && e.relation === relation)
    .map((e) => [e.targetLabel, e.target, e.origin])

// 코드가 아닌 모든 글자 (렌더러가 글자로 보여줄 것들)
const visibleTexts = (blocks: Block[]): string[] => {
  const out: string[] = []
  const inl = (xs: Inline[]) => xs.filter((i) => !i.code).forEach((i) => out.push(i.text))
  for (const b of blocks) {
    if (b.type === 'heading' || b.type === 'paragraph') inl(b.inlines)
    else if (b.type === 'list') {
      for (const item of b.items) {
        inl(item.inlines)
        out.push(...visibleTexts(item.children))
      }
    } else if (b.type === 'blockquote') out.push(...visibleTexts(b.children))
    else if (b.type === 'callout') {
      inl(b.title)
      out.push(...visibleTexts(b.children))
    } else if (b.type === 'table') [b.header, ...b.rows].flat().forEach(inl)
    else if (b.type === 'image') out.push(b.alt)
    else if (b.type === 'bookmark') out.push(b.title, b.description)
    else if (b.type === 'embed') out.push(b.label)
    else if (b.type === 'unsupported') out.push(b.raw)
  }
  return out
}

describe('본문이 들어가도 트리는 그대로', () => {
  it('홈서버 구축기 트리 = 블록 견본 없이 빌드한 것과 같다', () => {
    const before = buildGraphIndex(build(HOME).graph)
    expect(treeToText(index, '홈서버-구축기')).toBe(treeToText(before, '홈서버-구축기'))
    expect(treeToText(index, '홈서버-구축기/시즌2')).toBe(treeToText(before, '홈서버-구축기/시즌2'))
  })

  it('블록 견본은 prev 한 줄', () => {
    expect(treeToText(index, '블록-견본')).toBe(
      ['● OT.블록 견본', '● 글자와 문단', '● 리스트와 인용', '● 표와 코드', '● 이미지와 임베드', '● 주석과 HTML', '● 함정 모음'].join('\n'),
    )
  })
})

describe('Doc.blocks / Doc.text', () => {
  it('모든 문서에 블록이 차고 text = blocksToText', () => {
    for (const d of graph.docs) {
      expect(d.blocks.length, d.title).toBeGreaterThan(0)
      expect(d.text).toBe(blocksToText(d.blocks))
    }
  })

  it('용량 부족 사태: 별칭 링크는 별칭 글자로, 줄바꿈 1번은 \\n', () => {
    expect(doc('용량 부족 사태').blocks).toEqual([
      {
        type: 'paragraph',
        inlines: [
          { text: '사진 동기화 켜자마자 SD카드 꽉 참 → ' },
          { text: '외장 SSD 달기', link: { kind: 'doc', docId: doc('외장 SSD 달기').id } },
          { text: '\n' },
          { text: '처음에 깐 OS', link: { kind: 'doc', docId: doc('OS 설치').id } },
          { text: '를 SD에 깐 게 원죄' },
        ],
      },
    ])
    expect(doc('용량 부족 사태').text).toBe('사진 동기화 켜자마자 SD카드 꽉 참 → 외장 SSD 달기\n처음에 깐 OS를 SD에 깐 게 원죄')
  })

  it('고정 IP 설정: 비공개 문서 링크는 회색 글자(docId null), 콜아웃', () => {
    expect(doc('고정 IP 설정').blocks).toEqual([
      {
        type: 'paragraph',
        inlines: [
          { text: '공유기에서 DHCP 예약으로 해결\n공유기 관리자 비번은 ' },
          { text: '통장 비번', link: { kind: 'doc', docId: null } },
          { text: ' 옆에 적어둠 ㅋㅋ' },
        ],
      },
      { type: 'callout', kind: 'warning', title: [{ text: '주의' }], fold: 'none', children: [{ type: 'paragraph', inlines: [{ text: '공유기 바꾸면 다시 해야 함' }] }] },
    ])
  })

  it('매니페스트 description이 있으면 그대로 컬렉션 설명 (없을 때 첫 문단 대체는 임시 볼트 테스트에서)', () => {
    expect(graph.collections.find((c) => c.id === '블록-견본')?.description).toBe('마크다운 → 블록 변환(P2) 정답 확인용 견본 컬렉션')
  })
})

describe('본문 링크·임베드 → 엣지 (origin body)', () => {
  it('홈서버 구축기 본문 링크 (탐색 시나리오의 push 대상)', () => {
    expect(edgesFrom('용량 부족 사태', 'link')).toEqual([
      ['OS 설치', doc('OS 설치').id, 'body'],
      ['외장 SSD 달기', doc('외장 SSD 달기').id, 'body'],
    ])
    expect(edgesFrom('HTTPS 인증서', 'link')).toEqual([['Nextcloud 올리기', doc('Nextcloud 올리기').id, 'body']])
    expect(edgesFrom('회고 - 도커 쓸만한가', 'link')).toEqual([['공유기 설정', null, 'body']])
  })

  it('다른 컬렉션 문서도 이름으로 찾고, 같은 문서를 여러 번 걸어도 엣지는 하나, 자기 자신 [[#헤딩]]은 엣지 없음', () => {
    expect(edgesFrom('글자와 문단', 'link')).toEqual([
      ['아직 안 쓴 글', null, 'body'],
      ['통장 비번', null, 'body'],
      ['도커 설치', doc('도커 설치').id, 'body'],
    ])
  })

  it('![[문서]] → embed 엣지, 블록의 docId = 엣지 target', () => {
    expect(edgesFrom('이미지와 임베드', 'embed')).toEqual([
      ['아직 안 쓴 글', null, 'body'],
      ['글자와 문단', doc('글자와 문단').id, 'body'],
    ])
    expect(doc('이미지와 임베드').blocks.filter((b) => b.type === 'embed')).toEqual([
      { type: 'embed', docId: doc('글자와 문단').id, label: '글자와 문단' },
      { type: 'embed', docId: null, label: '아직 안 쓴 글' },
    ])
  })

  it('비공개·없는 문서는 리포트에만 구분된다', () => {
    expect(report.privateRefs).toEqual([
      '글자와 문단 → [[통장 비번]] (link)',
      '고정 IP 설정 → [[통장 비번]] (see_also)',
      '고정 IP 설정 → [[통장 비번]] (link)',
    ])
    expect(report.missingRefs).toEqual([
      '이미지와 임베드 → ![[없는 그림.png]] (image)',
      '글자와 문단 → [[아직 안 쓴 글]] (link)',
      '이미지와 임베드 → [[아직 안 쓴 글]] (embed)',
      '공유기 비번 찾기 → [[공유기 설정]] (prev)',
      '회고 - 도커 쓸만한가 → [[공유기 설정]] (link)',
    ])
  })

  it('파서 경고는 파일 경로를 붙여 리포트로', () => {
    // 함정 ①(콜아웃 펜스의 빠진 >)은 옵시디언처럼 복구되므로 펜스 경고가 없다
    expect(report.warnings.filter((w) => w.includes('펜스'))).toEqual([])
    expect(report.warnings).toContain('블록 견본/주석과 HTML.md: 닫는 %% 없음 → 문서 끝까지 주석으로 지움')
  })
})

describe('공개 금지 — graph.json 문자열 검사', () => {
  it('비공개 폴더 카나리아·%% 주석·<!-- --> 내용이 없다', () => {
    expect(json).not.toContain('카나리아')
    expect(json).not.toContain('안 보여야 하는 헤딩')
    expect(json).not.toContain('html-주석-카나리아')
  })

  it('%%는 코드(블록·인라인) 안에만 남는다', () => {
    for (const d of graph.docs) {
      for (const t of visibleTexts(d.blocks)) expect(t, d.title).not.toContain('%%')
    }
    expect(json).toContain('for %%i in (*.txt) do echo %%i') // 코드 블록은 그대로
  })

  it('생 HTML은 글자(JSON 문자열)로만 — 블록 타입에 html이 없다', () => {
    const div = doc('함정 모음').blocks.find((b) => b.type === 'paragraph' && b.inlines[0]?.text.startsWith('<div'))
    expect(div).toBeDefined()
    expect(new Set(graph.docs.flatMap((d) => d.blocks.map((b) => b.type))).has('html' as never)).toBe(false)
  })
})

describe('이미지 에셋', () => {
  const sha = (rel: string) => createHash('sha256').update(readFileSync(join(vaultDir, rel))).digest('hex').slice(0, 16)
  const sample = `assets/${sha('블록 견본/_image/견본.png')}.png`
  const pasted = `assets/${sha('블록 견본/_image/Pasted image 20261120093000.png')}.png`

  it('함정 ④: 파일 이름만 적어도 공개 폴더 아래 _image/에서 찾아 내용 해시 경로로', () => {
    expect(doc('함정 모음').blocks.at(-1)).toEqual({ type: 'image', src: pasted, alt: 'Pasted image 20261120093000.png', width: null, height: null })
    expect(doc('이미지와 임베드').blocks.filter((b) => b.type === 'image').map((b) => b.type === 'image' && [b.src, b.width, b.height])).toEqual([
      [sample, 447, null],
      [sample, 447, 300],
      [sample, 120, null],
      ['https://example.com/cat.png', 200, null],
    ])
  })

  it('복사 목록은 실제로 쓴 이미지만, 같은 파일은 한 번', () => {
    expect(assets.map((a) => a.src)).toEqual([sample, pasted].sort())
    expect(assets.map((a) => a.file.slice(vaultDir.length))).toEqual(
      [sample, pasted].sort().map((src) => (src === sample ? '/블록 견본/_image/견본.png' : '/블록 견본/_image/Pasted image 20261120093000.png')),
    )
    expect(json).not.toContain('블록 견본/_image') // 볼트 안 경로는 결과물에 없다
  })
})

describe('이미지·설명 — 임시 볼트', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dumpster-vault-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))
  const put = (rel: string, content: string | Buffer) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), content)
  }
  const png = readFileSync(join(vaultDir, '블록 견본/_image/견본.png'))
  put('공개/_image/공개.png', png)
  put('공개/_image/같은이름.png', png)
  put('비공개/비밀.png', Buffer.concat([png, Buffer.from('x')]))
  put('비공개/같은이름.png', Buffer.from('비공개 쪽'))
  put('공개/OT.md', '---\ntype: manifest\n---\n첫 문단이\n설명이 된다\n\n둘째 문단')
  put('공개/글.md', '---\nprev: "[[OT]]"\n---\n![[공개.png]]\n\n![[비밀.png]]\n\n![[진짜 없음.png]]\n\n![[같은이름.png]]')
  const built = build(['공개'], dir)
  const blocks = built.graph.docs.find((d) => d.title === '글')!.blocks

  it('공개 폴더 아래만 찾는다 — 비공개 폴더 이미지는 없는 이미지와 똑같이', () => {
    expect(blocks.map((b) => b.type)).toEqual(['image', 'unsupported', 'unsupported', 'image'])
    expect(blocks[1]).toEqual({ type: 'unsupported', raw: '![[비밀.png]]', reason: '이미지를 찾을 수 없음' })
    expect(blocks[2]).toEqual({ type: 'unsupported', raw: '![[진짜 없음.png]]', reason: '이미지를 찾을 수 없음' })
    expect(built.report.privateRefs).toEqual(['글 → ![[비밀.png]] (image)'])
    expect(built.report.missingRefs).toEqual(['글 → ![[진짜 없음.png]] (image)'])
  })

  it('같은 이름이 비공개 폴더에도 있으면 공개 쪽, 내용이 같은 파일은 복사본 하나', () => {
    expect(blocks[3]).toMatchObject({ type: 'image', src: (blocks[0] as { src: string }).src })
    expect(built.assets).toHaveLength(1)
    expect(built.assets[0].file).toBe(join(dir, '공개/_image/공개.png'))
  })

  it('매니페스트에 description이 없으면 컬렉션 설명 = 첫 문단 (줄바꿈은 공백으로)', () => {
    expect(built.graph.collections[0].description).toBe('첫 문단이 설명이 된다')
  })
})
