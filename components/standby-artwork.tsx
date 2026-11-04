"use client"

import { useEffect, useRef } from "react"
import { GameArtwork } from "./game-artwork"
import "./standby-artwork.css"

export function StandbyArtwork({ artwork }: { artwork: string }) {
  const fieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const updateVisibility = () => {
      field.dataset.motion = document.visibilityState === "visible" ? "running" : "paused"
    }
    updateVisibility()
    document.addEventListener("visibilitychange", updateVisibility)
    return () => document.removeEventListener("visibilitychange", updateVisibility)
  }, [])

  return (
    <div ref={fieldRef} data-testid="standby-field" aria-hidden="true" className="standby-field pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <GameArtwork src={artwork} alt="" sizes="100vw" className="standby-artwork absolute inset-0 opacity-60 saturate-75" priority />
      <div className="standby-atmosphere">
        {[0, 1, 2].map(form => (
          <div key={form} className="standby-color-form" style={{ backgroundImage: `url(${JSON.stringify(artwork)})` }} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/55 to-black/80" />
    </div>
  )
}
