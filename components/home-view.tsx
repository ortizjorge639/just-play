"use client"

import Image from "next/image"
import type { Game, Postcard, Resident } from "@/lib/types"
import { PostcardsList } from "./postcards-list"

interface HomeViewProps {
  residents: Resident[]
  postcards: Postcard[]
  invitedGame: Game | null
}

export function HomeView({ residents, postcards, invitedGame }: HomeViewProps) {
  const orderedResidents = [...residents].sort(
    (a, b) => Date.parse(b.arrived_at) - Date.parse(a.arrived_at)
  )

  return (
    <div className="flex min-h-dvh min-w-0 flex-col px-4 pb-24 sm:px-6">
      <header className="pb-5 pt-2">
        <h1 id="home-title" className="text-2xl font-bold text-foreground">The games you made room for.</h1>
      </header>

      <section aria-labelledby="home-title" className="mb-7">
        {orderedResidents.length ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orderedResidents.map((resident) => (
              <li key={`${resident.user_id}-${resident.game_id}`}>
                <article className="relative isolate flex min-h-32 overflow-hidden rounded-xl border border-border bg-card">
                  {resident.game ? (
                    <>
                      <Image
                        src={resident.game.header_image}
                        alt=""
                        fill
                        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                        className="z-0 object-cover saturate-75"
                      />
                      <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-br from-primary/35 via-background/20 to-info/35" />
                      <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-t from-background/95 via-background/25 to-transparent" />
                    </>
                  ) : null}
                  <div className="relative z-20 mt-auto w-full p-4">
                    <h3 className="line-clamp-2 font-semibold text-white">
                      {resident.game?.name ?? "Game details unavailable"}
                    </h3>
                    <p className="mt-1 text-sm text-white/85">
                      Arrived {new Date(resident.arrived_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No residents yet. There is no rush.
          </p>
        )}
      </section>

      {invitedGame ? (
        <section aria-labelledby="home-on-the-way" className="mb-7">
          <h2 id="home-on-the-way" className="mb-3 text-lg font-semibold text-foreground">On the way</h2>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <Image src={invitedGame.header_image} alt="" width={72} height={48} className="rounded object-cover" />
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
