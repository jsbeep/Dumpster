import { AnimatePresence, m } from 'framer-motion'
import { FAST } from './ui/motion'

// 그림 크게 — 화면에 맞춰 키움 (작은 그림도 본문보다 크게). 누르면 닫힘(Esc는 Explorer가). 나타나기는 페이드만
// 본문 그림을 누르면 Article이 Zoom을 넘긴다

export interface Zoom {
  src: string
  alt: string
}

export function Lightbox({ zoom, onClose }: { zoom: Zoom | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {zoom && (
        <m.div
          className="fixed inset-0 z-[200] flex cursor-zoom-out flex-col items-center justify-center gap-2.5 bg-black/85 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FAST}
          onClick={onClose}
          role="dialog"
          aria-label="그림 크게 보기"
          data-zoom
        >
          <img src={zoom.src} alt={zoom.alt} className="min-h-0 w-full flex-1 basis-0 object-contain" />
          {zoom.alt && !zoom.alt.startsWith('Pasted image') && <p className="text-center text-[13px] text-neutral-200">{zoom.alt}</p>}
        </m.div>
      )}
    </AnimatePresence>
  )
}
