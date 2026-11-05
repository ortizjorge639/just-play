"use client"

import { useEffect, useRef } from "react"
import { GameArtwork } from "./game-artwork"
import "./standby-artwork.css"

export function StandbyArtwork({ artwork }: { artwork: string }) {
  const fieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const field = fieldRef.current
    const canvas = field?.querySelector<HTMLCanvasElement>("[data-testid='standby-ascii']")
    const image = field?.querySelector("img")
    const context = canvas?.getContext("2d", { alpha: true })
    if (!field || !canvas || !image || !context) return

    const sample = document.createElement("canvas")
    const sampleContext = sample.getContext("2d", { willReadFrequently: true })
    if (!sampleContext) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const palette = " .,:;+=*?%#@"
    let frame = 0
    let lastDraw = 0

    const draw = (timestamp: number) => {
      if (!image.complete || !image.naturalWidth || document.visibilityState !== "visible") return
      if (!reducedMotion.matches && timestamp - lastDraw < 120) {
        frame = requestAnimationFrame(draw)
        return
      }
      lastDraw = timestamp

      const bounds = field.getBoundingClientRect()
      const columns = Math.max(44, Math.min(128, Math.floor(bounds.width / 8)))
      const rows = Math.max(28, Math.min(120, Math.floor(bounds.height / (bounds.width / columns * 1.35))))
      sample.width = columns
      sample.height = rows
      canvas.width = columns * 9
      canvas.height = rows * 12

      const sourceRatio = image.naturalWidth / image.naturalHeight
      const targetRatio = columns / rows
      let sourceWidth = image.naturalWidth
      let sourceHeight = image.naturalHeight
      if (sourceRatio > targetRatio) sourceWidth = image.naturalHeight * targetRatio
      else sourceHeight = image.naturalWidth / targetRatio

      const drift = reducedMotion.matches ? 0 : Math.sin(timestamp * 0.00008) * 0.025
      const sourceX = (image.naturalWidth - sourceWidth) * (0.5 + drift)
      const sourceY = (image.naturalHeight - sourceHeight) * 0.5
      sampleContext.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, columns, rows)

      let pixels: ImageData
      try {
        pixels = sampleContext.getImageData(0, 0, columns, rows)
      } catch (error) {
        canvas.hidden = true
        console.warn("[standby-artwork] ASCII treatment unavailable for this image.", error)
        return
      }

      context.clearRect(0, 0, canvas.width, canvas.height)
      context.font = "10px monospace"
      context.textBaseline = "middle"
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const offset = (y * columns + x) * 4
          const red = pixels.data[offset]
          const green = pixels.data[offset + 1]
          const blue = pixels.data[offset + 2]
          const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255
          if (luminance < 0.12) continue
          const glyphIndex = Math.min(palette.length - 1, Math.floor(((luminance - 0.12) / 0.88) * palette.length))
          const glyph = palette[glyphIndex]
          if (glyph === " ") continue
          const liftedRed = Math.min(255, Math.round(red * 0.85 + 50))
          const liftedGreen = Math.min(255, Math.round(green * 0.85 + 50))
          const liftedBlue = Math.min(255, Math.round(blue * 0.85 + 50))
          context.fillStyle = `rgba(${liftedRed}, ${liftedGreen}, ${liftedBlue}, ${0.58 + luminance * 0.38})`
          context.fillText(glyph, x * 9, y * 12 + 6)
        }
      }

      canvas.dataset.rendered = "true"
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw)
    }

    const updateVisibility = () => {
      field.dataset.motion = document.visibilityState === "visible" ? "running" : "paused"
      cancelAnimationFrame(frame)
      if (document.visibilityState === "visible") frame = requestAnimationFrame(draw)
    }
    const onImageLoad = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(draw)
    }
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(draw)
    })
    resizeObserver.observe(field)
    updateVisibility()
    document.addEventListener("visibilitychange", updateVisibility)
    image.addEventListener("load", onImageLoad)
    reducedMotion.addEventListener("change", updateVisibility)
    if (image.complete) frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      document.removeEventListener("visibilitychange", updateVisibility)
      image.removeEventListener("load", onImageLoad)
      reducedMotion.removeEventListener("change", updateVisibility)
    }
  }, [])

  return (
    <div ref={fieldRef} data-testid="standby-field" aria-hidden="true" className="standby-field pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <GameArtwork src={artwork} alt="" sizes="100vw" className="standby-artwork absolute inset-0 opacity-30 saturate-75" priority />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/65" />
      <canvas data-testid="standby-ascii" className="standby-ascii absolute inset-0 h-full w-full" />
      <div className="standby-pointer-glow absolute inset-0" />
    </div>
  )
}
