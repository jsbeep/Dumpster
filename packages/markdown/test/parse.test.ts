import { describe, expect, it } from 'vitest'
import type { Block, Inline } from '@dumpster/schema'
import { parseMarkdown, slugifyHeading, type ParseContext } from '../src'

// 문법별 단위 테스트. 문서·이미지 해석은 가짜 ctx로 (빌더 없이도 파서만 돈다)
const ctx: ParseContext = {
  resolveDoc: (label) => ({ '도커 설치': 'docker', 'os 설치': 'os', '폴더/깊은 문서': 'deep' })[label.toLowerCase()] ?? null,
  resolveAsset: (name) => (name.includes('없는') ? null : { src: `assets/${name.split('/').pop()}` }),
  selfId: 'self',
}
const parse = (md: string, c: ParseContext = ctx) => parseMarkdown(md, c)
const blocks = (md: string) => parse(md).blocks
const inlines = (md: string): Inline[] => {
  const [b] = blocks(md)
  if (b?.type !== 'paragraph') throw new Error(`문단이 아님: ${JSON.stringify(b)}`)
  return b.inlines
}

describe('문단과 줄바꿈', () => {
  it('줄바꿈 1번은 문단 안 \\n으로 남는다 (옵시디언 기본)', () => {
    expect(blocks('첫 줄\n둘째 줄\n\n새 문단')).toEqual([
      { type: 'paragraph', inlines: [{ text: '첫 줄\n둘째 줄' }] },
      { type: 'paragraph', inlines: [{ text: '새 문단' }] },
    ])
  })

  it('강제 줄바꿈(공백 2칸·백슬래시)도 \\n', () => {
    expect(inlines('a  \nb\\\nc')).toEqual([{ text: 'a\nb\nc' }])
  })

  it('CRLF도 같게', () => {
    expect(blocks('a\r\nb')).toEqual(blocks('a\nb'))
  })
})

describe('인라인 서식', () => {
  it('플래그는 true일 때만 들어간다', () => {
    expect(inlines('**굵게** *기울임* `코드` ~~취소~~ ==형광==')).toEqual([
      { text: '굵게', bold: true },
      { text: ' ' },
      { text: '기울임', italic: true },
      { text: ' ' },
      { text: '코드', code: true },
      { text: ' ' },
      { text: '취소', strike: true },
      { text: ' ' },
      { text: '형광', highlight: true },
    ])
  })

  it('서식이 같은 인접 조각은 합친다', () => {
    expect(inlines('**a**__b__ 그리고 _c_*d*')).toEqual([
      { text: 'ab', bold: true },
      { text: ' 그리고 ' },
      { text: 'cd', italic: true },
    ])
  })

  it('겹친 서식', () => {
    expect(inlines('***둘 다*** **굵은 `코드`**')).toEqual([
      { text: '둘 다', bold: true, italic: true },
      { text: ' ' },
      { text: '굵은 ', bold: true },
      { text: '코드', bold: true, code: true },
    ])
  })

  it('~한 개~는 취소선이 아니다 (옵시디언)', () => {
    expect(inlines('~a~ ~~b~~')).toEqual([{ text: '~a~ ' }, { text: 'b', strike: true }])
  })

  it('==하이라이트==는 다른 서식을 넘나든다', () => {
    expect(inlines('==a **b** c== d')).toEqual([
      { text: 'a ', highlight: true },
      { text: 'b', bold: true, highlight: true },
      { text: ' c', highlight: true },
      { text: ' d' },
    ])
  })

  it.each([
    ['a == b', '띄운 등호'],
    ['a === b ===', '등호 3개'],
    ['==닫히지 않음', '짝 없음'],
    ['== 앞이 공백==', '여는 쪽 뒤가 공백'],
  ])('%s → 글자 그대로 (%s)', (md) => {
    expect(inlines(md)).toEqual([{ text: md }])
  })

  it('코드 안 ==는 문법이 아니다', () => {
    expect(inlines('`==x==`')).toEqual([{ text: '==x==', code: true }])
  })

  it('바깥 링크·맨 주소', () => {
    expect(inlines('[글자](https://a.com) https://b.com')).toEqual([
      { text: '글자', link: { kind: 'url', href: 'https://a.com' } },
      { text: ' ' },
      { text: 'https://b.com', link: { kind: 'url', href: 'https://b.com' } },
    ])
  })
})

