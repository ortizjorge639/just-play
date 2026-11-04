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
    <div className="flex flex-col items-start gap-1 text-left">
      <h1 className="text-2xl font-bold text-foreground">{displayName || "Player"}</h1>
      {card?.tagline ? <p className="text-sm text-foreground/80">{card.tagline}</p> : null}
      {card?.play_style ? <p className="text-xs text-muted-foreground">{card.play_style}</p> : null}
      {favorites.length > 0 ? (
        <ul aria-label="Favorite games" className="mt-2 flex justify-start gap-3">
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
        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.687a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
        </svg>
        Edit card
      </button>
    </div>
  )
}
