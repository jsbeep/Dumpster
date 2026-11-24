import { describe, expect, it } from 'vitest'
import { linkTarget, normalizeMeta, splitFrontmatter } from '../src/frontmatter'
import { normalizeCreatedAt } from '../src/dates'

describe('createdAt — 실제 볼트에 있는 형식들', () => {
  it.each([
    ['2026-11-11-14:01', '2026-11-11T14:01:00+09:00'], // 템플릿
    ['2026-07-10T22:45:00', '2026-07-10T22:45:00+09:00'], // ISO 오프셋 없음 → KST
    ['2026-07-07', '2026-07-07T00:00:00+09:00'], // 날짜만
    ['2026-11-03T01:00:00Z', '2026-11-03T10:00:00+09:00'], // UTC → KST
    ['2026-11-03T10:00:00+0900', '2026-11-03T10:00:00+09:00'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCreatedAt(input)).toBe(expected)
  })

  it('모르는 형식은 null', () => {
    expect(normalizeCreatedAt('어제')).toBeNull()
    expect(normalizeCreatedAt(null)).toBeNull()
  })
})

describe('linkTarget', () => {
  it.each([
    ['[[도커 설치]]', '도커 설치'],
    ['[[도커 설치|도커]]', '도커 설치'],
    ['[[도커 설치#설치 명령]]', '도커 설치'],
    ['도커 설치', '도커 설치'], // 괄호 없이 적어도 받아줌
    [[['도커 설치']], '도커 설치'], // 따옴표 없는 prev: [[도커 설치]] → YAML 중첩 배열
    ['', null],
  ])('%j → %s', (input, expected) => {
    expect(linkTarget(input)).toBe(expected)
  })
})

describe('splitFrontmatter', () => {
  it('첫 줄이 --- 일 때만', () => {
    expect(splitFrontmatter('본문\n---\na: 1\n---').data).toBeNull()
    expect(splitFrontmatter('---\nprev: "[[a]]"\n---\n본문')).toEqual({ data: { prev: '[[a]]' }, body: '본문' })
  })

  it('빈 frontmatter는 빈 객체, 닫는 --- 없으면 경고', () => {
    expect(splitFrontmatter('---\n---\n본문').data).toEqual({})
    expect(splitFrontmatter('---\na: 1\n본문').warning).toContain('닫는 ---')
  })
})

describe('normalizeMeta', () => {
  it('빈 값들은 빈 배열·null로', () => {
    const warnings: string[] = []
    expect(normalizeMeta({ prev: null, tags: null, aliases: null, description: null }, (w) => warnings.push(w))).toEqual({
      kind: 'doc',
      prev: null,
      branch: [],
      seeAlso: [],
      order: null,
      tags: [],
      aliases: [],
      description: null,
      createdAt: null,
    })
    expect(warnings).toEqual([])
  })

  it('see_also는 문자열·리스트 둘 다, 태그 # 제거·중복 제거', () => {
    const meta = normalizeMeta({ see_also: '[[a]]', tags: ['#설계', '설계', 'blog'] }, () => {})
    expect(meta.seeAlso).toEqual(['a'])
    expect(meta.tags).toEqual(['설계', 'blog'])
    expect(normalizeMeta({ see_also: ['[[a]]', '[[b]]'] }, () => {}).seeAlso).toEqual(['a', 'b'])
  })

  it('prev가 여러 개면 첫 번째 + 경고, 모르는 type은 doc + 경고', () => {
    const warnings: string[] = []
    const meta = normalizeMeta({ prev: ['[[a]]', '[[b]]'], type: 'retro', order: 1 }, (w) => warnings.push(w))
    expect(meta).toMatchObject({ prev: 'a', kind: 'doc', order: '1' })
    expect(warnings).toHaveLength(2)
  })
})
