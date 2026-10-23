"use client"

import { useEffect, useRef, useState } from "react"
import type { Layout } from "@/lib/settlement/types"

interface SettlementSceneProps {
  layout: Layout
  residentCount: number
  fallback: React.ReactNode
}

// Draws the approved deck art. If WebGL or the art fails, the 2D view takes over.
export function SettlementScene({ layout, residentCount, fallback }: SettlementSceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    const element = host.current
    if (!element) return
    const controller = new AbortController()
    void import("./renderer")
      .then(({ mountSettlement }) => mountSettlement(element, layout, controller.signal))
      .then(() => { if (!controller.signal.aborted) setState("ready") })
      .catch(() => { if (!controller.signal.aborted) setState("failed") })
    return () => controller.abort()
  }, [layout])

  if (state === "failed") return <>{fallback}</>

  const decks = layout.decks.length
  return (
    <>
      <div
        ref={host}
        role="img"
        aria-label={`Settlement with ${residentCount} ${residentCount === 1 ? "home" : "homes"} on ${decks} ${decks === 1 ? "deck" : "decks"}`}
        data-testid="settlement-3d"
        data-state={state}
        className="h-80 w-full overflow-hidden rounded-2xl border border-border bg-card"
      />
      {state === "loading" && <div className="sr-only" role="status">Loading the settlement</div>}
    </>
  )
}
