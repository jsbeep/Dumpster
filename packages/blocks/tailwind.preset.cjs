/** @type {import('tailwindcss').Config} */
// 탐색기(apps/web)·플레이그라운드가 같이 쓰는 Tailwind 프리셋 — mongolive apps/web/tailwind.config.cjs의 팔레트를 옮겨 왔다.
// 색 클래스(bg-slate-100, text-emerald-700 …)는 그대로 두고, 그 색들이 CSS 변수를 가리키게 해서 .dark일 때 변수 값만 바꾼다.
//   라이트 = Tailwind 원래 값
//   다크   = Obsidian 기본 다크 테마 느낌. slate는 무채색 회색, white는 카드 바탕(#262626),
//            emerald(강조색)는 올리브 초록, sky는 Frost 하늘색.
//            강조색의 연한 단계(50~300)는 카드 위에 겹친 반투명 틴트, 진한 단계는 밝은 쪽으로.
// mongolive와 달리 다크 선택자가 :root.dark가 아니라 .dark — 갤러리에서 일부만 다크로 보여줄 수 있게.
// 색 밖의 테마 값(코드 블록·페이지 바탕·글꼴)은 src/theme.css.
const colors = require('tailwindcss/colors')
const plugin = require('tailwindcss/plugin')

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
const PALETTES = ['slate', 'emerald', 'amber', 'rose', 'cyan', 'sky', 'red', 'teal', 'indigo', 'blue', 'violet', 'orange']

// 회색 계열(slate): 바탕 쪽(50~300) → 글자 쪽(400~950). 숫자가 클수록 밝다(라이트와 반대)
// 보조 글자(400~600)는 어두운 바탕에서 묻히지 않도록 Obsidian보다 밝게
const DARK_SLATE = {
  50: '#2c2c2c', 100: '#303030', 200: '#383838', 300: '#454545', 400: '#8e8e8e', 500: '#a6a6a6',
  600: '#bdbdbd', 700: '#dadada', 800: '#e4e4e4', 900: '#ececec', 950: '#f5f5f5',
}
// 카드 바탕(white 자리) — 페이지 배경(#1e1e1e)보다 한 단계 밝게. Obsidian 사이드바 색
const DARK_SURFACE = '#262626'
// 선택된 행 — Obsidian 파일 트리의 선택 색
const DARK_SELECTED = '#363636'
const ACCENT = '#97b597'
const ACCENT_TEXT = '#a6c4a8'
const FROST = '#cce2dd'
const FROST_TEXT = '#eaf4f5'
// 특별히 정한 색을 쓰는 팔레트: [기본, 글자(700·800), 가장 밝은 글자(900·950)]
const SPECIAL = {
  emerald: [ACCENT, ACCENT_TEXT, '#e2ece2'],
  sky: [FROST, FROST_TEXT, '#d8eeee'],
}

const rgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ')
}
// a를 b 위에 t만큼 겹친 색 — 다크에서 연한 강조 바탕을 '카드 위에 깔린 반투명 틴트'처럼
const blend = (a, b, t) => {
  const pa = rgb(a).split(' ').map(Number)
  const pb = rgb(b).split(' ').map(Number)
  return pa.map((v, i) => Math.round(pb[i] + (v - pb[i]) * t)).join(' ')
}
const TINT = { 50: 0.18, 100: 0.26, 200: 0.34, 300: 0.46 }
// 진한 단계(글자·아이콘·버튼)는 밝은 쪽으로: 600 → 400, 700 → 300 …
const BRIGHT = { 400: '400', 500: '400', 600: '400', 700: '300', 800: '200', 900: '100', 950: '50' }

const varColor = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

const darkAccent = (p, s) => {
  const special = SPECIAL[p]
  if (special) {
    if (TINT[s] !== undefined) return blend(special[0], DARK_SURFACE, TINT[s])
    return rgb(s === '700' || s === '800' ? special[1] : s === '900' || s === '950' ? special[2] : special[0])
  }
  if (TINT[s] !== undefined) return blend(colors[p][400], DARK_SURFACE, TINT[s])
  return rgb(colors[p][BRIGHT[s]])
}

const themeVars = (dark) => {
  const vars = {
    '--c-white': rgb(dark ? DARK_SURFACE : '#ffffff'),
    '--c-selected': rgb(dark ? DARK_SELECTED : colors.emerald[50]),
  }
  for (const p of PALETTES) {
    for (const s of SHADES) {
      vars[`--c-${p}-${s}`] = !dark ? rgb(colors[p][s]) : p === 'slate' ? rgb(DARK_SLATE[s]) : darkAccent(p, s)
    }
  }
  return vars
}

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        white: varColor('white'),
        selected: varColor('selected'),
        ...Object.fromEntries(PALETTES.map((p) => [p, Object.fromEntries(SHADES.map((s) => [s, varColor(`${p}-${s}`)]))])),
        // 페이지 바탕·코드 블록은 slate 단계와 따로 간다 — slate-950은 다크에서 밝은색이 되므로 코드 바탕으로 못 쓴다
        page: 'var(--page-bg)',
        code: {
          bg: 'var(--code-bg)',
          fg: 'var(--code-fg)',
          muted: 'var(--code-muted)',
          border: 'var(--code-border)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': themeVars(false),
        '.dark': themeVars(true),
      })
    }),
  ],
}
