import type { Block, Inline, ListItem } from '@dumpster/schema'

// 파서 결과 없이 렌더를 검증하려고 손으로 쓴 Block[] — 모든 블록 타입 + 까다로운 조합.
// 블록 갤러리(apps/playground)가 최상위 타입별로 묶어서 보여준다.

type Flags = Omit<Inline, 'text'>

const t = (text: string, flags: Flags = {}): Inline => ({ text, ...flags })
const p = (...inlines: Inline[]): Block => ({ type: 'paragraph', inlines })
const li = (inlines: Inline[] | string, children: Block[] = [], checked?: boolean): ListItem => ({
  inlines: typeof inlines === 'string' ? [t(inlines)] : inlines,
  children,
  ...(checked === undefined ? {} : { checked }),
})
const ul = (...items: ListItem[]): Block => ({ type: 'list', ordered: false, items })

// 네트워크 없이 그려지는 자리 표시 그림
function svg(width: number, height: number, label: string, hue: number): string {
  const body =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue} 60% 72%)"/><stop offset="1" stop-color="hsl(${hue + 40} 55% 48%)"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="${Math.round(height / 9)}" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(body)}`
}

const LONG_LINE =
  'docker run -d --name jellyfin --restart unless-stopped -p 8096:8096 -v /srv/jellyfin/config:/config -v /srv/jellyfin/cache:/cache -v /mnt/media:/media:ro --device /dev/dri/renderD128:/dev/dri/renderD128 jellyfin/jellyfin:10.11.0 # 이 줄은 일부러 아주 길다 — 가로 스크롤이 생겨야 함'

