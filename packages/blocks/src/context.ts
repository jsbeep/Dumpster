import { createContext, useContext } from 'react'
import type { Block } from '@dumpster/schema'

export type OpenDoc = (docId: string, heading?: string) => void

export type BlockOf<T extends Block['type']> = Extract<Block, { type: T }>

export interface RenderOptions {
  onOpenDoc?: OpenDoc
  // 스크린샷·인쇄처럼 화면 밖 그림도 바로 필요할 때 'eager'
  imageLoading?: 'lazy' | 'eager'
}

// 리스트·인용·콜아웃 안까지 props로 내려보내지 않으려고 컨텍스트로
export const RenderContext = createContext<RenderOptions>({})

export function useOpenDoc(): OpenDoc | undefined {
  return useContext(RenderContext).onOpenDoc
}

export function useImageLoading(): 'lazy' | 'eager' {
  return useContext(RenderContext).imageLoading ?? 'lazy'
}

// 탐색기 라우트와 맞춘 문서 주소 — apps/web의 해시 라우터가 같은 모양을 읽는다
export function docHref(docId: string): string {
  return `#/d/${encodeURIComponent(docId)}`
}

// 새 탭·새 창으로 열려는 클릭(Ctrl/⌘/Shift/가운데 버튼)은 브라우저에 맡긴다
export function isPlainClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
