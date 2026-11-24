import type { Block } from '@dumpster/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BLOCK_VIEWS, BlockRenderer } from '../src'
import { kitchenSink } from '../src/samples/kitchenSink'

const html = (blocks: Block[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks} onOpenDoc={() => {}} />)

describe('BlockRenderer', () => {
  it('kitchenSink에 모든 블록 타입이 있고, 전부 렌더된다', () => {
    const types = new Set(kitchenSink.map((b) => b.type))
    expect([...types].sort()).toEqual(Object.keys(BLOCK_VIEWS).sort())
    expect(() => html(kitchenSink)).not.toThrow()
  })

  it('docId 있는 문서 링크는 #/d/{docId}, null이면 <a>가 아닌 회색 글자', () => {
    const out = html([
      {
        type: 'paragraph',
        inlines: [
          { text: '있음', link: { kind: 'doc', docId: '도커-2611041940' } },
          { text: '없음', link: { kind: 'doc', docId: null } },
        ],
      },
    ])
    expect(out).toContain(`href="#/d/${encodeURIComponent('도커-2611041940')}"`)
    expect(out).not.toMatch(/<a[^>]*>없음<\/a>/)
    expect(out).toMatch(/<span class="text-slate-400">없음<\/span>/)
  })

  it('HTML처럼 보이는 글자는 이스케이프된다', () => {
    const out = html([{ type: 'paragraph', inlines: [{ text: '<div class="bg-red-500">x</div><script>alert(1)</script>' }] }])
    expect(out).not.toContain('<div class="bg-red-500">')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;div class=&quot;bg-red-500&quot;&gt;')
  })

  it('heading은 진짜 h태그 + id, url 링크는 새 탭, javascript: 주소는 링크로 안 만든다', () => {
    const out = html([
      { type: 'heading', level: 3, anchor: '네트워크', inlines: [{ text: '네트워크' }] },
      {
        type: 'paragraph',
        inlines: [
          { text: '밖', link: { kind: 'url', href: 'https://example.com' } },
          { text: '나쁜', link: { kind: 'url', href: 'javascript:alert(1)' } },
        ],
      },
    ])
    expect(out).toMatch(/<h3 id="네트워크"[^>]*>네트워크<\/h3>/)
    expect(out).toMatch(/<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer"/)
    expect(out).not.toContain('javascript:')
  })

  it('콜아웃: fold none은 div, open/closed는 details(open 속성), 빈 제목은 종류 이름', () => {
    const out = html([
      { type: 'callout', kind: 'tip', title: [], fold: 'none', children: [] },
      { type: 'callout', kind: 'note', title: [{ text: '펼침' }], fold: 'open', children: [] },
      { type: 'callout', kind: 'note', title: [{ text: '접힘' }], fold: 'closed', children: [] },
    ])
    expect(out).toMatch(/<div[^>]*data-callout="tip"[^>]*>.*Tip/)
    expect(out).toMatch(/<details[^>]*open=""[^>]*data-callout="note"/)
    expect(out.match(/<details/g)).toHaveLength(2)
    expect(out.match(/open=""/g)).toHaveLength(1)
  })

  it('이미지 캡션은 Pasted image면 숨긴다', () => {
    const out = html([
      { type: 'image', src: 'a.png', alt: 'Pasted image 20261104.png', width: 447, height: null },
      { type: 'image', src: 'b.png', alt: '설명', width: null, height: null },
    ])
    expect(out.match(/<figcaption/g)).toHaveLength(1)
    expect(out).toContain('width="447"')
  })
})
