"use client"

import { useState } from "react"
import type { Resident } from "@/lib/types"
import { DECK_CAPACITY } from "@/lib/settlement/layout"
import type { Layout } from "@/lib/settlement/types"

interface ArrangePanelProps {
  layout: Layout
  residents: Resident[]
  canUndo: boolean
  saving: boolean
  error: string | null
  onMove: (gameId: string, deck: number, cell: number) => void
  onUndo: () => void
  onReset: () => void
  onDone: () => void
  onCancel: () => void
}

const button = "min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground disabled:opacity-50"

export function ArrangePanel({ layout, residents, canUndo, saving, error, onMove, onUndo, onReset, onDone, onCancel }: ArrangePanelProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const nameOf = (gameId: string) => residents.find((r) => r.game_id === gameId)?.game?.name ?? "A game"
  const spotOf = (gameId: string) => layout.placements.find((p) => p.gameId === gameId)
  const occupant = (deck: number, cell: number) => layout.placements.find((p) => p.deck === deck && p.slot === cell)
  const current = picked ? spotOf(picked) : undefined

  return (
    <section aria-label="Arrange" className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Pick a home, then pick where it goes. If a home is already there, the two swap.
      </p>
      <ul aria-label="Pick a home" className="flex gap-1.5 overflow-x-auto pb-1">
        {layout.placements.map((p) => (
          <li key={p.gameId} className="shrink-0">
            <button
              type="button"
              aria-pressed={picked === p.gameId}
              onClick={() => setPicked(picked === p.gameId ? null : p.gameId)}
              className={`max-w-48 truncate rounded-full border px-3 py-1 text-sm ${
                picked === p.gameId ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {nameOf(p.gameId)} · Deck {p.deck + 1}, spot {p.slot + 1}
            </button>
          </li>
        ))}
      </ul>
      {picked && current && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-foreground">Where should {nameOf(picked)} go?</p>
          <ul aria-label="Move to" className="flex flex-wrap gap-1.5">
            {layout.decks.flatMap((deck) =>
              Array.from({ length: DECK_CAPACITY }, (_, cell) => {
                if (deck.index === current.deck && cell === current.slot) return null
                const there = occupant(deck.index, cell)
                const label = `Deck ${deck.index + 1}, spot ${cell + 1}`
                return (
                  <li key={`${deck.index}:${cell}`}>
                    <button
                      type="button"
                      aria-label={there ? `${label}, swap with ${nameOf(there.gameId)}` : `${label}, free`}
                      onClick={() => onMove(picked, deck.index, cell)}
                      className="min-h-11 rounded-lg border border-border px-3 text-sm text-muted-foreground"
                    >
                      {label}
                      <span className="block text-xs">{there ? `Swap with ${nameOf(there.gameId)}` : "Free"}</span>
                    </button>
                  </li>
                )
              }),
            )}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={onUndo} disabled={!canUndo || saving}>Undo</button>
        <button type="button" className={button} onClick={onReset} disabled={saving}>Reset</button>
        <button type="button" className={button} onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className={`${button} border-primary bg-primary/15`} onClick={onDone} disabled={saving}>
          {saving ? "Saving" : "Done"}
        </button>
      </div>
    </section>
  )
}
