"use client"

import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import type { Game, Postcard, Resident } from "@/lib/types"
import { ResidentPortrait } from "./resident-portrait"
import { PostcardsList } from "./postcards-list"
import { layoutSettlement } from "@/lib/settlement/layout"

interface HomeViewProps {
  displayName: string | null
  residents: Resident[]
  postcards: Postcard[]
  invitedGame: Game | null
}

export function HomeView({ displayName, residents, postcards, invitedGame }: HomeViewProps) {
  const prefersReducedMotion = useReducedMotion()
  const deckCount = layoutSettlement(residents).decks.length
  const isEmpty = residents.length === 0 && postcards.length === 0 && !invitedGame

  return (
    <div className="flex flex-col min-h-dvh px-6">
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-2 pb-6 text-center"
      >
        <h1 className="text-2xl font-bold text-foreground">
          {displayName || "Player"}
        </h1>
      </motion.div>

      {isEmpty && (
        <p className="text-sm text-muted-foreground text-center">
          Games you finish will live here.
        </p>
      )}

      {residents.length > 0 && (
        <section className="mb-6" aria-labelledby="home-residents">
          <h2
            id="home-residents"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"
          >
            Lives here
          </h2>
          <p className="text-sm text-muted-foreground mb-3 -mt-1">
            {residents.length} {residents.length === 1 ? "home" : "homes"} on {deckCount}{" "}
            {deckCount === 1 ? "deck" : "decks"}
          </p>
          <ul className="grid grid-cols-1 gap-2.5">
            {residents.map((resident, i) => (
              <motion.li
                key={`${resident.user_id}-${resident.game_id}`}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? undefined : { delay: 0.05 * i }}
              >
                <ResidentPortrait resident={resident} />
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {invitedGame && (
        <section className="mb-6" aria-labelledby="home-on-the-way">
          <h2
            id="home-on-the-way"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3"
          >
            On the way
          </h2>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Image
              src={invitedGame.header_image}
              alt=""
              width={56}
              height={56}
              className="rounded object-cover"
            />
            <p className="min-w-0 flex-1 font-medium text-foreground line-clamp-2">
              {invitedGame.name}
            </p>
          </div>
        </section>
      )}

      {postcards.length > 0 && <PostcardsList postcards={postcards} />}
    </div>
  )
}