describe('[[위키링크]]', () => {
  it('보이는 글자: 별칭 > 문서 이름, 헤딩은 "문서 > 헤딩"', () => {
    expect(inlines('[[도커 설치]] [[도커 설치|도커]] [[도커 설치#설치 명령]] [[도커 설치#설치 명령|명령]]')).toEqual([
      { text: '도커 설치', link: { kind: 'doc', docId: 'docker' } },
      { text: ' ' },
      { text: '도커', link: { kind: 'doc', docId: 'docker' } },
      { text: ' ' },
      { text: '도커 설치 > 설치 명령', link: { kind: 'doc', docId: 'docker', heading: '설치-명령' } },
      { text: ' ' },
      { text: '명령', link: { kind: 'doc', docId: 'docker', heading: '설치-명령' } },
    ])
  })

  it('같은 문서 헤딩 [[#헤딩]]은 selfId로, 엣지(ref)는 안 만든다', () => {
    const r = parse('[[#큰 제목#작은 제목]]')
    expect(r.blocks).toEqual([
      { type: 'paragraph', inlines: [{ text: '큰 제목 > 작은 제목', link: { kind: 'doc', docId: 'self', heading: '작은-제목' } }] },
    ])
    expect(r.refs).toEqual([])
  })

  it('없는 문서는 docId null, ref는 대상 이름별로 하나', () => {
    const r = parse('[[없는 글]] [[도커 설치]] [[도커 설치|또]] [[없는 글#헤딩]] [[OS 설치.md]]')
    expect(r.refs).toEqual([
      { label: '없는 글', relation: 'link', target: null },
      { label: '도커 설치', relation: 'link', target: 'docker' },
      { label: 'OS 설치', relation: 'link', target: 'os' },
    ])
    if (r.blocks[0].type !== 'paragraph') throw new Error()
    expect(r.blocks[0].inlines[0]).toEqual({ text: '없는 글', link: { kind: 'doc', docId: null } })
  })

  it('경로 링크, 서식 안 링크', () => {
    expect(inlines('**[[폴더/깊은 문서]]**')).toEqual([{ text: '폴더/깊은 문서', bold: true, link: { kind: 'doc', docId: 'deep' } }])
  })

  it('블록 참조 [[문서#^id]]는 문서 링크로 + 경고', () => {
    const r = parse('[[도커 설치#^abc123]]')
    expect(r.blocks).toEqual([{ type: 'paragraph', inlines: [{ text: '도커 설치', link: { kind: 'doc', docId: 'docker' } }] }])
    expect(r.warnings).toEqual(['블록 참조 미지원 → 문서 링크로: [[도커 설치#^abc123]]'])
  })

  it('코드·마크다운 링크 글자 안의 [[ ]]는 그대로', () => {
    expect(inlines('`[[도커 설치]]` [[[도커 설치]]](https://x.com)')).toEqual([
      { text: '[[도커 설치]]', code: true },
      { text: ' ' },
      { text: '[[도커 설치]]', link: { kind: 'url', href: 'https://x.com' } },
    ])
  })

  it('마크다운식 내부 링크 [글자](문서.md), [글자](#헤딩)', () => {
    const r = parse('[깔기](도커%20설치.md) [위로](#맨 위)')
    expect(r.blocks[0]).toEqual({
      type: 'paragraph',
      inlines: [
        { text: '깔기', link: { kind: 'doc', docId: 'docker' } },
        { text: ' [위로](#맨 위)' }, // 공백 있는 주소는 CommonMark상 링크가 아님
      ],
    })
    expect(r.refs).toEqual([{ label: '도커 설치', relation: 'link', target: 'docker' }])
  })

  it('[[이미지.png]] (느낌표 없음)는 이미지로 가는 링크 — 문서 엣지 아님', () => {
    const r = parse('[[그림.png]]')
    expect(r.blocks[0]).toEqual({ type: 'paragraph', inlines: [{ text: '그림.png', link: { kind: 'url', href: 'assets/그림.png' } }] })
    expect(r.refs).toEqual([])
  })
})

