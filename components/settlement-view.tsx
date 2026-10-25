"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import Image from "next/image"
import type { Resident, SavedSpot, SettlementPiece } from "@/lib/types"
import { layoutSettlement, DECK_CAPACITY } from "@/lib/settlement/layout"
import { compactDecks, moveHome, sameSpots, toSpots, turnHome } from "@/lib/settlement/arrange"
import { ArrangePanel } from "./arrange-panel"
import { saveLayout } from "@/app/actions"
import { SettlementScene, type SpotHints } from "./settlement/scene"
import { setSoundOn, soundOn, subscribeSound } from "./settlement/sound"
import { PARTS } from "@/lib/settlement/catalog"
import { ResidentPortrait } from "./resident-portrait"
import { useFullscreenLayer } from "./use-fullscreen-layer"

interface DeckMapProps {
  residents: Resident[]
}

const HINT_KEY = "jp-settlement-hint"

const FAMILY_TINT: Record<string, string> = {
  cozy: "bg-amber-200/20",
  fantasy: "bg-violet-300/20",
  puzzle: "bg-sky-300/20",
  action: "bg-rose-300/20",
  other: "bg-stone-300/20",
}

export function DeckMap({ residents, saved = [] }: DeckMapProps & { saved?: SavedSpot[] }) {
  const layout = layoutSettlement(residents, saved)
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

const SEEN_KEY = "jp-seen-arrivals"
const RECENT_DAYS = 3
const readSeen = (): string[] => {
  try { const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); return Array.isArray(raw) ? raw : [] } catch { return [] }
}
const markSeen = (id: string) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), id])])) } catch { /* private mode: it may drop in again next visit */ }
}
// Someone who moved in lately and hasn't been seen dropping in yet.
const newcomers = (residents: Resident[]) => {
  const seen = readSeen()
  const since = Date.now() - RECENT_DAYS * 86_400_000
  return residents.filter((r) => new Date(r.arrived_at).getTime() >= since && !seen.includes(r.game_id)).map((r) => r.game_id)
}

