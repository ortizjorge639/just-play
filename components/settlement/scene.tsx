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
  onSpot?: (spot: { deck: number; anchor: number }) => void
  fullscreen?: boolean
  arranging?: boolean
  arriving?: string[]
  onArrived?: (gameId: string) => void
  reaction?: { gameId: string; emote: string; nonce: number } | null
  onDrop?: (drop: { gameId: string; deck: number; cell: number }) => void
}

export interface SpotHints {
  spots: { deck: number; anchor: number }[]
  active: { deck: number; anchor: number } | null
}

// Draws the approved deck art. If WebGL or the art fails, the 2D view takes over.
export function SettlementScene({ layout, residentCount, fallback, onSelect, pieces, hints, onSpot, fullscreen, arranging, reaction, arriving, onArrived, onDrop }: SettlementSceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const select = useRef(onSelect)
  useEffect(() => { select.current = onSelect })
  const spot = useRef(onSpot)
  useEffect(() => { spot.current = onSpot })
  const arrived = useRef(onArrived)
  useEffect(() => { arrived.current = onArrived })
  const drop = useRef(onDrop)
  useEffect(() => { drop.current = onDrop })
  const latestPieces = useRef(pieces)
  useEffect(() => { latestPieces.current = pieces })
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")
  const [mounts, setMounts] = useState(0)

  useEffect(() => {
    const element = host.current
    if (!element) return
    const controller = new AbortController()
    const fail = () => {
      if (controller.signal.aborted) return
      controller.abort()
      setState("failed")
    }
    element.addEventListener("settlement-error", fail)
    void import("./renderer")
      .then(({ mountSettlement }) => mountSettlement(element, layout, controller.signal, (id) => select.current?.(id), latestPieces.current))
      .then(() => { if (!controller.signal.aborted) { setState("ready"); setMounts((n) => n + 1) } })
      .catch(fail)
    return () => {
      element.removeEventListener("settlement-error", fail)
      controller.abort()
    }
  }, [layout])

  useEffect(() => {
    if (state !== "ready") return
    host.current?.dispatchEvent(new CustomEvent("settlement-pieces", { detail: pieces ?? [] }))
  }, [pieces, state, mounts])

  useEffect(() => {
    const element = host.current
    if (!element) return
    const listener = (event: Event) => spot.current?.((event as CustomEvent<{ deck: number; anchor: number }>).detail)
    element.addEventListener("settlement-spot", listener)
    return () => element.removeEventListener("settlement-spot", listener)
  }, [state])

  useEffect(() => {
    const element = host.current
    if (!element) return
    const listener = (event: Event) => drop.current?.((event as CustomEvent<{ gameId: string; deck: number; cell: number }>).detail)
    element.addEventListener("settlement-drop", listener)
    return () => element.removeEventListener("settlement-drop", listener)
  }, [state])

  useEffect(() => {
    const element = host.current
    if (!element) return
    const listener = (event: Event) => arrived.current?.((event as CustomEvent<string>).detail)
    element.addEventListener("settlement-arrived", listener)
    return () => element.removeEventListener("settlement-arrived", listener)
  }, [state])

  const arrivalKey = (arriving ?? []).join(",")
  useEffect(() => {
    if (state !== "ready" || !arrivalKey) return
    host.current?.dispatchEvent(new CustomEvent("settlement-arrive", { detail: arrivalKey.split(",") }))
  }, [arrivalKey, state, mounts])

  useEffect(() => {
    if (state !== "ready" || !reaction) return
    host.current?.dispatchEvent(new CustomEvent("settlement-react", { detail: reaction }))
  }, [reaction, state])

  useEffect(() => {
    if (state !== "ready") return
    host.current?.dispatchEvent(new CustomEvent("settlement-arrange", { detail: !!arranging }))
  }, [arranging, state, mounts])

  useEffect(() => {
    if (state !== "ready") return
    host.current?.dispatchEvent(new CustomEvent("settlement-hints", { detail: hints ?? { spots: [], active: null } }))
  }, [hints, state, mounts])

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
        className={
          fullscreen
            ? "h-full w-full touch-none overflow-hidden bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            : "h-80 w-full touch-none overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-2xl border border-border bg-card"
        }
      />
      {state === "loading" && (
        fullscreen ? (
          <div role="status" className="absolute inset-0 grid place-items-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">Getting your settlement ready</p>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/2 rounded-full bg-primary motion-safe:animate-[settlement-load_1.4s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="sr-only" role="status">Loading the settlement</div>
        )
      )}
    </>
  )
}