describe('이미지와 임베드', () => {
  it('![[x.png|447]] / |447x300 / |대체 글자', () => {
    expect(blocks('![[a.png|447]]\n\n![[a.png|447x300]]\n\n![[a.png|고양이]]')).toEqual([
      { type: 'image', src: 'assets/a.png', alt: 'a.png', width: 447, height: null },
      { type: 'image', src: 'assets/a.png', alt: 'a.png', width: 447, height: 300 },
      { type: 'image', src: 'assets/a.png', alt: '고양이', width: null, height: null },
    ])
  })

  it('문장 중간 이미지는 문단을 쪼갠다', () => {
    expect(blocks('앞 글자 ![[a.png|100]] 뒷 글자\n다음 줄')).toEqual([
      { type: 'paragraph', inlines: [{ text: '앞 글자' }] },
      { type: 'image', src: 'assets/a.png', alt: 'a.png', width: 100, height: null },
      { type: 'paragraph', inlines: [{ text: '뒷 글자\n다음 줄' }] },
    ])
  })

  it('이미지가 줄마다 있으면 이미지 블록만 연달아', () => {
    expect(blocks('![[a.png]]\n![[b.png]]').map((b) => b.type)).toEqual(['image', 'image'])
  })

  it('리스트 항목 안 이미지는 children으로', () => {
    expect(blocks('- 글자 ![[a.png|64]]')).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [{ inlines: [{ text: '글자' }], children: [{ type: 'image', src: 'assets/a.png', alt: 'a.png', width: 64, height: null }] }],
      },
    ])
  })

  it('표 셀·헤딩 안 이미지는 이미지로 가는 링크 글자 + 경고', () => {
    // 표 안에선 크기 구분자도 \| (옵시디언과 같음)
    const r = parse('## 제목 ![[a.png]]\n\n| x |\n|---|\n| ![[a.png\\|20]] |')
    expect(r.blocks[0]).toEqual({
      type: 'heading',
      level: 2,
      anchor: '제목-apng',
      inlines: [{ text: '제목 ' }, { text: 'a.png', link: { kind: 'url', href: 'assets/a.png' } }],
    })
    expect(r.blocks[1]).toMatchObject({ type: 'table', rows: [[[{ text: 'a.png', link: { kind: 'url', href: 'assets/a.png' } }]]] })
    expect(r.warnings).toEqual(['헤딩 안 이미지·임베드는 링크 글자로 바꿈', '표 안 이미지·임베드는 링크 글자로 바꿈'])
  })

  it('못 찾은 이미지 → unsupported (비공개 폴더 이미지와 구분 안 됨)', () => {
    expect(blocks('![[없는 그림.png]]')).toEqual([{ type: 'unsupported', raw: '![[없는 그림.png]]', reason: '이미지를 찾을 수 없음' }])
    // ctx 없이 (플레이그라운드 기본값)
    expect(parse('![[a.png]]', {}).blocks).toEqual([{ type: 'unsupported', raw: '![[a.png]]', reason: '이미지를 찾을 수 없음' }])
  })

  it('마크다운 이미지: 바깥 주소는 그대로, |폭, 상대 경로는 볼트에서', () => {
    expect(blocks('![고양이|200](https://x.com/cat.png)\n\n![](_image/a%20b.png)')).toEqual([
      { type: 'image', src: 'https://x.com/cat.png', alt: '고양이', width: 200, height: null },
      { type: 'image', src: 'assets/a b.png', alt: 'a b.png', width: null, height: null },
    ])
  })

  it('![[문서]] → embed + embed ref', () => {
    const r = parse('![[도커 설치]]\n\n![[없는 글|별칭]]')
    expect(r.blocks).toEqual([
      { type: 'embed', docId: 'docker', label: '도커 설치' },
      { type: 'embed', docId: null, label: '별칭' },
    ])
    expect(r.refs).toEqual([
      { label: '도커 설치', relation: 'embed', target: 'docker' },
      { label: '없는 글', relation: 'embed', target: null },
    ])
  })

  it('pdf·동영상 임베드는 unsupported + 경고', () => {
    const r = parse('![[발표.pdf]]')
    expect(r.blocks).toEqual([{ type: 'unsupported', raw: '![[발표.pdf]]', reason: '임베드 미지원' }])
    expect(r.refs).toEqual([])
    expect(r.warnings).toEqual(['임베드 미지원 → 원문 그대로: ![[발표.pdf]]'])
  })
})

