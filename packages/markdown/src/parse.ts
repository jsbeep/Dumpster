import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { parse as parseYaml } from 'yaml'
import type * as M from 'mdast'
import { inlinesToText, type Block, type CalloutFold, type Inline, type InlineLink, type ListItem } from '@dumpster/schema'
import { stripComments } from './comments'
import { createSlugger, slugifyHeading } from './slug'
import {
  IMAGE_EXTENSIONS,
  MEDIA_EXTENSIONS,
  basenameOf,
  extensionOf,
  parseImageAlias,
  parseWikilink,
  type Wikilink,
} from './wikilink'

// 본문 마크다운 → Block[]. 순수 함수 — 파일·git·process를 만지지 않는다 (플레이그라운드가 브라우저에서 그대로 돌린다).
// 문서·이미지 해석은 호출부가 ctx로 넘긴다.

export interface ParseContext {
  resolveDoc?: (label: string) => string | null // [[label]] → 문서 ID (없음·비공개 = null)
  resolveAsset?: (name: string) => { src: string } | null // ![[x.png]] → 배포용 경로 (못 찾음 = null)
  selfId?: string | null // [[#헤딩]] 같은 문서 안 링크
  lineOffset?: number // 경고의 줄 번호에 더할 값 (떼어낸 frontmatter 줄 수) — 옵시디언에서 보는 줄 번호와 맞춘다
}

export interface BodyRef {
  label: string // [[ ]] 안의 대상 이름 ('#헤딩'·'|별칭' 뗌)
  relation: 'link' | 'embed'
  target: string | null
}

export interface ParseResult {
  blocks: Block[]
  refs: BodyRef[] // 대상 이름별로 하나 (같은 문서를 여러 번 걸어도 하나)
  warnings: string[]
}

export function parseMarkdown(body: string, ctx: ParseContext = {}): ParseResult {
  return new Converter(body, ctx).run()
}

// 옵시디언은 ~한 개~를 취소선으로 안 본다
const processor = unified().use(remarkParse).use(remarkGfm, { singleTilde: false })
const toTree = (text: string) => processor.parse(text) as M.Root

interface Fmt {
  bold?: true
  italic?: true
  code?: true
  strike?: true
  highlight?: true
  link?: InlineLink
}
// opaque: 코드·위키링크 글자·생 HTML — 그 안의 == ^id 는 문법으로 안 본다
interface TextPiece {
  kind: 'text'
  text: string
  fmt: Fmt
  opaque?: true
}
// 문단 안에 나온 이미지·임베드. 블록을 못 두는 자리(표 셀·헤딩·콜아웃 제목)에선 fallback 글자로
interface BlockPiece {
  kind: 'block'
  block: Block
  fallback: TextPiece[]
}
type Piece = TextPiece | BlockPiece

const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

class Converter {
  private src: string
  private tree: M.Root
  private warnings: string[] = []
  private refs = new Map<string, BodyRef>()
  private definitions = new Map<string, M.Definition>()
  private slug = createSlugger()

  constructor(
    body: string,
    private ctx: ParseContext,
  ) {
    const { text, tree } = this.removeComments(body.replace(/\r\n?/g, '\n'))
    this.src = text
    this.tree = tree
    walk(tree, (n) => {
      if (n.type === 'definition') this.definitions.set(n.identifier, n)
    })
  }

  run(): ParseResult {
    const blocks = this.blocks(this.tree.children)
    return { blocks, refs: [...this.refs.values()], warnings: this.warnings }
  }

  private warn(msg: string) {
    if (!this.warnings.includes(msg)) this.warnings.push(msg)
  }

