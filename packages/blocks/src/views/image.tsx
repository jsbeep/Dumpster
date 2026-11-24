import { useImageLoading, type BlockOf } from '../context'
import { useStyles } from '../styles'

// 옵시디언에 붙여넣은 그림은 alt가 'Pasted image 2026…' 파일 이름이라 캡션으로 쓸모없다
function captionOf(alt: string): string | null {
  const text = alt.trim()
  return text === '' || text.startsWith('Pasted image') ? null : text
}

// 스타일 메모 (styles.json "image"): img — width/height 속성은 자리 잡기용, 실제 크기는 h-auto로 비율 유지하며 줄어든다
export function ImageView({ block }: { block: BlockOf<'image'> }) {
  const S = useStyles().image
  const caption = captionOf(block.alt)
  const loading = useImageLoading()
  return (
    <figure className={S.figure}>
      <img
        src={block.src}
        alt={block.alt}
        width={block.width ?? undefined}
        height={block.height ?? undefined}
        loading={loading}
        decoding="async"
        className={S.img}
      />
      {caption && <figcaption className={S.caption}>{caption}</figcaption>}
    </figure>
  )
}
