import Image from "next/image"
import type { Resident } from "@/lib/types"
import { layoutSettlement, DECK_CAPACITY } from "@/lib/settlement/layout"
import { PARTS } from "@/lib/settlement/catalog"

interface SettlementViewProps {
  residents: Resident[]
}

const FAMILY_TINT: Record<string, string> = {
  cozy: "bg-amber-200/20",
  fantasy: "bg-violet-300/20",
  puzzle: "bg-sky-300/20",
  action: "bg-rose-300/20",
  other: "bg-stone-300/20",
}

export function SettlementView({ residents }: SettlementViewProps) {
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