  // --- %% 주석 ---
  private removeComments(body: string): { text: string; tree: M.Root } {
    if (!body.includes('%%')) return { text: body, tree: toTree(body) }
    const first = stripComments(body, codeRanges(toTree(body)))
    if (first.unclosed) this.warn('닫는 %% 없음 → 문서 끝까지 주석으로 지움')
    let text = first.text
    let tree = toTree(text)
    if (leaksPercent(tree)) {
      // 지켜둔 코드 안 %%가 다시 파싱하니 코드 밖으로 나옴 (주석이 문서 구조를 바꾼 경우) → 코드 안까지 다 지운다
      this.warn('주석이 코드 블록과 얽혀 코드 안의 %%까지 지움')
      while (text.includes('%%')) text = stripComments(text).text
      tree = toTree(text)
    }
    return { text, tree }
  }

  // --- 블록 ---
  private blocks(nodes: M.RootContent[]): Block[] {
    return nodes.flatMap((n) => this.block(n))
  }

  private block(node: M.RootContent): Block[] {
    switch (node.type) {
      case 'heading': {
        const inlines = this.finish(this.inlineOnly(this.pieces(node.children), '헤딩'))
        return [{ type: 'heading', level: node.depth, anchor: this.slug(inlinesToText(inlines)), inlines }]
      }
      case 'paragraph':
        return this.paragraph(node)
      case 'list':
        return [this.list(node)]
      case 'blockquote':
        return [this.blockquote(node)]
      case 'code':
        return [this.code(node)]
      case 'table':
        return [this.table(node)]
      case 'thematicBreak':
        return [{ type: 'hr' }]
      case 'html': {
        const text = htmlText(node.value)
        return text.trim() ? [{ type: 'paragraph', inlines: [{ text }] }] : []
      }
      case 'definition':
        return [] // [이름]: url — 옵시디언에서도 안 보인다
      case 'footnoteDefinition':
        this.warn('각주 미지원 → 원문 그대로')
        return [{ type: 'unsupported', raw: this.raw(node), reason: '각주' }]
      default:
        this.warn(`모르는 블록 ${node.type} → 원문 그대로`)
        return [{ type: 'unsupported', raw: this.raw(node), reason: node.type }]
    }
  }

  private paragraph(node: M.Paragraph, pcs?: Piece[]): Block[] {
    if (isMath(this.raw(node))) {
      this.warn('수식 블록 미지원 → 원문 그대로')
      return [{ type: 'unsupported', raw: this.raw(node).trim(), reason: '수식' }]
    }
    return this.flow(pcs ?? this.pieces(node.children))
  }

  // 문단 안의 이미지·임베드는 블록으로 빼고 앞뒤 글자는 각자 문단으로
  private flow(pcs: Piece[]): Block[] {
    const out: Block[] = []
    let run: TextPiece[] = []
    const flush = () => {
      const inlines = this.finish(run)
      if (inlines.length) out.push({ type: 'paragraph', inlines })
      run = []
    }
    for (const p of pcs) {
      if (p.kind === 'block') {
        flush()
        out.push(p.block)
      } else run.push(p)
    }
    flush()
    return out
  }

  private list(node: M.List): Block {
    const items = node.children.map((item): ListItem => {
      let inlines: Inline[] = []
      const children: Block[] = []
      let rest = item.children
      if (rest[0]?.type === 'paragraph') {
        const [head, ...tail] = this.paragraph(rest[0])
        if (head?.type === 'paragraph') inlines = head.inlines
        else if (head) children.push(head)
        children.push(...tail)
        rest = rest.slice(1)
      }
      children.push(...this.blocks(rest))
      return typeof item.checked === 'boolean' ? { inlines, checked: item.checked, children } : { inlines, children }
    })
    return node.ordered ? { type: 'list', ordered: true, start: node.start ?? 1, items } : { type: 'list', ordered: false, items }
  }

  private blockquote(node: M.Blockquote): Block {
    const [first, ...rest] = node.children
    if (first?.type === 'paragraph' && !isMath(this.raw(first))) {
      const pcs = this.pieces(first.children)
      return this.callout(pcs, rest) ?? { type: 'blockquote', children: [...this.paragraph(first, pcs), ...this.blocks(rest)] }
    }
    return { type: 'blockquote', children: this.blocks(node.children) }
  }

