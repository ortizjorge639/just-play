"use client"

import { memo, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { Resident, SavedSpot, SettlementPiece } from "@/lib/types"
import { layoutSettlement } from "@/lib/settlement/layout"
import { SettlementScene } from "../settlement/scene"
import { DeckMap } from "../settlement-view"
import { ResidentPortrait } from "../resident-portrait"
import { setSoundOn, soundOn, subscribeSound } from "../settlement/sound"

const NO_PIECES: SettlementPiece[] = []
const NO_LAYOUT: SavedSpot[] = []

// A window, not a second simulation or session owner. Both surfaces use this exact projection.
export interface WorldInputs {
  residents: Resident[]
  pieces?: SettlementPiece[]
  savedLayout?: SavedSpot[]
  immersive?: boolean
}

export const WorldView = memo(function WorldView({ residents, pieces = NO_PIECES, savedLayout = NO_LAYOUT, immersive = false }: WorldInputs) {
  const layout = useMemo(() => layoutSettlement(residents, savedLayout), [residents, savedLayout])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = residents.find(resident => resident.game_id === selectedId)
  const sound = useSyncExternalStore(subscribeSound, soundOn, () => false)
  const picker = useRef<HTMLSelectElement>(null)
  return <section aria-label="Your home" className={`relative w-full min-w-0${immersive ? " h-full" : ""}`}>
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-card ${immersive ? "h-full" : "h-[44dvh] min-h-64 max-h-[36rem]"}`}>
      <SettlementScene layout={layout} residentCount={residents.length} pieces={pieces} fullscreen
        onSelect={setSelectedId}
        fallback={<div className="h-full overflow-y-auto p-3"><DeckMap residents={residents} saved={savedLayout} /></div>} />
      {residents.length === 0 ? <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl bg-background/90 p-3 text-center text-sm text-foreground">Your first home goes here. Games you finish will live here.</p> : null}
    </div>
    <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
      {residents.length ? <select ref={picker} aria-label="Inspect resident" value={selectedId ?? ""}
        className="min-h-11 max-w-[55%] rounded-xl border border-border bg-background/95 px-3 text-sm text-foreground"
        onChange={event => setSelectedId(event.target.value || null)}>
        <option value="">Residents</option>
        {residents.map(resident => <option key={resident.game_id} value={resident.game_id}>{resident.game?.name ?? "A game"}</option>)}
      </select> : null}
      <button type="button" aria-label="World sound" aria-pressed={sound}
        className="ml-auto min-h-11 rounded-full border border-border bg-background/95 px-4 text-sm text-foreground"
        onClick={() => setSoundOn(!sound)}>Sound {sound ? "on" : "off"}</button>
    </div>
    {selected ? <div className={immersive ? "absolute inset-x-3 bottom-3 z-10 max-h-[80%] overflow-y-auto rounded-xl bg-background p-3 text-foreground" : "mt-3"}>
      <button type="button" className="mb-2 min-h-11 rounded-full border border-border px-4 text-sm" onClick={() => { setSelectedId(null); picker.current?.focus({ preventScroll: true }) }}>Close resident</button>
      <ResidentPortrait resident={selected} />
    </div> : null}
  </section>
})
