"use client"

import { useEffect, useRef } from "react"
import { GameArtwork } from "./game-artwork"
import "./standby-artwork.css"

export interface StandbyAppearance {
  effect: "dither" | "ascii" | "artwork"
  color: "original" | "amber" | "mint" | "mono"
  motion: boolean
}

export const DEFAULT_STANDBY_APPEARANCE: StandbyAppearance = {
  effect: "dither",
  color: "original",
  motion: true,
}

export function StandbyArtwork({ artwork, appearance = DEFAULT_STANDBY_APPEARANCE }: {
  artwork: string
  appearance?: StandbyAppearance
}) {
  const fieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const field = fieldRef.current
    const canvas = field?.querySelector<HTMLCanvasElement>("[data-testid='standby-ascii']")
    const image = field?.querySelector("img")
    const context = canvas?.getContext("2d", { alpha: true })
    if (!field || !canvas || !image || !context) return

    const sample = document.createElement("canvas")
    const sampleContext = sample.getContext("2d", { willReadFrequently: true })
    const source = document.createElement("canvas")
    const sourceContext = source.getContext("2d")
    if (!sampleContext || !sourceContext) return

    const palette = " .,:;+=*?%#@"
    let frame = 0
    const tint = appearance.color === "original" ? null : getComputedStyle(field).getPropertyValue(`--standby-${appearance.color}`).trim()
    const matrix = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

    const renderTexture = () => {
      if (appearance.effect === "artwork") return
      if (!image.complete || !image.naturalWidth) return
      const bounds = field.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const ascii = appearance.effect === "ascii"
      const cellWidth = ascii ? 9 : 4
      const cellHeight = ascii ? 12 : 4
      const columns = Math.max(44, Math.min(ascii ? 128 : 240, Math.floor(bounds.width / (ascii ? 8 : 4))))
      const rows = Math.max(28, Math.round(bounds.height / bounds.width * columns * cellWidth / cellHeight))
      sample.width = columns
      sample.height = rows
      canvas.width = columns * cellWidth
      canvas.height = rows * cellHeight

      const sourceRatio = image.naturalWidth / image.naturalHeight
      const targetRatio = bounds.width / bounds.height
      let sourceWidth = image.naturalWidth
      let sourceHeight = image.naturalHeight
      if (sourceRatio > targetRatio) sourceWidth = image.naturalHeight * targetRatio
      else sourceHeight = image.naturalWidth / targetRatio

      const sourceX = (image.naturalWidth - sourceWidth) * 0.5
      const sourceY = (image.naturalHeight - sourceHeight) * 0.5
      // Rasterize first so SVG source rectangles use the same coordinates as bitmap art.
      source.width = image.naturalWidth
      source.height = image.naturalHeight
      sourceContext.drawImage(image, 0, 0, source.width, source.height)
      sampleContext.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, columns, rows)

      let pixels: ImageData
      try {
        pixels = sampleContext.getImageData(0, 0, columns, rows)
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "SecurityError") throw error
        canvas.hidden = true
        field.dataset.rendered = "false"
        console.warn("[standby-artwork] ASCII treatment unavailable for this image.", error)
        return
      }

      context.font = "10px monospace"
      context.textBaseline = "middle"
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const offset = (y * columns + x) * 4
          const red = pixels.data[offset]
          const green = pixels.data[offset + 1]
          const blue = pixels.data[offset + 2]
          const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255
          const liftedRed = Math.min(255, Math.round(red * 0.85 + 50))
          const liftedGreen = Math.min(255, Math.round(green * 0.85 + 50))
          const liftedBlue = Math.min(255, Math.round(blue * 0.85 + 50))
          context.fillStyle = tint || `rgb(${liftedRed}, ${liftedGreen}, ${liftedBlue})`
          if (ascii) {
            const glyphIndex = Math.min(palette.length - 1, Math.floor(luminance * palette.length))
            context.fillText(palette[glyphIndex], x * cellWidth, y * cellHeight + 6)
          } else {
            const density = Math.min(1, luminance * 1.35 + 0.08)
            for (let dy = 0; dy < 4; dy++) {
              for (let dx = 0; dx < 4; dx++) {
                if (density > (matrix[dy][dx] + 0.5) / 16) {
                  context.fillRect(x * 4 + dx, y * 4 + dy, 1, 1)
                }
              }
            }
          }
        }
      }

      canvas.hidden = false
      canvas.dataset.rendered = "true"
      field.dataset.rendered = "true"
    }

    const updateVisibility = () => {
      field.dataset.motion = document.visibilityState === "visible" ? "running" : "paused"
      if (document.visibilityState === "visible") scheduleTexture()
    }
    const scheduleTexture = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(renderTexture)
    }
    const resizeObserver = new ResizeObserver(scheduleTexture)
    resizeObserver.observe(field)
    updateVisibility()
    document.addEventListener("visibilitychange", updateVisibility)
    image.addEventListener("load", scheduleTexture)
    scheduleTexture()
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      document.removeEventListener("visibilitychange", updateVisibility)
      image.removeEventListener("load", scheduleTexture)
    }
  }, [artwork, appearance.effect, appearance.color])

  return (
    <div ref={fieldRef} data-testid="standby-field" data-effect={appearance.effect} data-color={appearance.color} data-animate={appearance.motion} aria-hidden="true" className="standby-field pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <GameArtwork src={artwork} alt="" sizes="100vw" className="standby-artwork absolute inset-0 opacity-30 saturate-75" priority />
      <canvas data-testid="standby-ascii" className="standby-ascii absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/65" />
      <div className="standby-pointer-glow absolute inset-0" />
    </div>
  )
}
