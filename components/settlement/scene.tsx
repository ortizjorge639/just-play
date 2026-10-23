"use client"

import { useEffect, useRef, useState } from "react"
import type { Resident } from "@/lib/types"
import type { SettlementPiece } from "@/lib/types"
import type { Layout } from "@/lib/settlement/types"

interface SettlementSceneProps {
  layout: Layout
  residentCount: number
  fallback: React.ReactNode
  onSelect?: (gameId: Resident["game_id"]) => void
  pieces?: SettlementPiece[]
  hints?: SpotHints
}

export interface SpotHints {
  spots: { deck: number; anchor: number }[]
  active: { deck: number; anchor: number } | null
}

// Draws the approved deck art. If WebGL or the art fails, the 2D view takes over.
export function SettlementScene({ layout, residentCount, fallback, onSelect, pieces, hints }: SettlementSceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const select = useRef(onSelect)
  useEffect(() => { select.current = onSelect })
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    const element = host.current
    if (!element) return
    const controller = new AbortController()
    void import("./renderer")
      .then(({ mountSettlement }) => mountSettlement(element, layout, controller.signal, (id) => select.current?.(id), pieces))
      .then(() => { if (!controller.signal.aborted) setState("ready") })
      .catch(() => { if (!controller.signal.aborted) setState("failed") })
    return () => controller.abort()
  }, [layout, pieces])

  useEffect(() => {
    if (state !== "ready") return
    host.current?.dispatchEvent(new CustomEvent("settlement-hints", { detail: hints ?? { spots: [], active: null } }))
  }, [hints, state])

  if (state === "failed") return <>{fallback}</>

  const decks = layout.decks.length
  return (
    <>
      <div
        ref={host}
        role="group"
        tabIndex={0}
        aria-roledescription="map"
        aria-label={`Settlement with ${residentCount} ${residentCount === 1 ? "home" : "homes"} on ${decks} ${decks === 1 ? "deck" : "decks"}. Tap a home to see who lives there. Drag or use arrow keys to move, scroll or plus and minus to zoom, 0 to reset.`}
        data-testid="settlement-3d"
        data-state={state}
        className="h-80 w-full touch-none overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-2xl border border-border bg-card"
      />
      {state === "loading" && <div className="sr-only" role="status">Loading the settlement</div>}
    </>
  )
}
