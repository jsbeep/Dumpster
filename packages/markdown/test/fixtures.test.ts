import { describe, expect, it } from 'vitest'
import { parseMarkdown, type ParseContext } from '../src'
import ot from '../../../fixtures/vault/블록 견본/OT.블록 견본.md?raw'
import text from '../../../fixtures/vault/블록 견본/글자와 문단.md?raw'
import lists from '../../../fixtures/vault/블록 견본/리스트와 인용.md?raw'
import tables from '../../../fixtures/vault/블록 견본/표와 코드.md?raw'
import images from '../../../fixtures/vault/블록 견본/이미지와 임베드.md?raw'
import comments from '../../../fixtures/vault/블록 견본/주석과 HTML.md?raw'
import traps from '../../../fixtures/vault/블록 견본/함정 모음.md?raw'
import parseSrc from '../src/parse.ts?raw'
import commentsSrc from '../src/comments.ts?raw'
import slugSrc from '../src/slug.ts?raw'
import wikilinkSrc from '../src/wikilink.ts?raw'
import indexSrc from '../src/index.ts?raw'

// 블록 견본 컬렉션(fixtures/vault/블록 견본) 정답. golden/*.json이 fixture별 정답 JSON —
// 파서 출력이 바뀌면 diff를 눈으로 확인하고 `pnpm vitest run -u`로 갱신한다.
const DOCS = ['도커 설치', 'os 설치', '글자와 문단']
const IMAGES = ['견본.png', 'pasted image 20261120093000.png']
const ctx: ParseContext = {
  resolveDoc: (label) => (DOCS.includes(label.toLowerCase()) ? `doc:${label}` : null),
  resolveAsset: (name) => (IMAGES.includes(name.toLowerCase()) ? { src: `assets/${name}` } : null),
  selfId: 'doc:self',
}
const body = (raw: string) => raw.replace(/^---\n[\s\S]*?\n---\n/, '')
const parse = (raw: string) => parseMarkdown(body(raw), ctx)

describe('블록 견본 정답 JSON', () => {
  it.each([
    ['OT.블록 견본', ot],
    ['글자와 문단', text],
    ['리스트와 인용', lists],
    ['표와 코드', tables],
    ['이미지와 임베드', images],
    ['주석과 HTML', comments],
    ['함정 모음', traps],
  ])('%s', async (name, raw) => {
    await expect(`${JSON.stringify(parse(raw), null, 2)}\n`).toMatchFileSnapshot(`./golden/${name}.json`)
  })

  it('§4 표의 블록 타입이 견본에 전부 나온다', () => {
    const types = new Set<string>()
    const visit = (blocks: ReturnType<typeof parse>['blocks']) => {
      for (const b of blocks) {
        types.add(b.type)
        if (b.type === 'list') b.items.forEach((i) => visit(i.children))
        if (b.type === 'blockquote' || b.type === 'callout') visit(b.children)
      }
    }
    for (const raw of [ot, text, lists, tables, images, comments, traps]) visit(parse(raw).blocks)
    expect([...types].sort()).toEqual(
      ['blockquote', 'bookmark', 'callout', 'code', 'embed', 'heading', 'hr', 'image', 'list', 'paragraph', 'table', 'unsupported'].sort(),
    )
  })

  it('주석 내용은 결과 어디에도 없다', () => {
    const json = JSON.stringify(parse(comments))
    expect(json).not.toContain('카나리아')
    expect(json).not.toContain('안 보여야 하는 헤딩')
    expect(json).not.toContain('<!--')
  })
})

describe('함정 4개', () => {
  const blocks = parse(traps).blocks
  const after = (heading: string) => blocks.slice(blocks.findIndex((b) => b.type === 'heading' && b.inlines.some((i) => i.text.includes(heading))) + 1)

  it('① 콜아웃 코드펜스에 > 빠진 줄 → 옵시디언(CommonMark)처럼 거기서 콜아웃과 코드가 끝난다', () => {
    const [callout, stray, rest] = after('①')
    expect(callout).toEqual({
      type: 'callout',
      kind: 'abstract',
      title: [{ text: '메타데이터 예시' }],
      fold: 'closed',
      children: [
        { type: 'paragraph', inlines: [{ text: '노션에서 복사한 속성' }] },
        { type: 'code', language: 'yaml', text: 'title: 블로그 문서' }, // > 빠진 줄 앞에서 잘림
      ],
    })
    expect(stray).toEqual({ type: 'paragraph', inlines: [{ text: 'tags: [메모, 설계]' }] }) // 인용 밖 문단
    // 남은 > 줄은 콜아웃이 아닌 그냥 인용. 닫는 ```가 새 코드를 열어 마지막 문장을 삼킨다
    expect(rest).toEqual({
      type: 'blockquote',
      children: [
        { type: 'paragraph', inlines: [{ text: 'createdAt: 2026-11-20' }] },
        { type: 'code', language: null, text: '콜아웃 끝 문장' },
      ],
    })
    expect(parse(traps).warnings).toEqual([
      "4번째 줄 코드 펜스가 안 닫힘 (인용·콜아웃 안이면 '>' 빠진 줄 때문일 수 있음)",
      "8번째 줄 코드 펜스가 안 닫힘 (인용·콜아웃 안이면 '>' 빠진 줄 때문일 수 있음)",
    ])
  })

  it('② 표 안 [[a\\|b]] → 셀이 안 갈라지고 별칭 링크 하나', () => {
    const [table] = after('②')
    expect(table).toMatchObject({ type: 'table', align: [null, null] })
    if (table.type !== 'table') throw new Error()
    expect(table.rows[0]).toEqual([
      [{ text: '도커', link: { kind: 'doc', docId: 'doc:도커 설치' } }],
      [{ text: '별칭의 ' }, { text: '|', code: true }, { text: '는 이스케이프해야 표가 안 깨짐' }],
    ])
    expect(table.rows[1][0]).toEqual([{ text: 'OS 설치', link: { kind: 'doc', docId: 'doc:OS 설치' } }])
  })

  it('③ 붙여넣은 <div class="..."> → HTML로 그리지 않고 원문 글자 문단 (<br>만 줄바꿈)', () => {
    const [div] = after('③')
    expect(div).toEqual({
      type: 'paragraph',
      inlines: [
        {
          text: [
            '<div class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">',
            '  <p class="text-sm font-semibold text-slate-900">요금제 비교</p>',
            '  <span class="text-xs text-slate-500">월 9,900원',
            '연 99,000원</span>',
            '</div>',
          ].join('\n'),
        },
      ],
    })
  })

  it('④ 파일 이름만으로 임베드한 이미지 → resolveAsset(이름)으로 찾은 image', () => {
    const [image] = after('④')
    expect(image).toEqual({
      type: 'image',
      src: 'assets/Pasted image 20261120093000.png',
      alt: 'Pasted image 20261120093000.png',
      width: null,
      height: null,
    })
  })
})

describe('순수성 — 브라우저 플레이그라운드에서 그대로 돌아야 한다', () => {
  it.each([
    ['parse.ts', parseSrc],
    ['comments.ts', commentsSrc],
    ['slug.ts', slugSrc],
    ['wikilink.ts', wikilinkSrc],
    ['index.ts', indexSrc],
  ])('%s는 fs·path·process·git을 안 쓴다', (_, src) => {
    expect(src).not.toMatch(/from ['"](node:|fs|path|child_process|os)['"/]/)
    expect(src).not.toMatch(/\bprocess\.|\brequire\(|\bimport\(/)
  })
})
