"use client"

import { Check, House } from "lucide-react"
import type { CompletedGame, Game, Postcard, Resident } from "@/lib/types"
import { PostcardsList } from "./postcards-list"
import { GameArtwork } from "./game-artwork"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./ui/carousel"

interface HomeViewProps {
  residents: Resident[]
  completedGames: CompletedGame[]
  postcards: Postcard[]
  invitedGame: Game | null
}

function HolographicStamp({ kind }: { kind: "completed" | "arrived" }) {
  const isCompleted = kind === "completed"
  const background = isCompleted
    ? "linear-gradient(115deg, color-mix(in srgb, var(--primary) 38%, var(--card)), color-mix(in srgb, var(--info) 24%, var(--card)), color-mix(in srgb, var(--emote) 30%, var(--card)))"
    : "linear-gradient(115deg, color-mix(in srgb, var(--info) 42%, var(--card)), color-mix(in srgb, var(--emote) 32%, var(--card)), color-mix(in srgb, var(--primary) 24%, var(--card)))"
  const label = isCompleted ? "Completed" : "Arrived"
  const Icon = isCompleted ? Check : House

  return (
    <span
      className={`group/stamp relative isolate inline-flex min-h-7 items-center gap-1.5 overflow-hidden rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground shadow-sm ${
        isCompleted ? "rotate-[-2deg] border-primary/55" : "rotate-[2deg] border-info/55"
      }`}
      style={{ background }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/20" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover/stamp:translate-x-[400%] motion-reduce:transition-none" />
      <Icon aria-hidden="true" className="relative size-3" />
      <span className="relative">{label}</span>
    </span>
  )
}

export function HomeView({ residents, completedGames, postcards, invitedGame }: HomeViewProps) {
  const orderedResidents = [...residents].sort(
    (a, b) => Date.parse(b.arrived_at) - Date.parse(a.arrived_at)
  )
  const orderedCompletedGames = [...completedGames].sort(
    (a, b) => Date.parse(b.completed_at ?? b.created_at) - Date.parse(a.completed_at ?? a.created_at)
  )
  const residentGameIds = new Set(residents.map((resident) => resident.game_id))

  return (
    <div className="flex min-h-dvh min-w-0 flex-col px-4 pb-24 sm:px-6">
      <section aria-labelledby="home-title" className="mb-7 pt-2">
        {orderedCompletedGames.length ? (
          <Carousel
            opts={{ align: "start", containScroll: "trimSnaps" }}
            aria-label="Completed game cards"
          >
            <header className="mb-4 flex items-center justify-between gap-4">
              <h1 id="home-title" className="text-2xl font-bold text-foreground">Completed games</h1>
              {orderedCompletedGames.length > 1 ? (
                <div className="flex shrink-0 gap-2">
                  <CarouselPrevious className="static size-11 translate-y-0" />
                  <CarouselNext className="static size-11 translate-y-0" />
                </div>
              ) : null}
            </header>
            <CarouselContent className="-ml-3">
              {orderedCompletedGames.map((completed) => (
                <CarouselItem
                  key={completed.game_id}
                  className="basis-[84%] pl-3 sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4"
                >
                  <article className="relative isolate flex aspect-[4/3] flex-col overflow-hidden rounded-xl border border-border bg-card">
                    <GameArtwork
                      src={completed.game.header_image}
                      alt=""
                      sizes="(max-width: 639px) 84vw, (max-width: 1023px) 50vw, (max-width: 1535px) 33vw, 25vw"
                      className="absolute inset-0 z-0"
                    />
                    <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-t from-background/95 via-background/30 to-background/5" />
                    <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
                      <HolographicStamp kind="completed" />
                      {residentGameIds.has(completed.game_id) ? <HolographicStamp kind="arrived" /> : null}
                    </div>
                    <div className="relative z-20 mt-auto p-4 pt-16">
                      <h2 className="line-clamp-2 font-semibold text-foreground">{completed.game.name}</h2>
                    </div>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <>
            <h1 id="home-title" className="text-2xl font-bold text-foreground">Completed games</h1>
            <p className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No completed games yet.
            </p>
          </>
        )}
      </section>

      {invitedGame ? (
        <section aria-labelledby="home-on-the-way" className="mb-7">
          <h2 id="home-on-the-way" className="mb-3 text-lg font-semibold text-foreground">On the way</h2>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="relative h-12 w-[72px] shrink-0 overflow-hidden rounded">
              <GameArtwork src={invitedGame.header_image} alt="" sizes="72px" className="absolute inset-0" />
            </div>
            <p className="min-w-0 flex-1 font-medium text-foreground line-clamp-2">{invitedGame.name}</p>
          </div>
        </section>
      ) : null}

      {orderedResidents.length ? (
        <section aria-labelledby="home-arrivals" className="mb-7">
          <h2 id="home-arrivals" className="mb-4 text-lg font-semibold text-foreground">Arrivals</h2>
          <ol className="ml-2 border-l border-primary/40 pl-5">
            {orderedResidents.map((resident) => (
              <li key={`${resident.user_id}-${resident.game_id}`} className="relative pb-5 last:pb-0">
                <span aria-hidden="true" className="absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                <time dateTime={resident.arrived_at} className="block text-sm text-muted-foreground">
                  {new Date(resident.arrived_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
                <p className="mt-1 font-medium text-foreground">
                  {resident.game?.name ?? "Game details unavailable"}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {postcards.length ? (
        <details className="mb-6 rounded-xl border border-border bg-card/50 p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-foreground">
            Keepsakes ({postcards.length})
          </summary>
          <div className="mt-4">
            <PostcardsList postcards={postcards} />
          </div>
        </details>
      ) : null}
    </div>
  )
}