describe('헤딩 앵커', () => {
  it('GitHub식 slug, 같은 제목은 -1, -2', () => {
    expect(blocks('# 같은 제목\n## 같은 제목\n### 같은 제목\n#### Hello, World! (v2)').map((b) => (b as { anchor: string }).anchor)).toEqual([
      '같은-제목',
      '같은-제목-1',
      '같은-제목-2',
      'hello-world-v2',
    ])
  })

  it.each([
    ['  앞뒤 공백  ', '앞뒤-공백'],
    ['C++ & Rust', 'c--rust'],
    ['snake_case-이름', 'snake_case-이름'],
    ['①번 함정', '①번-함정'],
  ])('slugifyHeading(%j) = %j', (input, expected) => {
    expect(slugifyHeading(input)).toBe(expected)
  })

  it('헤딩 안 서식·링크는 글자로 slug', () => {
    expect(blocks('## **굵은** [[도커 설치|도커]]')[0]).toMatchObject({ anchor: '굵은-도커' })
  })
})

describe('리스트', () => {
  it('탭 들여쓰기 4단', () => {
    const nest = (text: string, children: Block[] = []) => ({ inlines: [{ text }], children })
    const list = (...items: ReturnType<typeof nest>[]): Block => ({ type: 'list', ordered: false, items })
    expect(blocks('- 1\n\t- 2\n\t\t- 3\n\t\t\t- 4\n- 다시 1')).toEqual([
      list(nest('1', [list(nest('2', [list(nest('3', [list(nest('4'))]))]))]), nest('다시 1')),
    ])
  })

  it('번호 목록 start, 할 일 checked', () => {
    expect(blocks('3. 셋\n4. 넷\n\n- [ ] 안 함\n- [x] 함\n- 그냥')).toEqual([
      { type: 'list', ordered: true, start: 3, items: [{ inlines: [{ text: '셋' }], children: [] }, { inlines: [{ text: '넷' }], children: [] }] },
      {
        type: 'list',
        ordered: false,
        items: [
          { inlines: [{ text: '안 함' }], checked: false, children: [] },
          { inlines: [{ text: '함' }], checked: true, children: [] },
          { inlines: [{ text: '그냥' }], children: [] },
        ],
      },
    ])
  })

  it('항목 안 이어 쓴 줄은 \\n, 둘째 문단·코드는 children', () => {
    expect(blocks('- 첫 줄\n  둘째 줄\n\n  둘째 문단\n  ```\n  코드\n  ```')).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          {
            inlines: [{ text: '첫 줄\n둘째 줄' }],
            children: [
              { type: 'paragraph', inlines: [{ text: '둘째 문단' }] },
              { type: 'code', language: null, text: '코드' },
            ],
          },
        ],
      },
    ])
  })
})

