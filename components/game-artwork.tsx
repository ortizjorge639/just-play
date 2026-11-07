"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

interface GameArtworkProps {
  src: string
  alt: string
  sizes: string
  priority?: boolean
  className?: string
  imageClassName?: string
}

export function GameArtwork({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
  imageClassName = "",
}: GameArtworkProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const artRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [corsFailedSrc, setCorsFailedSrc] = useState<string | null>(null)

  const renderDither = useCallback(() => {
    const image = imageRef.current
    const art = artRef.current
    const canvas = canvasRef.current
    if (!image?.complete || !image.naturalWidth || !art || !canvas || canvas.hidden) return

    const bounds = art.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return

    const scale = 0.72
    const width = Math.max(1, Math.min(960, Math.round(bounds.width * scale)))
    const height = Math.max(1, Math.round(width * bounds.height / bounds.width))
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return

    const sourceRatio = image.naturalWidth / image.naturalHeight
    const targetRatio = bounds.width / bounds.height
    let sx = 0
    let sy = 0
    let sw = image.naturalWidth
    let sh = image.naturalHeight
    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio
      sx = (image.naturalWidth - sw) / 2
    } else {
      sh = image.naturalWidth / targetRatio
      sy = (image.naturalHeight - sh) / 2
    }

    context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
    let pixels: ImageData
    try {
      pixels = context.getImageData(0, 0, width, height)
    } catch (error) {
      if (error instanceof DOMException && error.name === "SecurityError") {
        canvas.hidden = true
        console.warn("[game-artwork] Dither overlay unavailable for this image.", error)
        return
      }
      throw error
    }
    const matrix = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4
        const threshold = (matrix[y % 4][x % 4] / 16 - 0.5) * 24
        for (let channel = 0; channel < 3; channel++) {
          const value = Math.max(0, Math.min(255, pixels.data[offset + channel] + threshold))
          pixels.data[offset + channel] = Math.round(value / 32) * 32
        }
      }
    }
    context.putImageData(pixels, 0, 0)
  }, [])

  useEffect(() => {
    const art = artRef.current
    const canvas = canvasRef.current
    if (!art || !canvas) return

    canvas.hidden = false
    let frame = 0
    const scheduleDraw = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(renderDither)
    }
    const observer = new ResizeObserver(scheduleDraw)
    observer.observe(art)
    if (imageRef.current?.complete) scheduleDraw()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [renderDither, src])

  return (
    <div ref={artRef} className={`game-art ${className}`}>
      <Image
        ref={imageRef}
        src={src}
        crossOrigin={corsFailedSrc === src ? undefined : "anonymous"}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${imageClassName}`}
        onLoad={renderDither}
        onError={() => {
          if (corsFailedSrc === src) return
          console.warn("[game-artwork] Canvas-safe image loading failed; retrying without the overlay.", src)
          setCorsFailedSrc(src)
        }}
      />
      <canvas ref={canvasRef} aria-hidden="true" className="game-art-dither" />
    </div>
  )
}
