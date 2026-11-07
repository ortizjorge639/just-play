import { forwardRef, type CSSProperties, type SyntheticEvent } from "react"
import { Image as NextImage } from "next/dist/client/image-component"

// Local art stays schematic. Remote fixtures use the real Next Image component.
const MockImage = forwardRef<HTMLImageElement, {
  alt: string
  className?: string
  fill?: boolean
  src?: string
  sizes?: string
  priority?: boolean
  crossOrigin?: "anonymous" | "use-credentials" | ""
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void
}>(function MockImage({ src, alt, className, fill, sizes, priority, crossOrigin, onLoad, onError }, ref) {
  if (src?.startsWith("https://artwork-fixture.invalid/")) {
    return <NextImage ref={ref} src={src} alt={alt} fill={fill} sizes={sizes} priority={priority} unoptimized crossOrigin={crossOrigin} className={className} onLoad={onLoad} onError={onError} />
  }
  const style: CSSProperties = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}
  // Use a real image element so the harness can exercise native canvas pixel reads.
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img ref={ref} src="/fixture-art.svg" crossOrigin={crossOrigin} alt={alt} className={className} style={style} onLoad={onLoad} onError={onError} />
})

export default MockImage
