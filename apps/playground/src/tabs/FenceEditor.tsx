import { BlockRenderer, type BlockStyles, type OpenDoc } from '@dumpster/blocks'
import { FENCE_TARGETS, fenceRulesError, parseMarkdown, type FenceRule, type FenceRules, type FenceTarget, type FieldKind } from '@dumpster/markdown'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, BTN, CopyButton, INPUT, LABEL, SaveBar, saveJson } from '../ui'

// 펜스 매핑 편집 — packages/markdown/src/fences.json (```언어 → 블록, YAML 키 → 블록 필드).
// 새 옵시디언 플러그인 펜스는 여기서 규칙을 더해 저장하면 끝. 대상 블록·필드 표(FENCE_TARGETS)는 코드라,
// 새 블록 타입이 필요하면 아래 "새 블록 타입 뼈대"로 고칠 파일과 코드 조각을 만든다.

const KIND_LABEL: Record<FieldKind, string> = { required: '필수', text: '없으면 빈 글자', optional: '없으면 null' }
const TARGETS = Object.keys(FENCE_TARGETS) as FenceTarget[]

const CARDLINK_SAMPLE = `\`\`\`cardlink
url: https://obsidian.md/
title: "Obsidian - Sharpen your thinking"
description: "The free and flexible app for your private thoughts."
host: obsidian.md
favicon: https://obsidian.md/favicon.ico
image: https://obsidian.md/images/banner.png
\`\`\``

function sampleFor(lang: string, rule: FenceRule | undefined): string {
  if (lang === 'cardlink') return CARDLINK_SAMPLE
  const keys = Object.values(rule?.props ?? {}).map((k) => k[0]).filter(Boolean)
  return ['```' + lang, ...keys.map((k) => `${k}: `), '```'].join('\n')
}

export function countFenceChanges(a: FenceRules, b: FenceRules): number {
  const langs = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...langs].filter((l) => JSON.stringify(a[l]) !== JSON.stringify(b[l])).length
}

