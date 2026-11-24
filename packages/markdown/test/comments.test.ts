import { describe, expect, it } from 'vitest'
import { blocksToText } from '@dumpster/schema'
import { parseMarkdown, stripComments } from '../src'

// %%주석%%은 공개 금지 — 결과물 어디에도(블록·경고·ref) 남으면 안 된다
const leaks = (md: string, secret = '비밀') => JSON.stringify(parseMarkdown(md)).includes(secret)
const text = (md: string) => blocksToText(parseMarkdown(md).blocks)

describe('%% 주석 제거', () => {
  it('인라인 — 앞뒤 글자는 이어지고 공백 두 칸이 안 남는다', () => {
    expect(text('앞 %%비밀%% 뒤')).toBe('앞 뒤')
    expect(text('붙여%%비밀%%씀')).toBe('붙여씀')
  })

  it('주석만 있던 줄은 줄째로 사라져 문단이 안 갈라진다', () => {
    expect(parseMarkdown('윗줄\n%%비밀%%\n아랫줄').blocks).toEqual([{ type: 'paragraph', inlines: [{ text: '윗줄\n아랫줄' }] }])
  })

  it('여러 줄 — 안에 리스트·코드·헤딩이 있어도 통째로', () => {
    const md = '앞\n\n%%\n비밀 1\n- 비밀 2\n```\n비밀 3\n```\n# 비밀 4\n%%\n\n뒤'
    expect(text(md)).toBe('앞\n뒤')
    expect(leaks(md)).toBe(false)
  })

  it('인용·콜아웃 안 (줄마다 > 붙은 여러 줄 포함)', () => {
    expect(parseMarkdown('> 앞 %%비밀%%\n> %%비밀\n> 비밀%%\n> 뒤').blocks).toEqual([
      { type: 'blockquote', children: [{ type: 'paragraph', inlines: [{ text: '앞\n뒤' }] }] },
    ])
    expect(leaks('> [!note] 제목 %%비밀%%\n> 본문')).toBe(false)
  })

  it('표·헤딩·리스트·링크 안', () => {
    for (const md of ['| a %%비밀%% |\n|---|\n| %%비밀%%b |', '## 제목 %%비밀%%', '- 항목 %%비밀%%', '[글자 %%비밀%%](https://a.com)', '[[도커 설치|별칭 %%비밀%%]]']) {
      expect(leaks(md), md).toBe(false)
    }
  })

  it('닫히지 않은 %%는 문서 끝까지 지우고 경고', () => {
    const r = parseMarkdown('보임\n\n%% 비밀\n\n# 비밀 헤딩\n\n비밀 문단')
    expect(r.blocks).toEqual([{ type: 'paragraph', inlines: [{ text: '보임' }] }])
    expect(r.warnings).toEqual(['닫는 %% 없음 → 문서 끝까지 주석으로 지움'])
  })

  it('코드 블록·인라인 코드 안의 %%는 옵시디언처럼 글자 그대로', () => {
    expect(parseMarkdown('```bat\nfor %%i in (*) do echo %%i\n```\n\n`100%%` 와 `%%`').blocks).toEqual([
      { type: 'code', language: 'bat', text: 'for %%i in (*) do echo %%i' },
      { type: 'paragraph', inlines: [{ text: '100%%', code: true }, { text: ' 와 ' }, { text: '%%', code: true }] },
    ])
  })

  it('주석이 코드펜스를 품고 시작하면 펜스 보호보다 주석이 먼저', () => {
    // 첫 %%가 열리면 다음 %%(코드 안이라도)까지 주석 — 옵시디언과 같은 순서
    const md = '%% 비밀\n```\n비밀 코드 %% 보임\n```'
    expect(leaks(md)).toBe(false)
    expect(text(md)).toContain('보임')
  })

  it('지켜둔 코드 안 %%가 재파싱 후 코드 밖으로 나오면 코드 안까지 다 지운다 (유출 방지)', () => {
    // 주석이 여는 펜스를 먹어서, 원래 코드였던 줄이 문단이 되는 경우
    const md = '%%\n```\n%%\n비밀이 섞인 %%보호됐던 줄\n```'
    const r = parseMarkdown(md)
    expect(JSON.stringify(r.blocks)).not.toContain('%%')
    expect(JSON.stringify(r.blocks)).not.toContain('보호됐던')
  })

  it('stripComments 단독: 보호 범위, 개수, 닫힘 여부', () => {
    expect(stripComments('a %%x%% b `%%` c', [[10, 14]])).toEqual({ text: 'a b `%%` c', removed: 1, unclosed: false })
    expect(stripComments('a %%x')).toEqual({ text: 'a ', removed: 1, unclosed: true })
  })
})
