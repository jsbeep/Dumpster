import { cx } from '@dumpster/blocks'
import { LazyMotion, MotionConfig, domMax } from 'framer-motion'
import { useEffect, useState } from 'react'
import { loadStore, type Store } from './core/data'
import { Explorer } from './Explorer'
import { TooltipLayer } from './ui/TooltipLayer'

// 앱 껍데기 — graph.json을 받는 동안 '불러오는 중…', 받으면 탐색기(Explorer). 움직임 설정·툴팁 층은 앱 전체에 하나씩

export function App() {
  const [store, setStore] = useState<Store | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadStore().then(setStore, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  return (
    <LazyMotion features={domMax} strict>
      {/* 움직임 줄이기(OS 설정)면 위치·크기 애니메이션을 끈다 */}
      <MotionConfig reducedMotion="user">
        {store ? (
          <Explorer store={store} />
        ) : (
          <div className="flex h-full items-center justify-center font-sans">
            <p className={cx('text-[14px]', error ? 'text-rose-700' : 'text-slate-400')}>{error ?? '불러오는 중…'}</p>
          </div>
        )}
        <TooltipLayer />
      </MotionConfig>
    </LazyMotion>
  )
}
