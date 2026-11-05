"use client"

import type { Game, NameCard as NameCardData } from "@/lib/types"
import { GameArtwork } from "./game-artwork"

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
  const featuredFavorite = favorites[0]

  return (
    <section aria-label="Player profile" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <h1 className="max-w-full text-xl font-bold text-foreground sm:text-2xl">{displayName || "Player"}</h1>
          {card?.tagline ? <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{card.tagline}</p> : null}
          {card?.play_style ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{card.play_style}</p> : null}
          {favorites.length > 1 ? (
            <p className="mt-2 text-xs text-muted-foreground">+{favorites.length - 1} more favorite {favorites.length === 2 ? "game" : "games"}</p>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.687a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Edit card
          </button>
        </div>
        {featuredFavorite ? (
          <div data-testid="favorite-game-art" className="relative aspect-[4/3] w-[clamp(7rem,28vw,12.5rem)] shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
            <GameArtwork
              src={featuredFavorite.header_image}
              alt=""
              sizes="(max-width: 639px) 28vw, 200px"
              className="absolute inset-0"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
            <div className="absolute inset-x-2 bottom-2">
              <span className="block text-xs font-semibold uppercase tracking-wider text-foreground/75">Favorite game</span>
              <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">{featuredFavorite.name}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
