import type { GraphIndex } from '@dumpster/schema'
import { useEffect, useMemo, useState } from 'react'
import type { Store } from '../core/data'
import { bodySearchable, prepareCorpus, searchBody, searchDocs, type Corpus } from '../core/search'

// 사이드바 찾기칸 결과 — 제목(바로) + 본문(평문을 처음 두 글자 칠 때 받아서 한 번 펴 둔다)
//   bodyWaiting: 본문을 찾아야 하는데 평문이 아직 안 옴 — 그동안은 "없어요"를 안 띄운다
export function useSearch(ix: GraphIndex, store: Store, query: string) {
  const titleHits = useMemo(() => searchDocs(ix, query), [ix, query])
  const wantBody = bodySearchable(query)
  const [corpus, setCorpus] = useState<Corpus | null>(null)

  useEffect(() => {
    if (!wantBody || corpus) return
    let alive = true
    store.getSearchText().then((t) => alive && setCorpus(prepareCorpus(t)))
    return () => {
      alive = false
    }
  }, [wantBody, corpus, store])

  const bodyHits = useMemo(() => {
    if (!corpus || !wantBody) return []
    return searchBody(ix, corpus, query, new Set(titleHits.map((h) => h.doc.id)))
  }, [ix, corpus, wantBody, query, titleHits])

  return { titleHits, bodyHits, wantBody, bodyWaiting: wantBody && !corpus }
}
