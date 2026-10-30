"use client"

import Image from "next/image"
import { useCallback, useRef, useState } from "react"
import type { Game, NameCard, Postcard, Resident, SettlementPiece, SavedSpot } from "@/lib/types"
import { ResidentPortrait } from "./resident-portrait"
import { SettlementView } from "./settlement-view"
import { WorldView } from "./world/world-view"
import { EmptyPlot } from "./empty-plot"
import { PostcardsList } from "./postcards-list"
import { layoutSettlement } from "@/lib/settlement/layout"

interface HomeViewProps {
  displayName: string | null
  residents: Resident[]
  pieces?: SettlementPiece[]
  savedLayout?: SavedSpot[]
  postcards: Postcard[]
  invitedGame: Game | null
  nameCard?: NameCard | null
}

export function HomeView({ displayName, residents, pieces = [], savedLayout = [], postcards, invitedGame, nameCard }: HomeViewProps) {
  const [expanded, setExpanded] = useState(false)
  const expandButton = useRef<HTMLButtonElement>(null)
  const leaveSettlement = useCallback(() => {
    setExpanded(false)
    requestAnimationFrame(() => expandButton.current?.focus())
  }, [])
  const deckCount = layoutSettlement(residents, savedLayout).decks.length
  return <div className="flex min-h-dvh min-w-0 flex-col px-4 sm:px-6">
    <header className="pb-4 pt-2 text-center">
      <h1 className="text-2xl font-bold text-foreground">{displayName || "Player"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">A little place for the games that stay with you.</p>
    </header>
    {expanded ? residents.length ? <SettlementView residents={residents} pieces={pieces} savedLayout={savedLayout} fullscreen onBack={leaveSettlement} ownerName={displayName} tagline={nameCard?.tagline} /> : <EmptyPlot onBack={leaveSettlement} /> : <WorldView residents={residents} pieces={pieces} savedLayout={savedLayout} />}
    <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{residents.length} {residents.length === 1 ? "home" : "homes"} on {deckCount} {deckCount === 1 ? "deck" : "decks"}</p>
      <button ref={expandButton} type="button" className="min-h-11 rounded-full border border-border px-4 text-sm text-foreground" onClick={() => setExpanded(true)}>Expand world</button>
    </div>
    <details className="mb-6 rounded-2xl border border-border bg-card/50 p-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-foreground">Residents &amp; archive</summary>
      {residents.length ? <section className="mt-3" aria-labelledby="home-residents">
        <h2 id="home-residents" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lives here</h2>
        <ul className="grid grid-cols-1 gap-3">{residents.map(resident => <li key={`${resident.user_id}-${resident.game_id}`}><ResidentPortrait resident={resident} /></li>)}</ul>
      </section> : <p className="py-3 text-sm text-muted-foreground">No residents yet. There is no rush.</p>}
      {invitedGame ? <section className="mt-4" aria-labelledby="home-on-the-way">
        <h2 id="home-on-the-way" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">On the way</h2>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Image src={invitedGame.header_image} alt="" width={56} height={56} className="rounded object-cover" />
          <p className="min-w-0 flex-1 font-medium text-foreground line-clamp-2">{invitedGame.name}</p>
        </div>
      </section> : null}
      {postcards.length ? <div className="mt-4"><PostcardsList postcards={postcards} /></div> : null}
    </details>
  </div>
}
