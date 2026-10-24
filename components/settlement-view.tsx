"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import type { Resident, SettlementPiece } from "@/lib/types"
import { layoutSettlement, DECK_CAPACITY } from "@/lib/settlement/layout"
import { SettlementScene, type SpotHints } from "./settlement/scene"
import { PARTS } from "@/lib/settlement/catalog"
import { ResidentPortrait } from "./resident-portrait"

interface DeckMapProps {
  residents: Resident[]
}

const FAMILY_TINT: Record<string, string> = {
  cozy: "bg-amber-200/20",
  fantasy: "bg-violet-300/20",
  puzzle: "bg-sky-300/20",
  action: "bg-rose-300/20",
  other: "bg-stone-300/20",
}

export function DeckMap({ residents }: DeckMapProps) {
  const layout = layoutSettlement(residents)
  const byGame = new Map(residents.map((r) => [r.game_id, r]))
  const partById = new Map(PARTS.map((p) => [p.id, p]))

  return (
    <div className="flex flex-col items-center gap-0" data-testid="settlement-view">
      {layout.decks.map((deck) => {
        const placed = layout.placements.filter((p) => p.deck === deck.index)
        return (
          <div key={deck.index} className="flex w-full flex-col items-center">
            {deck.parent !== null && (
              <div className="h-5 w-0.5 bg-border" aria-hidden="true" />
            )}
            <section
              aria-label={`Deck ${deck.index + 1}`}
              className="w-full rounded-2xl border border-border bg-card p-3"
            >
              <ul className="grid grid-cols-3 gap-2">
                {Array.from({ length: DECK_CAPACITY }, (_, slot) => {
                  const placement = placed.find((p) => p.slot === slot)
                  if (!placement) {
                    return (
                      <li
                        key={slot}
                        aria-hidden="true"
                        className="aspect-square rounded-xl border border-dashed border-border/60"
                      />
                    )
                  }
                  const resident = byGame.get(placement.gameId)
                  const part = partById.get(placement.partId)
                  const name = resident?.game?.name ?? "A game"
                  return (
                    <li
                      key={slot}
                      className={`relative aspect-square overflow-hidden rounded-xl border border-border ${FAMILY_TINT[part?.family ?? "other"]}`}
                    >
                      {resident?.game?.header_image && (
                        <Image
                          src={resident.game.header_image}
                          alt=""
                          fill
                          sizes="120px"
                          className="object-cover opacity-80"
                        />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-background/80 px-1.5 py-1 text-[11px] leading-tight text-foreground line-clamp-2">
                        {name}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        )
      })}
    </div>
  )
}

export function SettlementView({ residents, pieces = [] }: DeckMapProps & { pieces?: SettlementPiece[] }) {
  const layout = useMemo(() => layoutSettlement(residents), [residents])
  const [selected, setSelected] = useState<Resident["game_id"] | null>(null)
  const [hints, setHints] = useState<SpotHints | undefined>(undefined)
  const chosen = residents.find((r) => r.game_id === selected)
  const ordered = layout.placements
    .map((p) => residents.find((r) => r.game_id === p.gameId))
    .filter((r): r is Resident => !!r)

  return (
    <div className="flex flex-col gap-3">
      <SettlementScene
        layout={layout}
        residentCount={residents.length}
        fallback={<DeckMap residents={residents} />}
        onSelect={setSelected}
        pieces={pieces}
        hints={hints}
        onSpot={(spot) => setHints((h) => (h ? { ...h, active: spot } : h))}
      />
      <ul aria-label="Homes" className="flex gap-1.5 overflow-x-auto pb-1">
        {ordered.map((resident) => (
          <li key={resident.game_id} className="shrink-0">
            <button
              type="button"
              aria-pressed={selected === resident.game_id}
              onClick={() => { setHints(undefined); setSelected(selected === resident.game_id ? null : resident.game_id) }}
              className={`max-w-40 truncate rounded-full border px-3 py-1 text-sm ${
                selected === resident.game_id
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {resident.game?.name ?? "A game"}
            </button>
          </li>
        ))}
      </ul>
      {chosen && <ResidentPortrait key={chosen.game_id} resident={chosen} pieces={pieces} deckCount={layout.decks.length} hints={hints} onSpots={setHints} />}
    </div>
  )
}
