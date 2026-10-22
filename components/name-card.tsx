"use client"

import Image from "next/image"
import type { Game, NameCard as NameCardData } from "@/lib/types"

interface NameCardProps {
  displayName: string | null
  card: NameCardData | null
  library: Game[]
  onEdit: () => void
}

export function NameCard({ displayName, card, library, onEdit }: NameCardProps) {
  const favorites = (card?.favorite_game_ids ?? [])
    .map(id => library.find(g => g.id === id))
    .filter((g): g is Game => !!g)

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className="text-2xl font-bold text-foreground">{displayName || "Player"}</h1>
      {card?.tagline ? <p className="text-sm text-foreground/80">{card.tagline}</p> : null}
      {card?.play_style ? <p className="text-xs text-muted-foreground">{card.play_style}</p> : null}
      {favorites.length > 0 ? (
        <ul aria-label="Favorite games" className="mt-2 flex justify-center gap-3">
          {favorites.map(g => (
            <li key={g.id} className="flex w-16 flex-col items-center gap-1">
              <div className="relative h-10 w-16 overflow-hidden rounded-md bg-secondary">
                <Image src={g.header_image} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{g.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        className="mt-1 min-h-11 text-sm text-muted-foreground underline"
      >
        Edit card
      </button>
    </div>
  )
}