describe('인용과 콜아웃', () => {
  it('인용 안 리스트·코드', () => {
    expect(blocks('> 인용\n> - 항목\n> ```sh\n> echo hi\n> ```')).toEqual([
      {
        type: 'blockquote',
        children: [
          { type: 'paragraph', inlines: [{ text: '인용' }] },
          { type: 'list', ordered: false, items: [{ inlines: [{ text: '항목' }], children: [] }] },
          { type: 'code', language: 'sh', text: 'echo hi' },
        ],
      },
    ])
  })

  it.each([
    ['> [!note] 제목', 'note', 'none'],
    ['> [!tip]+ 제목', 'tip', 'open'],
    ['> [!abstract]- 제목', 'abstract', 'closed'],
    ['> [!WARNING] 제목', 'warning', 'none'],
    ['> [!faq|wide]- 제목', 'faq', 'closed'],
  ])('%s → kind %s, fold %s', (md, kind, fold) => {
    expect(blocks(md)).toEqual([{ type: 'callout', kind, title: [{ text: '제목' }], fold, children: [] }])
  })

  it('제목 없는 콜아웃은 title [] (기본 제목은 렌더러 몫), 둘째 줄부터 본문', () => {
    expect(blocks('> [!info]\n> 본문 **굵게**\n> 둘째 줄')).toEqual([
      {
        type: 'callout',
        kind: 'info',
        title: [],
        fold: 'none',
        children: [{ type: 'paragraph', inlines: [{ text: '본문 ' }, { text: '굵게', bold: true }, { text: '\n둘째 줄' }] }],
      },
    ])
  })

  it('제목 안 서식·링크, 콜아웃 안 콜아웃', () => {
    expect(blocks('> [!note] **중요** [[도커 설치]]\n> > [!tip] 안쪽\n> > 내용')).toEqual([
      {
        type: 'callout',
        kind: 'note',
        title: [{ text: '중요', bold: true }, { text: ' ' }, { text: '도커 설치', link: { kind: 'doc', docId: 'docker' } }],
        fold: 'none',
        children: [{ type: 'callout', kind: 'tip', title: [{ text: '안쪽' }], fold: 'none', children: [{ type: 'paragraph', inlines: [{ text: '내용' }] }] }],
      },
    ])
  })

  it('첫 줄이 아니면 콜아웃이 아니다', () => {
    expect(blocks('> 앞 줄\n> [!note] 뒤')).toEqual([{ type: 'blockquote', children: [{ type: 'paragraph', inlines: [{ text: '앞 줄\n[!note] 뒤' }] }] }])
  })
})

describe('코드·카드 링크·표·구분선', () => {
  it('코드 언어 있음/없음/들여쓰기', () => {
    expect(blocks('```ts title="a.ts"\nconst a = 1\n```\n\n```\n없음\n```\n\n    들여쓴 코드')).toEqual([
      { type: 'code', language: 'ts', text: 'const a = 1' },
      { type: 'code', language: null, text: '없음' },
      { type: 'code', language: null, text: '들여쓴 코드' },
    ])
  })

  it('```cardlink → bookmark', () => {
    const md = '```cardlink\nurl: https://a.com/x\ntitle: "제목: 콜론"\ndescription: 설명\nhost: a.com\nfavicon: https://a.com/f.ico\n```'
    expect(blocks(md)).toEqual([
      { type: 'bookmark', href: 'https://a.com/x', title: '제목: 콜론', description: '설명', icon: 'https://a.com/f.ico', image: null },
    ])
  })

  it('url 없는 cardlink는 코드 블록 그대로 + 경고', () => {
    const r = parse('```cardlink\ntitle: 없음\n```')
    expect(r.blocks).toEqual([{ type: 'code', language: 'cardlink', text: 'title: 없음' }])
    expect(r.warnings).toEqual(['cardlink에 url 없음 → 코드 블록으로 둠'])
  })

  it('표: 정렬, 셀 <br> → \\n, 모자란 셀은 빈 칸으로 채움', () => {
    expect(blocks('| a | b | c |\n|:--|:-:|--:|\n| 1<br>2 | x<BR/>y |\n')).toEqual([
      {
        type: 'table',
        align: ['left', 'center', 'right'],
        header: [[{ text: 'a' }], [{ text: 'b' }], [{ text: 'c' }]],
        rows: [[[{ text: '1\n2' }], [{ text: 'x\ny' }], []]],
      },
    ])
  })

  it('---는 hr, 글 바로 밑 ---는 CommonMark처럼 헤딩', () => {
    expect(blocks('위\n\n---\n\n아래\n---')).toEqual([
      { type: 'paragraph', inlines: [{ text: '위' }] },
      { type: 'hr' },
      { type: 'heading', level: 2, anchor: '아래', inlines: [{ text: '아래' }] },
    ])
  })
})