export function FenceEditor({
  draft,
  saved,
  onDraft,
  onSaved,
  styles,
  onOpenDoc,
  widthClass,
}: {
  draft: FenceRules
  saved: FenceRules
  onDraft: (r: FenceRules) => void
  onSaved: (r: FenceRules) => void
  styles: BlockStyles
  onOpenDoc: OpenDoc
  widthClass: string
}) {
  const langs = Object.keys(draft)
  const [selected, setSelected] = useState(langs[0] ?? '')
  const lang = langs.includes(selected) ? selected : (langs[0] ?? '')
  const rule = draft[lang] as FenceRule | undefined
  const [samples, setSamples] = useState<Record<string, string>>({})
  const sample = samples[lang] ?? sampleFor(lang, rule)
  const [newLang, setNewLang] = useState('')
  const error = fenceRulesError(draft)

  const result = useMemo(() => parseMarkdown(sample, { fences: draft }), [sample, draft])

  const setRule = (next: FenceRule) => onDraft({ ...draft, [lang]: next })
  const add = () => {
    const name = newLang.trim().toLowerCase()
    if (!name || name in draft) return
    onDraft({ ...draft, [name]: { block: TARGETS[0], body: 'yaml', props: {} } })
    setSelected(name)
    setNewLang('')
  }
  const remove = () => {
    const next = { ...draft }
    delete next[lang]
    onDraft(next)
  }

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      <SaveBar
        file="packages/markdown/src/fences.json"
        dirty={countFenceChanges(draft, saved)}
        error={error}
        onReset={() => onDraft(saved)}
        onSave={async () => {
          const r = await saveJson('fences', draft)
          if (r.ok) onSaved(draft)
          return r
        }}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:grid-rows-1">
        <section className="min-h-0 space-y-4 overflow-auto border-b border-slate-200 px-3 py-3 lg:border-b-0 lg:border-r">
          <div>
            <p className={`${LABEL} mb-1.5`}>펜스 언어 → 블록</p>
            <ul className="space-y-0.5">
              {langs.map((l) => (
                <li key={l}>
                  <button
                    type="button"
                    onClick={() => setSelected(l)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left font-mono text-xs ${
                      l === lang ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>```{l}</span>
                    <span className="opacity-60">→ {draft[l].block}</span>
                    {JSON.stringify(draft[l]) !== JSON.stringify(saved[l]) && <Badge tone="amber">{l in saved ? '바뀜' : '새'}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1.5">
              <input
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="새 펜스 언어 (예: linkcard)"
                className={INPUT}
              />
              <button type="button" className={BTN} onClick={add} disabled={!newLang.trim() || newLang.trim().toLowerCase() in draft}>
                <Plus size={13} />
                추가
              </button>
            </div>
          </div>

          {rule && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <code className="text-sm font-semibold text-slate-800">```{lang}</code>
                <span className="flex-1" />
                <button type="button" className={BTN} onClick={remove}>
                  <Trash2 size={13} />
                  지우기
                </button>
              </div>
              <label className="block">
                <span className={LABEL}>메모 (어느 플러그인인지)</span>
                <input
                  value={rule.note ?? ''}
                  onChange={(e) => {
                    const { note: _note, ...rest } = rule
                    setRule(e.target.value ? { ...rest, note: e.target.value } : rest)
                  }}
                  className={INPUT}
                />
              </label>
              <label className="block">
                <span className={LABEL}>블록 (본문은 YAML)</span>
                <select
                  value={rule.block}
                  onChange={(e) => setRule({ ...rule, block: e.target.value as FenceTarget, props: {} })}
                  className={`${INPUT} h-7`}
                >
                  {TARGETS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <div>
                <p className={`${LABEL} mb-1`}>블록 필드 ← YAML 키 (쉼표로 여러 개 = 앞에서부터 처음 값이 있는 키)</p>
                <div className="space-y-1.5">
                  {(Object.entries(FENCE_TARGETS[rule.block]) as [string, FieldKind][]).map(([field, kind]) => (
                    <div key={field} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
                      <span className="flex flex-col">
                        <code className="text-xs text-slate-700">{field}</code>
                        <span className={`text-[10px] ${kind === 'required' ? 'text-amber-700' : 'text-slate-400'}`}>{KIND_LABEL[kind]}</span>
                      </span>
                      <KeysInput
                        value={rule.props[field] ?? []}
                        onChange={(keys) => {
                          const props = { ...rule.props }
                          if (keys.length) props[field] = keys
                          else delete props[field]
                          setRule({ ...rule, props })
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Skeleton />
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="border-b border-slate-200 p-3">
            <p className={`${LABEL} mb-1`}>시험 마크다운</p>
            <textarea
              value={sample}
              onChange={(e) => setSamples({ ...samples, [lang]: e.target.value })}
              spellCheck={false}
              rows={Math.min(14, Math.max(4, sample.split('\n').length + 1))}
              className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] leading-5 text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className={`mx-auto space-y-4 px-6 py-5 ${widthClass}`}>
              {result.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-800">
                  ⚠ {w}
                </p>
              ))}
              <BlockRenderer blocks={result.blocks} styles={styles} onOpenDoc={onOpenDoc} imageLoading="eager" />
              <pre className="rounded-md bg-slate-50 px-3 py-2 font-mono text-[11px] leading-[1.5] text-slate-600">{JSON.stringify(result.blocks, null, 2)}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// 'url, link' ↔ ['url', 'link'] — 치는 중인 쉼표·공백은 그대로 두고, 값이 밖에서 바뀌면 따라간다
function KeysInput({ value, onChange }: { value: string[]; onChange: (keys: string[]) => void }) {
  const joined = value.join(', ')
  const [text, setText] = useState(joined)
  useEffect(() => {
    setText((t) => (parseKeys(t).join(', ') === joined ? t : joined))
  }, [joined])
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseKeys(e.target.value))
      }}
      placeholder="(없음)"
      className={INPUT}
    />
  )
}

const parseKeys = (s: string) =>
  s
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

// --- 새 블록 타입 뼈대 ---

const TS_TYPE: Record<FieldKind, string> = { required: 'string', text: 'string', optional: 'string | null' }

export function skeleton(type: string, fields: [string, FieldKind][]): string {
  const View = `${type[0].toUpperCase()}${type.slice(1)}View`
  const firstText = fields.find(([, k]) => k !== 'optional')?.[0]
  const sampleValue = (k: FieldKind) => (k === 'optional' ? 'null' : "'…'")
  return [
    `// ── packages/schema/src/blocks.ts — Block 유니온에 추가`,
    `  | { type: '${type}'; ${fields.map(([f, k]) => `${f}: ${TS_TYPE[k]}`).join('; ')} }`,
    ``,
    `// ── packages/schema/src/blocks.ts — blockToText switch에 추가 (검색용 평문)`,
    `    case '${type}':`,
    `      return ${firstText ? `block.${firstText}` : "''"}`,
    ``,
    `// ── packages/markdown/src/fences.ts — FENCE_TARGETS에 추가 (펜스로 만들 수 있게)`,
    `  ${type}: { ${fields.map(([f, k]) => `${f}: '${k}'`).join(', ')} },`,
    ``,
    `// ── packages/blocks/src/views/${type}.tsx (새 파일)`,
    `import type { BlockOf } from '../context'`,
    `import { useStyles } from '../styles'`,
    ``,
    `export function ${View}({ block }: { block: BlockOf<'${type}'> }) {`,
    `  const S = useStyles().${type}`,
    `  return (`,
    `    <div className={S.box}>`,
    ...fields.map(([f]) => `      <p>{block.${f}}</p>`),
    `    </div>`,
    `  )`,
    `}`,
    ``,
    `// ── packages/blocks/src/BlockRenderer.tsx — import와 BLOCK_VIEWS`,
    `import { ${View} } from './views/${type}'`,
    `  ${type}: ${View},`,
    ``,
    `// ── packages/blocks/src/styles.json — 키 추가 (값은 스타일 탭에서 다듬기)`,
    `  "${type}": { "box": "min-w-0 rounded-lg border border-slate-200 px-3.5 py-3" }`,
    ``,
    `// ── packages/blocks/src/samples/kitchenSink.ts — 견본 (갤러리·렌더 테스트가 모든 타입을 요구)`,
    `  { type: '${type}', ${fields.map(([f, k]) => `${f}: ${sampleValue(k)}`).join(', ')} },`,
    ``,
    `// 그다음 이 탭에서 \`\`\`언어 → ${type} 규칙을 추가해 저장`,
  ].join('\n')
}

function parseFieldLines(s: string): { fields: [string, FieldKind][]; error: string | null } {
  const fields: [string, FieldKind][] = []
  for (const line of s.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = /^([a-z][a-zA-Z0-9]*)\s*:\s*(required|text|optional)$/.exec(line)
    if (!m) return { fields, error: `"${line}" — '필드: required|text|optional' 모양이어야 함` }
    fields.push([m[1], m[2] as FieldKind])
  }
  return { fields, error: fields.length ? null : '필드를 하나 이상' }
}

function Skeleton() {
  const [type, setType] = useState('diagram')
  const [fieldText, setFieldText] = useState('src: required\ncaption: optional')
  const { fields, error: fieldError } = parseFieldLines(fieldText)
  const typeError = /^[a-z][a-zA-Z0-9]*$/.test(type) ? (type in FENCE_TARGETS ? '이미 있는 타입' : null) : '소문자로 시작하는 영문·숫자'
  const error = typeError ?? fieldError
  const code = error ? '' : skeleton(type, fields)
  return (
    <details className="rounded-lg border border-dashed border-slate-300 p-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-600">새 블록 타입 뼈대 (코드라 조각만 만든다)</summary>
      <div className="mt-3 space-y-2">
        <label className="block">
          <span className={LABEL}>타입 이름</span>
          <input value={type} onChange={(e) => setType(e.target.value)} className={INPUT} />
        </label>
        <label className="block">
          <span className={LABEL}>필드 (줄마다 이름: required | text | optional)</span>
          <textarea value={fieldText} onChange={(e) => setFieldText(e.target.value)} rows={3} spellCheck={false} className={INPUT} />
        </label>
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : (
          <>
            <CopyButton text={code} label="전부 복사" />
            <pre className="max-h-80 overflow-auto rounded-md bg-slate-50 px-3 py-2 font-mono text-[11px] leading-[1.5] text-slate-600">{code}</pre>
          </>
        )}
      </div>
    </details>
  )
}
