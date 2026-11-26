import type { Doc } from '@dumpster/schema'
import { useEffect, useState } from 'react'
import type { Store } from '../core/data'

// 본문은 getDoc(async)으로만 — graph.json을 글마다 나누게 돼도 화면은 그대로 (design.md 11-26)
// undefined = 받는 중, null = 없는 글
export function useDoc(store: Store, id: string): Doc | null | undefined {
  const [doc, setDoc] = useState<Doc | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    store.getDoc(id).then((d) => alive && setDoc(d))
    return () => {
      alive = false
    }
  }, [store, id])
  return doc
}
