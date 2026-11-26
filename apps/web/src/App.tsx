import { BlockRenderer } from '@dumpster/blocks'
import type { Doc } from '@dumpster/schema'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { loadStore, type Store } from './data'
import { hashOf, parseHash, type Route } from './route'

// P4.0 뼈대 — 데이터 길(graph.json → Store → getDoc)과 주소만. 칸·사이드바·트리는 P4.1(리듀서)·P4.2(UI)

const subscribeHash = (cb: () => void) => {
  addEventListener('hashchange', cb)
  return () => removeEventListener('hashchange', cb)
}
const useHash = () => useSyncExternalStore(subscribeHash, () => location.hash)
const hrefOf = (id: string) => hashOf({ main: id, rel: null })

export function App() {
  const [store, setStore] = useState<Store | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadStore().then(setStore, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  const route = parseHash(useHash())

  let body: ReactNode
  if (error) body = <p className="mt-16 text-[15px] text-rose-700">{error}</p>
  else if (!store) body = <p className="mt-16 text-[15px] text-slate-400">불러오는 중…</p>
  else if (route.main) body = <DocPage key={route.main} store={store} route={route} />
  else body = <Home store={store} />

  return (
    <div className="min-h-screen bg-page font-sans text-slate-900 antialiased">
      <header className="flex h-12 items-center gap-3 border-b border-slate-200 px-4">
        <a href="#/" className="rounded-md px-1.5 py-1 text-[15px] font-bold tracking-tight hover:bg-slate-100">
          Dumpster
        </a>
        <span className="text-[12px] text-slate-400">뼈대 P4.0</span>
      </header>
      <main className="mx-auto max-w-[760px] px-5 pb-24 sm:px-11">{body}</main>
    </div>
  )
}

function Home({ store }: { store: Store }) {
  const { graph, collectionsById, docsByCollection } = store.index
  const recent = [...graph.docs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title, 'ko'))
    .slice(0, 10)
  return (
    <>
      <h1 className="mt-10 text-[28px] font-bold tracking-tight">Dumpster</h1>
      <p className="mt-2 text-[15px] text-slate-500">짬통에 던져 둔 글을 컬렉션별로 이어 읽는 곳.</p>

      <h2 className="mb-3 mt-10 text-[13px] font-semibold text-slate-500">컬렉션</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {graph.collections.map((c) => {
          const first = c.manifestId ?? store.index.tree(c.id).rows[0]?.docId
          const card = (
            <>
              {c.path.length > 1 && <span className="text-[11.5px] text-slate-400">{c.path.slice(0, -1).join(' / ')}</span>}
              <span className="text-[16px] font-bold">{c.title}</span>
              {c.description && <span className="line-clamp-3 text-[13px] leading-relaxed text-slate-500">{c.description}</span>}
              <span className="mt-1.5 text-[12px] text-slate-400">{docsByCollection.get(c.id)?.length ?? 0}편</span>
            </>
          )
          const cls = 'flex flex-col gap-1 rounded-xl border border-slate-200 px-4 py-3.5'
          return first ? (
            <a key={c.id} href={hrefOf(first)} className={`${cls} hover:border-emerald-300 hover:bg-slate-50`}>
              {card}
            </a>
          ) : (
            <div key={c.id} className={cls}>
              {card}
            </div>
          )
        })}
      </div>

      <h2 className="mb-2 mt-10 text-[13px] font-semibold text-slate-500">최근 글</h2>
      <ul>
        {recent.map((d) => (
          <li key={d.id}>
            <a href={hrefOf(d.id)} className="-mx-2.5 flex items-baseline gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-50">
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{d.title}</span>
              <span className="whitespace-nowrap text-[12.5px] tabular-nums text-slate-400">
                {collectionsById.get(d.collectionId)?.title} · {d.updatedAt.slice(5, 10)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

function DocPage({ store, route }: { store: Store; route: Route }) {
  const { main, rel } = route
  const [loaded, setLoaded] = useState<{ doc: Doc | null } | null>(null)
  useEffect(() => {
    let alive = true
    store.getDoc(main!).then((doc) => {
      if (!alive) return
      // 옛 임시 ID로 들어왔으면 주소만 지금 ID로 고친다 (기록은 안 쌓음)
      if (doc && doc.id !== main) history.replaceState(history.state, '', hashOf({ main: doc.id, rel }))
      setLoaded({ doc })
    })
    return () => {
      alive = false
    }
  }, [store, main, rel])

  if (!loaded) return null
  const { doc } = loaded
  if (!doc) {
    return (
      <div className="mt-16">
        <h1 className="text-[22px] font-bold">없는 글</h1>
        <p className="mt-2 text-[15px] text-slate-500">지워졌거나 공개를 내린 글이에요.</p>
        <a href="#/" className="mt-4 inline-block text-[14px] text-emerald-700 hover:underline">
          첫 화면으로
        </a>
      </div>
    )
  }

  const { collectionsById, docsById, prevOf, nextOf } = store.index
  const prevId = prevOf.get(doc.id)
  const prev = prevId ? docsById.get(prevId) : undefined
  const nexts = nextOf.get(doc.id) ?? []
  return (
    <article>
      <p className="mt-8 text-[12.5px] text-slate-500">{collectionsById.get(doc.collectionId)?.path.join(' › ')}</p>
      <h1 className="mt-2 text-[28px] font-bold leading-snug tracking-tight [text-wrap:balance]">{doc.title}</h1>
      <div className="mb-7 mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] tabular-nums text-slate-500">
        <span>{doc.createdAt.slice(0, 10)}</span>
        {doc.tags.map((t) => (
          <span key={t} className="text-emerald-700">
            #{t}
          </span>
        ))}
      </div>
      <BlockRenderer blocks={doc.blocks} />
      {(prev || nexts.length > 0) && (
        <nav aria-label="이전·다음 글" className="mt-12 flex flex-col gap-1 border-t border-slate-200 pt-6 text-[14px]">
          {prev && (
            <a href={hrefOf(prev.id)} className="text-slate-600 hover:text-emerald-700">
              ← 이전 · {prev.title}
            </a>
          )}
          {nexts.map((n) => (
            <a key={n.id} href={hrefOf(n.id)} className="text-slate-600 hover:text-emerald-700">
              다음 · {n.title} →
            </a>
          ))}
        </nav>
      )}
    </article>
  )
}