  // > [!kind]± 제목 — 인용의 첫 줄이 이 모양일 때만. 제목은 첫 줄 나머지, 둘째 줄부터 본문
  private callout(pcs: Piece[], rest: M.RootContent[]): Block | null {
    const head = pcs[0]
    if (head?.kind !== 'text' || head.opaque || Object.keys(head.fmt).length) return null
    const m = /^\[!([^\]|\s]+)(?:\|[^\]]*)?\]([+-]?)[ \t]*/.exec(head.text)
    if (!m) return null
    const [titlePcs, bodyPcs] = splitAtNewline([{ ...head, text: head.text.slice(m[0].length) }, ...pcs.slice(1)])
    const fold: CalloutFold = m[2] === '-' ? 'closed' : m[2] === '+' ? 'open' : 'none'
    return {
      type: 'callout',
      kind: m[1].toLowerCase(),
      title: this.finish(this.inlineOnly(titlePcs, '콜아웃 제목')),
      fold,
      children: [...this.flow(bodyPcs), ...this.blocks(rest)],
    }
  }

  private code(node: M.Code): Block {
    this.checkFence(node)
    const language = node.lang ?? null
    if (language?.toLowerCase() === 'cardlink') {
      const bookmark = this.cardlink(node.value)
      if (bookmark) return bookmark
    }
    return { type: 'code', language, text: node.value }
  }

  // 함정 ①: 인용·콜아웃 안 코드펜스에서 '>'가 빠진 줄이 있으면 CommonMark(=옵시디언)는 거기서 인용과 코드를 끝낸다.
  // 고치지 않고 옵시디언과 같게 두되, 닫히지 않은 펜스는 경고로 알린다.
  private checkFence(node: M.Code) {
    const lines = this.src.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0).split('\n')
    const open = /^(`{3,}|~{3,})/.exec(lines[0])
    if (!open) return // 들여쓰기 코드
    const close = new RegExp(`^\\${open[1][0]}{${open[1].length},}[ \\t]*$`)
    if (lines.length > 1 && close.test(lines[lines.length - 1].replace(/^[ \t>]*/, ''))) return
    const line = (node.position?.start.line ?? 0) + (this.ctx.lineOffset ?? 0)
    this.warn(`${line}번째 줄 코드 펜스가 안 닫힘 (인용·콜아웃 안이면 '>' 빠진 줄 때문일 수 있음)`)
  }

  // ```cardlink (auto-card-link 플러그인) — 본문이 YAML
  private cardlink(value: string): Block | null {
    let data: unknown = null
    try {
      data = parseYaml(value)
    } catch {
      // 아래에서 url 없음으로 처리
    }
    const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
    const str = (key: string) => (typeof d[key] === 'string' && d[key].trim() ? d[key].trim() : null)
    const href = str('url')
    if (!href) {
      this.warn('cardlink에 url 없음 → 코드 블록으로 둠')
      return null
    }
    return {
      type: 'bookmark',
      href,
      title: str('title') ?? str('host') ?? href,
      description: str('description') ?? '',
      icon: str('favicon'),
      image: str('image'),
    }
  }

  private table(node: M.Table): Block {
    const width = node.align?.length || node.children[0]?.children.length || 0
    const rows = node.children.map((row) => {
      const cells = row.children.slice(0, width).map((cell) => this.finish(this.inlineOnly(this.pieces(cell.children), '표')))
      while (cells.length < width) cells.push([])
      return cells
    })
    return { type: 'table', align: (node.align ?? []).map((a) => a ?? null), header: rows[0] ?? [], rows: rows.slice(1) }
  }

  // --- 인라인 ---
  private pieces(nodes: M.PhrasingContent[], fmt: Fmt = {}, inLink = false): Piece[] {
    const out: Piece[] = []
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          out.push(...this.textPieces(node.value, fmt, inLink))
          break
        case 'emphasis':
          out.push(...this.pieces(node.children, { ...fmt, italic: true }, inLink))
          break
        case 'strong':
          out.push(...this.pieces(node.children, { ...fmt, bold: true }, inLink))
          break
        case 'delete':
          out.push(...this.pieces(node.children, { ...fmt, strike: true }, inLink))
          break
        case 'inlineCode':
          out.push({ kind: 'text', text: node.value, fmt: { ...fmt, code: true }, opaque: true })
          break
        case 'break':
          out.push({ kind: 'text', text: '\n', fmt })
          break
        case 'link':
          out.push(...this.linkPieces(node.url, node.children, fmt))
          break
        case 'linkReference': {
          const def = this.definitions.get(node.identifier)
          out.push(...(def ? this.linkPieces(def.url, node.children, fmt) : this.pieces(node.children, fmt, inLink)))
          break
        }
        case 'image':
          out.push(this.imagePiece(node.url, node.alt ?? '', fmt))
          break
        case 'imageReference': {
          const def = this.definitions.get(node.identifier)
          if (def) out.push(this.imagePiece(def.url, node.alt ?? '', fmt))
          break
        }
        case 'html': {
          const text = htmlText(node.value)
          if (text) out.push(text.trim() ? { kind: 'text', text, fmt, opaque: true } : { kind: 'text', text, fmt })
          break
        }
        case 'footnoteReference':
          this.warn('각주 미지원 → 원문 그대로')
          out.push({ kind: 'text', text: `[^${node.label ?? node.identifier}]`, fmt })
          break
        default:
          this.warn(`모르는 인라인 ${(node as M.Nodes).type} → 무시`)
      }
    }
    return out
  }

  private textPieces(value: string, fmt: Fmt, inLink: boolean): Piece[] {
    if (inLink || !value.includes('[[')) return [{ kind: 'text', text: value, fmt }]
    const out: Piece[] = []
    let last = 0
    for (const m of value.matchAll(WIKILINK)) {
      if (m.index > last) out.push({ kind: 'text', text: value.slice(last, m.index), fmt })
      const wl = parseWikilink(m[2])
      if (!wl.target && !wl.headings.length && !wl.blockRef) out.push({ kind: 'text', text: m[0], fmt })
      else out.push(m[1] ? this.embedPiece(wl, m[0], fmt) : this.wikilinkPiece(wl, m[0], fmt))
      last = m.index + m[0].length
    }
    if (last < value.length) out.push({ kind: 'text', text: value.slice(last), fmt })
    return out
  }

  // [[문서]] → '문서', [[문서|별칭]] → '별칭', [[문서#헤딩]] → '문서 > 헤딩' (옵시디언 읽기 화면과 같은 글자)
  private wikilinkPiece(wl: Wikilink, raw: string, fmt: Fmt): TextPiece {
    if (wl.blockRef) this.warn(`블록 참조 미지원 → 문서 링크로: ${raw}`)
    const text = wl.alias ?? ([wl.target, ...wl.headings].filter(Boolean).join(' > ') || `^${wl.blockRef}`)
    const ext = extensionOf(wl.target)
    let link: InlineLink
    if (!wl.target) {
      link = this.docLink(this.ctx.selfId ?? null, wl.headings)
    } else if (IMAGE_EXTENSIONS.has(ext) || MEDIA_EXTENSIONS.has(ext)) {
      // 첨부 파일로 가는 링크 — 문서 엣지가 아니다
      const asset = IMAGE_EXTENSIONS.has(ext) ? (this.ctx.resolveAsset?.(wl.target) ?? null) : null
      link = asset ? { kind: 'url', href: asset.src } : { kind: 'doc', docId: null }
    } else {
      link = this.docLink(this.ref(wl.target, 'link'), wl.headings)
    }
    return { kind: 'text', text, fmt: { ...fmt, link }, opaque: true }
  }

  private embedPiece(wl: Wikilink, raw: string, fmt: Fmt): Piece {
    const ext = extensionOf(wl.target)
    if (IMAGE_EXTENSIONS.has(ext)) {
      const { alt, width, height } = parseImageAlias(wl.alias)
      const asset = this.ctx.resolveAsset?.(wl.target) ?? null
      return this.imageBlock(asset?.src ?? null, alt ?? basenameOf(wl.target), width, height, raw, fmt)
    }
    if (!wl.target || MEDIA_EXTENSIONS.has(ext)) {
      this.warn(`임베드 미지원 → 원문 그대로: ${raw}`)
      return { kind: 'block', block: { type: 'unsupported', raw, reason: '임베드 미지원' }, fallback: [{ kind: 'text', text: raw, fmt, opaque: true }] }
    }
    if (wl.headings.length || wl.blockRef) this.warn(`부분 임베드는 문서 전체 임베드로: ${raw}`)
    const docId = this.ref(wl.target, 'embed')
    const label = wl.alias ?? [wl.target, ...wl.headings].join(' > ')
    return {
      kind: 'block',
      block: { type: 'embed', docId, label },
      fallback: [{ kind: 'text', text: label, fmt: { ...fmt, link: this.docLink(docId, wl.headings) }, opaque: true }],
    }
  }

  // ![대체 글자|447](주소) — 바깥 주소는 그대로, 상대 경로는 볼트 첨부로 찾는다
  private imagePiece(url: string, alt: string, fmt: Fmt): Piece {
    const sized = /^(.*?)\|(\d+)(?:x(\d+))?$/.exec(alt)
    const text = sized ? sized[1].trim() : alt
    const src = EXTERNAL.test(url) ? url : (this.ctx.resolveAsset?.(safeDecode(url).replace(/^\.\//, ''))?.src ?? null)
    const width = sized ? Number(sized[2]) : null
    const height = sized?.[3] ? Number(sized[3]) : null
    return this.imageBlock(src, text || basenameOf(safeDecode(url)), width, height, `![${alt}](${url})`, fmt)
  }

  private imageBlock(src: string | null, alt: string, width: number | null, height: number | null, raw: string, fmt: Fmt): Piece {
    if (!src) {
      // 없는 이미지와 비공개 폴더 이미지는 똑같이 보인다 (어느 쪽인지는 빌더 리포트에만)
      return { kind: 'block', block: { type: 'unsupported', raw, reason: '이미지를 찾을 수 없음' }, fallback: [{ kind: 'text', text: raw, fmt, opaque: true }] }
    }
    return {
      kind: 'block',
      block: { type: 'image', src, alt, width, height },
      fallback: [{ kind: 'text', text: alt, fmt: { ...fmt, link: { kind: 'url', href: src } }, opaque: true }],
    }
  }

  private linkPieces(url: string, children: M.PhrasingContent[], fmt: Fmt): Piece[] {
    const link = this.urlLink(url)
    const inner = this.pieces(children, { ...fmt, link }, true)
    const visible = inner.some((p) => p.kind === 'block' || p.text.trim())
    return visible ? inner : [{ kind: 'text', text: url, fmt: { ...fmt, link }, opaque: true }]
  }

  // [글자](주소) — 스킴 없는 주소는 옵시디언 마크다운식 내부 링크 ([글자](문서.md), [글자](#헤딩))
  private urlLink(url: string): InlineLink {
    if (EXTERNAL.test(url)) return { kind: 'url', href: url }
    const decoded = safeDecode(url)
    const hash = decoded.indexOf('#')
    const path = (hash === -1 ? decoded : decoded.slice(0, hash)).trim().replace(/^\.\//, '')
    const headings = hash === -1 ? [] : decoded.slice(hash + 1).split('#').filter(Boolean)
    if (!path) return this.docLink(this.ctx.selfId ?? null, headings)
    const ext = extensionOf(path)
    if (ext && ext !== 'md') {
      const asset = IMAGE_EXTENSIONS.has(ext) ? (this.ctx.resolveAsset?.(path) ?? null) : null
      if (asset) return { kind: 'url', href: asset.src }
      this.warn(`상대 경로 링크는 배포본에서 깨짐: ${url}`)
      return { kind: 'url', href: url }
    }
    return this.docLink(this.ref(path.replace(/\.md$/i, ''), 'link'), headings)
  }

  private docLink(docId: string | null, headings: string[]): InlineLink {
    const heading = headings.length ? slugifyHeading(headings[headings.length - 1]) : ''
    return heading ? { kind: 'doc', docId, heading } : { kind: 'doc', docId }
  }

  private ref(label: string, relation: BodyRef['relation']): string | null {
    const key = `${relation}\0${label.normalize('NFC').toLowerCase()}`
    const known = this.refs.get(key)
    if (known) return known.target
    const target = this.ctx.resolveDoc?.(label) ?? null
    this.refs.set(key, { label, relation, target })
    return target
  }

  private inlineOnly(pcs: Piece[], where: string): TextPiece[] {
    return pcs.flatMap((p) => {
      if (p.kind === 'text') return [p]
      this.warn(`${where} 안 이미지·임베드는 링크 글자로 바꿈`)
      return p.fallback
    })
  }

  // 조각들 → Inline[]: ==하이라이트==, 문장 끝 ^블록ID, 앞뒤 공백, 같은 서식 합치기
  private finish(pcs: TextPiece[]): Inline[] {
    let s = ''
    const fmts: Fmt[] = []
    const opaque: boolean[] = []
    for (const p of pcs) {
      s += p.text
      for (let k = 0; k < p.text.length; k++) {
        fmts.push(p.fmt)
        opaque.push(!!p.opaque)
      }
    }
    const del = new Array<boolean>(s.length).fill(false)

    // 옵시디언은 블록 끝의 ^id를 숨긴다
    const id = /(^|\s)\^([A-Za-z0-9-]+)\s*$/.exec(s)
    if (id && !opaque.slice(id.index).some(Boolean)) {
      for (let k = id.index; k < s.length; k++) del[k] = true
      this.warn(`블록 ID 숨김 (블록 참조 미지원): ^${id[2]}`)
    }

    // ==하이라이트== — 여는 쪽 뒤·닫는 쪽 앞이 공백이 아니어야 (~~와 같은 규칙), '='가 3개 이상이면 글자
    let open = -1
    for (let k = 0; k < s.length; k++) {
      if (s[k] !== '=' || del[k] || opaque[k]) continue
      let end = k
      while (end < s.length && s[end] === '=' && !opaque[end] && !del[end]) end++
      if (end - k === 2) {
        const before = s[k - 1]
        const after = s[end]
        if (open === -1) {
          if (after !== undefined && !/\s/.test(after)) open = k
        } else if (before !== undefined && !/\s/.test(before)) {
          del[open] = del[open + 1] = del[k] = del[k + 1] = true
          for (let j = open + 2; j < k; j++) fmts[j] = highlighted(fmts[j])
          open = -1
        }
      }
      k = end - 1
    }

    // 경고만 — 코드 안 $·^[는 문법이 아니므로 가리고 본다 (MongoDB `$set` 같은 것)
    const plain = s.replace(/[\s\S]/g, (c, k: number) => (opaque[k] ? '\0' : c)) // u 플래그 없음 = UTF-16 단위라 opaque 인덱스와 맞는다
    const math = /(?:^|[^\\$])(\$(?=[^\s\0])[^$\n\0]+?(?<=[^\s\0])\$)(?!\d)/.exec(plain)
    if (math) this.warn(`인라인 수식 미지원 → 글자 그대로: ${math[1]}`)
    if (/\^\[[^\0]/.test(plain)) this.warn('인라인 각주 미지원 → 글자 그대로')

    let a = 0
    let b = s.length
    const skip = (k: number) => del[k] || (!fmts[k].code && /\s/.test(s[k]))
    while (a < b && skip(a)) a++
    while (b > a && skip(b - 1)) b--

    const out: Inline[] = []
    let cur: Inline | null = null
    let curKey = ''
    for (let k = a; k < b; k++) {
      if (del[k]) continue
      const key = fmtKey(fmts[k])
      if (cur && key === curKey) cur.text += s[k]
      else {
        cur = toInline(s[k], fmts[k])
        curKey = key
        out.push(cur)
      }
    }
    return out
  }

  // 원문 조각 (unsupported용). 인용·리스트 안이면 둘째 줄부터 앞의 '>'·들여쓰기를 뗀다
  private raw(node: M.Nodes): string {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) return ''
    return this.src
      .slice(start, end)
      .split('\n')
      .map((line, i) => (i ? line.replace(/^[ \t]*(?:>[ \t]?)*/, '') : line))
      .join('\n')
  }
}

// --- 도우미 ---

function walk(node: M.Nodes, visit: (n: M.Nodes) => void) {
  visit(node)
  if ('children' in node) for (const child of node.children) walk(child, visit)
}

function codeRanges(tree: M.Root): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  walk(tree, (n) => {
    if ((n.type === 'code' || n.type === 'inlineCode') && n.position?.start.offset !== undefined && n.position.end.offset !== undefined) {
      ranges.push([n.position.start.offset, n.position.end.offset])
    }
  })
  return ranges
}

// 코드가 아닌 곳에 %%가 남았나 — 남았으면 주석 내용이 샐 수 있다
function leaksPercent(tree: M.Root): boolean {
  let leak = false
  walk(tree, (n) => {
    if (n.type === 'code' || n.type === 'inlineCode') return
    for (const key of ['value', 'url', 'title', 'alt'] as const) {
      const v = (n as unknown as Record<string, unknown>)[key]
      if (typeof v === 'string' && v.includes('%%')) leak = true
    }
  })
  return leak
}

// 생 HTML은 렌더하지 않고 글자로. <br>만 줄바꿈, <!-- -->는 옵시디언에서도 안 보이므로 지운다
function htmlText(value: string): string {
  return value.replace(/<!--[\s\S]*?(?:-->|$)/g, '').replace(/<br\s*\/?>/gi, '\n')
}

function isMath(raw: string): boolean {
  const t = raw.trim()
  return t.length >= 4 && t.startsWith('$$') && t.endsWith('$$')
}

function splitAtNewline(pcs: Piece[]): [Piece[], Piece[]] {
  for (let i = 0; i < pcs.length; i++) {
    const p = pcs[i]
    if (p.kind !== 'text') continue
    const k = p.text.indexOf('\n')
    if (k === -1) continue
    return [
      [...pcs.slice(0, i), { ...p, text: p.text.slice(0, k) }],
      [{ ...p, text: p.text.slice(k + 1) }, ...pcs.slice(i + 1)],
    ]
  }
  return [pcs, []]
}

function safeDecode(url: string): string {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}

const highlightCache = new WeakMap<Fmt, Fmt>()
function highlighted(fmt: Fmt): Fmt {
  let h = highlightCache.get(fmt)
  if (!h) highlightCache.set(fmt, (h = { ...fmt, highlight: true }))
  return h
}

const keyCache = new WeakMap<Fmt, string>()
function fmtKey(fmt: Fmt): string {
  let key = keyCache.get(fmt)
  if (key === undefined) {
    key = JSON.stringify([fmt.bold, fmt.italic, fmt.code, fmt.strike, fmt.highlight, fmt.link])
    keyCache.set(fmt, key)
  }
  return key
}

// 플래그는 true일 때만
function toInline(text: string, fmt: Fmt): Inline {
  const inline: Inline = { text }
  if (fmt.bold) inline.bold = true
  if (fmt.italic) inline.italic = true
  if (fmt.code) inline.code = true
  if (fmt.strike) inline.strike = true
  if (fmt.highlight) inline.highlight = true
  if (fmt.link) inline.link = fmt.link
  return inline
}