export function SettlementView({ residents, pieces = [], savedLayout = [], fullscreen = false, onBack, ownerName, tagline }: DeckMapProps & { pieces?: SettlementPiece[]; savedLayout?: SavedSpot[]; fullscreen?: boolean; onBack?: () => void; ownerName?: string | null; tagline?: string | null }) {
  const [committed, setCommitted] = useState<SavedSpot[] | null>(null)
  const [draft, setDraft] = useState<SavedSpot[] | null>(null)
  const [history, setHistory] = useState<SavedSpot[][]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedNow = committed ?? savedLayout
  const layout = useMemo(() => layoutSettlement(residents, draft ?? savedNow), [residents, draft, savedNow])
  const arranging = draft !== null
  const startArranging = () => { setHints(undefined); setSelected(null); setSaveError(null); setPicked(null); setHistory([]); setDraft(toSpots(layoutSettlement(residents, savedNow))) }
  const stopArranging = () => { setDraft(null); setHistory([]); setSaveError(null) }
  const change = (next: SavedSpot[]) => { if (!draft) return; setHistory((h) => [...h, draft]); setDraft(next) }
  const finishArranging = async () => {
    if (!draft) return
    const original = toSpots(layoutSettlement(residents, savedNow))
    if (sameSpots(draft, original)) { stopArranging(); return }
    setSaving(true)
    setSaveError(null)
    const result = await saveLayout(draft)
    setSaving(false)
    if (!result.ok) { setSaveError(`${result.error ?? "Couldn't save that."} Your changes are still here.`); return }
    setCommitted(draft)
    stopArranging()
  }
  const [selected, setSelected] = useState<Resident["game_id"] | null>(null)
  const [hints, setHints] = useState<SpotHints | undefined>(undefined)
  const sound = useSyncExternalStore(subscribeSound, soundOn, () => true)
  const [arriving, setArriving] = useState<string[]>(() => newcomers(residents))
  const [reaction, setReaction] = useState<{ gameId: string; emote: string; nonce: number } | null>(null)
  const [said, setSaid] = useState<{ name: string; line: string } | null>(null)
  useEffect(() => {
    if (!said) return
    const timer = setTimeout(() => setSaid(null), 4500)
    return () => clearTimeout(timer)
  }, [said])
  const layer = useFullscreenLayer(onBack, fullscreen)
  const [hintSeen, setHintSeen] = useState(() => {
    if (!fullscreen) return true
    try { return window.localStorage.getItem(HINT_KEY) === "1" } catch { return true }
  })
  const dismissHintIfShown = () => { if (!hintSeen) dismissHint() }
  const dismissHint = () => {
    setHintSeen(true)
    try { window.localStorage.setItem(HINT_KEY, "1") } catch { /* storage unavailable: the hint just shows again next time */ }
  }
  const chosen = residents.find((r) => r.game_id === selected)
  const ordered = layout.placements
    .map((p) => residents.find((r) => r.game_id === p.gameId))
    .filter((r): r is Resident => !!r)

  const soundButton = (
    <button
      type="button"
      aria-pressed={sound}
      onClick={() => setSoundOn(!sound)}
      className="min-h-11 self-start text-sm text-muted-foreground underline"
    >
      {sound ? "Sound on" : "Sound off"}
    </button>
  )

  return (
    <div
      ref={layer}
      {...(fullscreen ? { role: "dialog", "aria-modal": true, "aria-label": "Your settlement" } : {})}
      className={fullscreen ? "fixed inset-0 z-[60] flex flex-col bg-background" : "flex flex-col gap-3"}
    >
      {fullscreen && (
        <header className="flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onBack}
            data-initial-focus
            className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground"
          >
            Back to Home
          </button>
          <div className="min-w-0 flex-1 px-3 text-center">
            <p className="truncate text-sm font-medium text-foreground">{ownerName ? `${ownerName}\u2019s settlement` : "Your settlement"}</p>
            {tagline ? <p className="truncate text-xs text-muted-foreground">{tagline}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            {residents.length > 1 && !arranging && (
              <button type="button" onClick={startArranging} className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground">
                Arrange
              </button>
            )}
            {soundButton}
          </div>
        </header>
      )}
      <div className={fullscreen ? "relative mt-2 min-h-0 flex-1 overflow-y-auto" : "relative"}>
      <SettlementScene
        layout={layout}
        residentCount={residents.length}
        fallback={<DeckMap residents={residents} saved={draft ?? savedNow} />}
        onSelect={arranging ? setPicked : setSelected}
        arranging={arranging}
        reaction={reaction}
        arriving={arriving}
        onArrived={(id) => { markSeen(id); setArriving((list) => list.filter((x) => x !== id)) }}
        onDrop={(drop) => { if (draft) change(moveHome(draft, drop.gameId, drop.deck, drop.cell)) }}
        pieces={pieces}
        hints={hints}
        onSpot={(spot) => setHints((h) => (h ? { ...h, active: spot } : h))}
        fullscreen={fullscreen}
      />
      {said && (
        <p aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-[90%] rounded-2xl border border-border bg-card/95 px-3 py-2 text-sm text-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <span className="font-medium">{said.name}:</span> {said.line}
        </p>
      )}
      </div>
      {!fullscreen && soundButton}
      <div className={fullscreen ? "flex max-h-[45dvh] flex-col gap-3 overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]" : "contents"}>
      {fullscreen && !hintSeen && !arranging && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
          <p className="text-sm text-muted-foreground">Tap a home to see who lives there. Drag to look around.</p>
          <button type="button" onClick={dismissHint} className="min-h-11 shrink-0 text-sm text-foreground underline">Got it</button>
        </div>
      )}
      {arranging && (
        <ArrangePanel
          layout={layout}
          residents={residents}
          canUndo={history.length > 0}
          saving={saving}
          error={saveError}
          picked={picked}
          onPick={setPicked}
          onMove={(id, deck, cell) => change(moveHome(draft!, id, deck, cell))}
          onTurn={(id) => change(turnHome(draft!, id))}
          onUndo={() => { setDraft(history[history.length - 1]); setHistory((h) => h.slice(0, -1)) }}
          onReset={() => change(compactDecks(toSpots(layoutSettlement(residents))))}
          onDone={finishArranging}
          onCancel={stopArranging}
        />
      )}
      {!arranging && <ul aria-label="Homes" className="flex gap-1.5 overflow-x-auto pb-1">
        {ordered.map((resident) => (
          <li key={resident.game_id} className="shrink-0">
            <button
              type="button"
              aria-pressed={selected === resident.game_id}
              onClick={() => { dismissHintIfShown(); setHints(undefined); setSelected(selected === resident.game_id ? null : resident.game_id) }}
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
      </ul>}
      {!arranging && chosen && <ResidentPortrait key={chosen.game_id} resident={chosen} pieces={pieces} deckCount={layout.decks.length} hints={hints} onSpots={setHints} onEmote={(emote) => setReaction((r) => ({ gameId: chosen.game_id, emote, nonce: (r?.nonce ?? 0) + 1 }))} onSay={(line) => setSaid({ name: chosen.game?.name ?? "A game", line })} />}
      </div>
    </div>
  )
}