export const kitchenSink: Block[] = [
  // ── heading
  { type: 'heading', level: 1, anchor: '홈서버-구축기', inlines: [t('홈서버 구축기')] },
  { type: 'heading', level: 2, anchor: '도커-설치', inlines: [t('도커 설치 — '), t('docker compose', { code: true })] },
  { type: 'heading', level: 3, anchor: '네트워크', inlines: [t('네트워크 '), t('(이전 글)', { link: { kind: 'doc', docId: '공유기-설정-2611021200' } })] },
  { type: 'heading', level: 4, anchor: '포트포워딩', inlines: [t('포트포워딩은 '), t('하지 않는다', { bold: true, italic: true })] },
  { type: 'heading', level: 5, anchor: 'h5-제목', inlines: [t('다섯째 단계 제목')] },
  { type: 'heading', level: 6, anchor: 'h6-제목', inlines: [t('여섯째 단계 제목 (흐린 글씨)')] },

  // ── paragraph
  p(t('옵시디언은 줄바꿈 한 번이 곧 줄바꿈이다.\n그래서 이 문단은 두 줄로 보여야 하고,\n이건 세 번째 줄.')),
  p(
    t('굵게', { bold: true }),
    t(' · '),
    t('기울임', { italic: true }),
    t(' · '),
    t('code', { code: true }),
    t(' · '),
    t('취소선', { strike: true }),
    t(' · '),
    t('형광펜', { highlight: true }),
    t(' · '),
    t('굵게+기울임', { bold: true, italic: true }),
    t(' · '),
    t('굵은 코드', { bold: true, code: true }),
    t(' · '),
    t('형광펜 위 코드', { highlight: true, code: true }),
    t(' · '),
    t('취소된 굵은 기울임', { strike: true, bold: true, italic: true }),
  ),
  p(
    t('바깥 링크는 '),
    t('새 탭', { link: { kind: 'url', href: 'https://docs.docker.com/engine/install/debian/' } }),
    t('으로 열리고, '),
    t('굵은 링크', { bold: true, link: { kind: 'url', href: 'https://example.com' } }),
    t('나 '),
    t('코드 링크', { code: true, link: { kind: 'url', href: 'https://example.com' } }),
    t('도 링크 색. 문서 링크 '),
    t('도커 설치', { link: { kind: 'doc', docId: '도커-설치-2611041940' } }),
    t('는 컬럼을 열고, 제목까지 짚는 '),
    t('도커 설치 › 네트워크', { link: { kind: 'doc', docId: '도커-설치-2611041940', heading: '네트워크' } }),
    t('도 있다. 없는 문서 '),
    t('아직 안 쓴 글', { link: { kind: 'doc', docId: null } }),
    t('과 비공개 문서 '),
    t('일기장', { link: { kind: 'doc', docId: null } }),
    t('는 똑같이 회색 글자. '),
    t('취소된 문서 링크', { strike: true, link: { kind: 'doc', docId: '도커-설치-2611041940' } }),
    t('.'),
  ),
  p(t('붙여넣은 HTML은 글자로만: <div class="bg-red-500 p-8 text-white">이게 빨간 상자로 보이면 안 됨</div> <script>alert(1)</script> &amp;')),
  p(t('끊을 곳 없는 긴 주소: https://github.com/jsbeep/obsidian/blob/main/%ED%99%88%EC%84%9C%EB%B2%84%20%EA%B5%AC%EC%B6%95%EA%B8%B0/OT.%ED%99%88%EC%84%9C%EB%B2%84.md')),

  // ── list
  ul(
    li('1단 — 라즈베리 파이 5', [
      ul(
        li('2단 — NVMe 부팅', [
          ul(
            li('3단 — PCIe Gen3 켜기', [ul(li([t('4단 — '), t('dtparam=pciex1_gen=3', { code: true })]), li('4단 둘째'))]),
            li('3단 둘째'),
          ),
        ]),
        li('2단 둘째'),
      ),
    ]),
    li([t('굵은 항목', { bold: true }), t(' 뒤에 '), t('문서 링크', { link: { kind: 'doc', docId: '도커-설치-2611041940' } })]),
  ),
  {
    type: 'list',
    ordered: true,
    start: 3,
    items: [
      li('셋째부터 시작하는 번호 목록', [
        { type: 'list', ordered: true, items: [li('a로 매겨지는 하위', [{ type: 'list', ordered: true, items: [li('i로 매겨지는 하위'), li('ii')] }]), li('b')] },
      ]),
      li('넷째 — 항목 안에 문단과 코드', [
        p(t('항목에 딸린 문단.\n줄바꿈도 그대로.')),
        { type: 'code', language: 'bash', text: 'sudo apt update && sudo apt install -y docker-ce' },
      ]),
    ],
  },
  ul(
    li('할 일 — 안 함', [], false),
    li([t('할 일 — 끝남, '), t('코드', { code: true }), t('도 같이 흐리게')], [], true),
    li('할 일 — 하위 작업 있음', [ul(li('하위 — 끝남', [], true), li('하위 — 안 함', [], false))], false),
    li('체크 없는 보통 항목이 섞여도 됨'),
  ),

  // ── blockquote
  {
    type: 'blockquote',
    children: [
      p(t('인용 안의 문단. '), t('굵게', { bold: true }), t('와 '), t('code', { code: true }), t('.')),
      ul(li('인용 안 리스트'), li('둘째', [ul(li('중첩'))])),
      { type: 'code', language: 'yaml', text: 'services:\n  app:\n    image: nginx:alpine' },
      { type: 'blockquote', children: [p(t('인용 안의 인용'))] },
    ],
  },

  // ── callout
  {
    type: 'callout',
    kind: 'note',
    title: [],
    fold: 'none',
    children: [p(t('제목이 비면 종류 이름(Note)이 제목.'))],
  },
  {
    type: 'callout',
    kind: 'tip',
    title: [t('제목에 '), t('굵게', { bold: true }), t('와 '), t('code', { code: true })],
    fold: 'none',
    children: [
      p(t('콜아웃 안 코드와 리스트:')),
      { type: 'code', language: 'ts', text: "const graph = await build({ vault: '~/obsidian' })\nconsole.log(graph.nodes.length)" },
      ul(li('첫째'), li('둘째', [ul(li('중첩'))])),
    ],
  },
  {
    type: 'callout',
    kind: 'warning',
    title: [t('펼친 채 시작하는 접이식 (+) — 제목이 길어서 두 줄로 넘어가도 아이콘과 화살표는 첫 줄에 붙어 있어야 한다')],
    fold: 'open',
    children: [p(t('제목을 누르면 접힌다.')), { type: 'table', align: [null, null], header: [[t('키')], [t('값')]], rows: [[[t('a')], [t('1')]]] }],
  },
  {
    type: 'callout',
    kind: 'danger',
    title: [t('접힌 채 시작 (-)')],
    fold: 'closed',
    children: [
      p(t('펼쳐야 보이는 내용.')),
      {
        type: 'callout',
        kind: 'bug',
        title: [t('콜아웃 안 콜아웃(접힘)')],
        fold: 'closed',
        children: [p(t('안쪽 화살표는 안쪽이 열릴 때만 돈다.'))],
      },
    ],
  },
  { type: 'callout', kind: 'mystery', title: [t('모르는 종류(mystery) → note처럼')], fold: 'none', children: [] },
  { type: 'callout', kind: 'abstract', title: [], fold: 'none', children: [p(t('abstract / summary / tldr'))] },
  { type: 'callout', kind: 'info', title: [], fold: 'none', children: [p(t('info'))] },
  { type: 'callout', kind: 'todo', title: [], fold: 'none', children: [p(t('todo'))] },
  { type: 'callout', kind: 'success', title: [], fold: 'none', children: [p(t('success / check / done'))] },
  { type: 'callout', kind: 'question', title: [], fold: 'none', children: [p(t('question / help / faq'))] },
  { type: 'callout', kind: 'failure', title: [], fold: 'none', children: [p(t('failure / fail / missing'))] },
  { type: 'callout', kind: 'example', title: [], fold: 'none', children: [p(t('example'))] },
  { type: 'callout', kind: 'QUOTE', title: [], fold: 'none', children: [p(t('quote / cite — 대문자 kind도 같은 색'))] },

  // ── code
  {
    type: 'code',
    language: 'typescript',
    text: "import { readFile } from 'node:fs/promises'\n\n// 한글 주석도 고정폭으로\nexport async function load(path: string) {\n\treturn JSON.parse(await readFile(path, 'utf8'))\n}",
  },
  { type: 'code', language: 'sh', text: LONG_LINE },
  { type: 'code', language: null, text: '언어 없는 펜스\n<div class="bg-red-500">HTML처럼 보여도 글자</div>' },

  // ── table
  {
    type: 'table',
    align: ['left', 'center', 'right', null],
    header: [[t('왼쪽')], [t('가운데')], [t('오른쪽')], [t('정렬 없음')]],
    rows: [
      [[t('도커')], [t('✅')], [t('1,024')], [t('셀 안\n줄바꿈\n세 줄')]],
      [[t('굵게', { bold: true })], [t('code', { code: true })], [t('12.5')], [t('문서 링크', { link: { kind: 'doc', docId: '도커-설치-2611041940' } }), t(' / '), t('없는 문서', { link: { kind: 'doc', docId: null } })]],
      [[t('')], [t('빈 셀 왼쪽')], [t('0')], [t('형광', { highlight: true })]],
    ],
  },
  {
    type: 'table',
    align: [null, null, null, null, null, null, null],
    header: ['서비스', '이미지', '포트', '볼륨', '재시작', '네트워크', '메모'].map((h) => [t(h)]),
    rows: [
      [[t('jellyfin')], [t('jellyfin/jellyfin:10.11.0', { code: true })], [t('8096')], [t('/srv/jellyfin/config:/config')], [t('unless-stopped')], [t('bridge')], [t('넓은 표는 상자 안에서 가로로 스크롤된다')]],
      [[t('immich')], [t('ghcr.io/immich-app/immich-server:release', { code: true })], [t('2283')], [t('/mnt/photos:/usr/src/app/upload')], [t('always')], [t('immich_default')], [t('사진 백업')]],
    ],
  },

  // ── hr
  { type: 'hr' },

  // ── image
  { type: 'image', src: svg(447, 250, '447 × 250 (|447)', 150), alt: 'Pasted image 20261104194012.png', width: 447, height: null },
  { type: 'image', src: svg(1600, 600, '1600 × 600 → 칸에 맞게 줄어듦', 210), alt: '캡션이 보이는 그림 — alt가 Pasted image가 아님', width: 1600, height: 600 },

  // ── bookmark
  {
    type: 'bookmark',
    href: 'https://docs.docker.com/engine/install/debian/',
    title: 'Install Docker Engine on Debian | Docker Docs',
    description: 'Jumpstart your client-side server applications with Docker Engine on Debian. This guide details prerequisites and multiple methods to install. 설명이 길면 두 줄에서 잘린다 — 잘리는지 보려고 일부러 늘린 문장.',
    icon: svg(32, 32, '', 200),
    image: svg(320, 200, 'og:image', 200),
  },
  { type: 'bookmark', href: 'https://example.com/no-meta', title: '', description: '', icon: null, image: null },

  // ── embed
  { type: 'embed', docId: '도커-설치-2611041940', label: '도커 설치' },
  { type: 'embed', docId: null, label: '비공개이거나 없는 문서' },

  // ── unsupported
  { type: 'unsupported', raw: '$$\n\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}\n$$', reason: '수식' },
  { type: 'unsupported', raw: '각주가 달린 문장[^1]\n\n[^1]: 각주 내용', reason: '각주' },
]
