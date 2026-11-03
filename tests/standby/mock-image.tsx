import { forwardRef, type CSSProperties, type SyntheticEvent } from "react"

// A same-origin SVG image exercises the real img/canvas path; production image
// optimization and remote-art compatibility still require an app-backed check.
const MockImage = forwardRef<HTMLImageElement, {
  alt: string
  className?: string
  fill?: boolean
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
}>(function MockImage({ alt, className, fill, onLoad }, ref) {
  const style: CSSProperties = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}
  // Use a real image element so the harness can exercise native canvas pixel reads.
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img ref={ref} src="/fixture-art.svg" alt={alt} className={className} style={style} onLoad={onLoad} />
})

export default MockImage
