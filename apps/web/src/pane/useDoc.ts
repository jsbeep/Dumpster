import type { Doc } from '@dumpster/schema'
import { useEffect, useState } from 'react'
import type { Store } from '../core/data'

// 본문 — 받아 둔 글은 바로(peekDoc), 아니면 getDoc(async)으로 받는다. graph.json을 글마다 나누게 돼도 화면은 그대로 (design.md 11-26)
// 바로 꺼내는 건 폰 글 바꾸기 슬라이드 때문 — 새 칸이 그려지는 그 자리에서 본문까지 있어야 새 화면 스냅샷이 빈 칸이 아니다
// undefined = 받는 중, null = 없는 글
export function useDoc(store: Store, id: string): Doc | null | undefined {
  const peek = store.peekDoc(id)
  const [loaded, setLoaded] = useState<{ id: string; doc: Doc | null } | null>(null)
  useEffect(() => {
    if (peek !== undefined) return
    let alive = true
    store.getDoc(id).then((doc) => alive && setLoaded({ id, doc }))
    return () => {
      alive = false
    }
  }, [store, id, peek])
  return peek !== undefined ? peek : loaded?.id === id ? loaded.doc : undefined
}
