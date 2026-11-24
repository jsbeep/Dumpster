import { useImageLoading, type BlockOf } from '../context'

export const STYLE = {
  figure: 'min-w-0',
  // width/height 속성은 자리 잡기용, 실제 크기는 h-auto로 비율 유지하며 줄어든다
  img: 'h-auto max-w-full rounded-md border border-slate-200',
  caption: 'mt-1.5 text-[0.8125em] text-slate-400',
}

// 옵시디언에 붙여넣은 그림은 alt가 'Pasted image 2026…' 파일 이름이라 캡션으로 쓸모없다
function captionOf(alt: string): string | null {
  const text = alt.trim()
  return text === '' || text.startsWith('Pasted image') ? null : text
}

export function ImageView({ block }: { block: BlockOf<'image'> }) {
  const caption = captionOf(block.alt)
  const loading = useImageLoading()
  return (
    <figure className={STYLE.figure}>
      <img
        src={block.src}
        alt={block.alt}
        width={block.width ?? undefined}
        height={block.height ?? undefined}
        loading={loading}
        decoding="async"
        className={STYLE.img}
      />
      {caption && <figcaption className={STYLE.caption}>{caption}</figcaption>}
    </figure>
  )
}
