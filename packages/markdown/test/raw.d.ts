// vite ?raw import — 테스트가 fs 없이 fixture·소스 글자를 읽는다 (패키지를 브라우저용 순수 코드로 유지)
declare module '*?raw' {
  const content: string
  export default content
}

// vite import.meta.glob — 순수성 테스트가 src 파일을 전부 글자로 읽는다
interface ImportMeta {
  glob<T>(pattern: string, opts: { query: string; import: string; eager: true }): Record<string, T>
}
