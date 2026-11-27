import { useEffect, useState } from 'react'

// 창 폭 구간 — 폭이 바뀔 때마다가 아니라 구간이 바뀔 때만 다시 그린다
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const q = matchMedia(query)
    const h = () => setOn(q.matches)
    q.addEventListener('change', h)
    return () => q.removeEventListener('change', h)
  }, [query])
  return on
}

// 폰 서랍 폭 = 창의 78% (최대 296px) — 밀린 칸이 오른쪽에 조금 남아 눌러서 닫을 자리가 된다
const drawerWidthOf = () => Math.min(296, Math.round(innerWidth * 0.78)) // 11-27 사용자: 좀 좁게 (전엔 84% · 320)
export function useDrawerWidth(phone: boolean): number {
  const [w, setW] = useState(drawerWidthOf)
  useEffect(() => {
    if (!phone) return
    const h = () => setW(drawerWidthOf())
    h()
    addEventListener('resize', h)
    return () => removeEventListener('resize', h)
  }, [phone])
  return w
}
