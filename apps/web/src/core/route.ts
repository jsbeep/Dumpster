// 주소 = #/d/{흐름}[/{펼친 탭}] (design.md §3). 나머지 탭은 history.state에만 둔다.
// 블록 렌더러의 docHref(`#/d/{id}`)와 같은 모양
export interface Route {
  main: string | null
  rel: string | null
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function parseHash(hash: string): Route {
  const m = /^#\/d\/([^/?#]+)(?:\/([^/?#]+))?\/?$/.exec(hash)
  if (!m) return { main: null, rel: null }
  return { main: decode(m[1]), rel: m[2] ? decode(m[2]) : null }
}

export function hashOf(route: Route): string {
  if (!route.main) return '#/'
  return `#/d/${encodeURIComponent(route.main)}${route.rel ? `/${encodeURIComponent(route.rel)}` : ''}`
}
