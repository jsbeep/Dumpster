// vite ?raw import — 테스트가 fs 없이 fixture·소스 글자를 읽는다 (패키지를 브라우저용 순수 코드로 유지)
declare module '*?raw' {
  const content: string
  export default content
}
