"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  decay: number
  color: string
}

interface XPParticlesProps {
  /** Center x of the burst origin (viewport px) */
  originX: number
  /** Center y of the burst origin (viewport px) */
  originY: number
  /** Number of particles */
  count?: number
  /** Spread velocity range */
  spread?: number
  /** Particle colors */
  colors?: string[]
  /** Called when all particles have faded */
  onComplete?: () => void
}

const DEFAULT_COLORS = ["#F59E0B", "#FBBF24", "#FCD34D", "#F97316", "#FDE68A"]

export function XPParticles({
  originX,
  originY,
  count = 24,
  spread = 6,
  colors = DEFAULT_COLORS,
  onComplete,
}: XPParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Create particles
    const particles: Particle[] = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2
      const velocity = (Math.random() * 0.6 + 0.4) * spread
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 2, // bias upward
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.008,
        color: colors[Math.floor(Math.random() * colors.length)],
      }
    })

    let animFrame: number
    let alive = true

    const animate = () => {
      if (!alive) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let anyVisible = false

      for (const p of particles) {
        if (p.alpha <= 0) continue
        anyVisible = true

        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08 // gravity
        p.vx *= 0.99 // drag
        p.alpha -= p.decay

        ctx.globalAlpha = Math.max(p.alpha, 0)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      if (anyVisible) {
        animFrame = requestAnimationFrame(animate)
      } else {
        onComplete?.()
      }
    }

    animFrame = requestAnimationFrame(animate)

    return () => {
      alive = false
      cancelAnimationFrame(animFrame)
    }
  }, [originX, originY, count, spread, colors, onComplete])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[70] pointer-events-none"
      style={{ width: "100vw", height: "100vh" }}
    />
  )
}
