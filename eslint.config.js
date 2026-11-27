import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// 린트는 react-hooks 두 규칙만 — 훅 호출 순서(rules-of-hooks)와 effect 의존성(exhaustive-deps).
// 모양·취향 규칙은 안 켠다. 타입은 tsc(pnpm typecheck)가 본다
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'out/**', '.claude/**'] },
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/playground/src/**/*.{ts,tsx}', 'packages/blocks/src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)