describe('생 HTML — 렌더하지 않고 글자로', () => {
  it('인라인 태그는 글자 그대로, <br>만 줄바꿈', () => {
    expect(inlines('<span class="red">빨강</span><br>다음 <u>밑줄</u>')).toEqual([
      { text: '<span class="red">빨강</span>\n다음 <u>밑줄</u>' },
    ])
  })

  it('HTML 블록은 원문 글자 문단', () => {
    expect(blocks('<div class="p-4">\n  <b>안</b>\n</div>')).toEqual([{ type: 'paragraph', inlines: [{ text: '<div class="p-4">\n  <b>안</b>\n</div>' }] }])
  })

  it('<!-- -->는 옵시디언에서도 안 보이므로 지운다', () => {
    expect(blocks('<!-- 비밀 -->\n\n앞 <!-- 비밀2 --> 뒤\n\n<!--\n여러\n\n줄\n-->')).toEqual([{ type: 'paragraph', inlines: [{ text: '앞  뒤' }] }])
  })
})

describe('미지원 문법 → unsupported / 글자 + 경고', () => {
  it('수식 블록 $$', () => {
    const r = parse('$$\na_1 + b_1\n$$')
    expect(r.blocks).toEqual([{ type: 'unsupported', raw: '$$\na_1 + b_1\n$$', reason: '수식' }])
    expect(r.warnings).toEqual(['수식 블록 미지원 → 원문 그대로'])
  })

  it('인라인 수식은 글자 그대로 + 경고, 돈 표시는 수식 아님', () => {
    expect(parse('값 $x^2$ 끝').warnings).toEqual(['인라인 수식 미지원 → 글자 그대로: $x^2$'])
    expect(parse('$5에서 $10으로').warnings).toEqual([])
    expect(parse('코드 안 `{ "$set": { "r": "$x" } }` 는 수식 아님').warnings).toEqual([]) // 실제 볼트에서 나온 오탐
  })

  it('각주', () => {
    const r = parse('본문[^1]\n\n[^1]: 각주 내용')
    expect(r.blocks).toEqual([
      { type: 'paragraph', inlines: [{ text: '본문[^1]' }] },
      { type: 'unsupported', raw: '[^1]: 각주 내용', reason: '각주' },
    ])
    expect(r.warnings).toEqual(['각주 미지원 → 원문 그대로'])
  })

  it('^block-id는 옵시디언처럼 숨김 + 경고', () => {
    const r = parse('문장 ^abc-1\n\n- 항목 ^xyz\n\n표 다음 줄\n^only')
    expect(r.blocks).toEqual([
      { type: 'paragraph', inlines: [{ text: '문장' }] },
      { type: 'list', ordered: false, items: [{ inlines: [{ text: '항목' }], children: [] }] },
      { type: 'paragraph', inlines: [{ text: '표 다음 줄' }] },
    ])
    expect(r.warnings).toEqual(['블록 ID 숨김 (블록 참조 미지원): ^abc-1', '블록 ID 숨김 (블록 참조 미지원): ^xyz', '블록 ID 숨김 (블록 참조 미지원): ^only'])
  })
})
