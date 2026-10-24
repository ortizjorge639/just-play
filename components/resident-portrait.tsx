"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { placePiece, recordEmote, removePiece } from "@/app/actions"
import { EMOTES, EMOTE_LABELS, EMOTE_PAST, isEmote, pickEmoteLine, type EmoteKind } from "@/lib/emotes"
import { Resident, SettlementPiece } from "@/lib/types"
import { ANCHORS_PER_DECK } from "@/lib/settlement/transforms"
import type { SpotHints } from "@/components/settlement/scene"
import { tierFor, tierName } from "@/lib/settlement/tiers"

interface ResidentPortraitProps {
  resident: Resident
  pieces?: SettlementPiece[]
  deckCount?: number
  hints?: SpotHints
  onSpots?: (hints: SpotHints | undefined) => void
  onSay?: (line: string) => void
}

export function ResidentPortrait({ resident, pieces, deckCount = 1, hints, onSpots, onSay }: ResidentPortraitProps) {
  const arrivedDate = new Date(resident.arrived_at)
  const formatted = arrivedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const tier = tierFor(resident.minutes_played)
  const depth = tierName(tier)

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      {resident.game ? (
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <Image
              src={resident.game.header_image}
              alt=""
              width={64}
              height={64}
              className="rounded object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground line-clamp-2">{resident.game.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Arrived {formatted}
            </p>
            {depth && <p className="text-xs text-muted-foreground mt-0.5">{depth}</p>}
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-16 h-16 rounded bg-muted" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-muted rounded" />
            <p className="text-xs text-muted-foreground mt-3">
              Arrived {formatted}
            </p>
          </div>
        </div>
      )}
      {resident.game && pieces && tier >= 3 ? (
        <LoftSection resident={resident} name={resident.game.name} pieces={pieces} deckCount={deckCount} hints={hints} onSpots={onSpots} onSay={onSay} />
      ) : null}
      {resident.game ? <EmoteSection resident={resident} name={resident.game.name} /> : null}
    </div>
  )
}

function EmoteSection({ resident, name }: { resident: Resident; name: string }) {
  const [open, setOpen] = useState(false)
  const [line, setLine] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [last, setLast] = useState(resident.last_emote ?? null)
  const [, startTransition] = useTransition()
  const trigger = useRef<HTMLButtonElement>(null)

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  const choose = (emote: EmoteKind) => {
    setLine(pickEmoteLine(resident.game_id, emote))
    setSaveFailed(false)
    close()
    startTransition(async () => {
      const result = await recordEmote(resident.game_id, emote)
      if (result.ok) {
        setLast({ emote, emoted_at: result.emoted_at ?? new Date().toISOString() })
      } else {
        setSaveFailed(true)
      }
    })
  }

  return (
    <div className="mt-3">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-label={`Say hi to ${name}`}
        onClick={() => setOpen(o => !o)}
        className="min-h-11 text-sm text-muted-foreground underline"
      >
        Say hi
      </button>
      {open ? (
        <ul
          className="flex flex-wrap gap-2"
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close() } }}
        >
          {EMOTES.map(emote => (
            <li key={emote}>
              <button
                type="button"
                autoFocus={emote === EMOTES[0]}
                onClick={() => choose(emote)}
                className="min-h-11 rounded-lg border border-border px-4 text-sm text-foreground"
              >
                {EMOTE_LABELS[emote]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p role="status" className="mt-1 text-sm text-foreground">{line}</p>
      {saveFailed ? <p className="text-xs text-muted-foreground">Couldn&apos;t save that one.</p> : null}
      {last && isEmote(last.emote) ? (
        <p className="text-xs text-muted-foreground">
          Last: {EMOTE_PAST[last.emote]}, {formatDistanceToNow(new Date(last.emoted_at), { addSuffix: true })}
        </p>
      ) : null}
    </div>
  )
}

const PLACED_LINES = [
  "Oh, I like this one. Good view from here.",
  "That works. I can see the whole deck.",
  "Right where I wanted it.",
]
const REMOVED_LINES = ["No rush. I'll keep it safe.", "Fine by me. It'll be here when you want it."]

function lineFor(gameId: string, lines: string[]) {
  let sum = 0
  for (const ch of gameId) sum = (sum + ch.charCodeAt(0)) % 997
  return lines[sum % lines.length]
}

function LoftSection({ resident, name, pieces, deckCount, hints, onSpots, onSay }: { onSay?: (line: string) => void; resident: Resident; name: string; pieces: SettlementPiece[]; deckCount: number; hints?: SpotHints; onSpots?: (hints: SpotHints | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [line, setLine] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const trigger = useRef<HTMLButtonElement>(null)
  const mine = pieces.find((p) => p.game_id === resident.game_id)
  const active = open ? (hints?.active ?? null) : null

  const spots = useMemo(() => {
    const free: { deck: number; anchor: number }[] = []
    for (let deck = 0; deck < deckCount; deck++) {
      for (let anchor = 0; anchor < ANCHORS_PER_DECK; anchor++) {
        const isTaken = pieces.some((p) => p.game_id !== resident.game_id && p.deck === deck && p.anchor === anchor)
        const isMine = pieces.some((p) => p.game_id === resident.game_id && p.deck === deck && p.anchor === anchor)
        if (!isTaken && !isMine) free.push({ deck, anchor })
      }
    }
    return free
  }, [pieces, deckCount, resident.game_id])
  const list = useRef<HTMLUListElement>(null)

  const close = () => {
    setOpen(false)
    onSpots?.(undefined)
  }
  const choose = (spot: { deck: number; anchor: number } | null) => onSpots?.({ spots, active: spot })
  const start = () => {
    if (open) { close(); return }
    setOpen(true)
    setLine(null)
    choose(null)
  }

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    if (pending) return
    setFailed(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        setLine(done)
        onSay?.(done)
        close()
        trigger.current?.focus()
      } else {
        setFailed(result.error ?? "Couldn't do that.")
      }
    })
  }

  useEffect(() => () => onSpots?.(undefined), [onSpots])
  useEffect(() => {
    if (open) list.current?.scrollIntoView({ block: "nearest" })
  }, [open])

  return (
    <div className="mt-3" data-testid="loft-section">
      <p className="text-sm text-foreground">
        {mine ? `Loft on deck ${mine.deck + 1}, spot ${mine.anchor + 1}` : "Has a loft to place"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-disabled={pending}
          aria-label={open ? "Never mind" : `${mine ? "Move" : "Place"} the loft for ${name}`}
          onClick={start}
          className="min-h-11 text-sm text-muted-foreground underline"
        >
          {open ? "Never mind" : mine ? "Move it" : "Place it"}
        </button>
        {mine && !open ? (
          <button
            type="button"
            aria-disabled={pending}
            aria-label={`Take back the loft for ${name}`}
            onClick={() => run(() => removePiece(resident.game_id), lineFor(resident.game_id, REMOVED_LINES))}
            className="min-h-11 text-sm text-muted-foreground underline"
          >
            Take it back
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="scroll-mb-24" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); trigger.current?.focus() } }}>
          <p role="status" className="text-xs text-muted-foreground">
            {active ? `Deck ${active.deck + 1}, spot ${active.anchor + 1}. Tap another glowing spot to change it.` : "Tap a glowing spot on the deck, or pick one here."}
          </p>
          <ul ref={list} aria-label="Free spots" className="mt-1 flex flex-wrap gap-2">
            {spots.length === 0 ? <li className="text-xs text-muted-foreground">No free spots.</li> : null}
            {spots.map((s, i) => {
              const picked = active?.deck === s.deck && active?.anchor === s.anchor
              return (
                <li key={`${s.deck}:${s.anchor}`}>
                  <button
                    type="button"
                    autoFocus={i === 0}
                    aria-pressed={picked}
                    onClick={() => choose(s)}
                    className={`min-h-11 rounded-lg border px-4 text-sm text-foreground ${picked ? "border-primary bg-primary/15" : "border-border"}`}
                  >
                    Deck {s.deck + 1}, spot {s.anchor + 1}
                  </button>
                </li>
              )
            })}
          </ul>
          {active ? (
            <button
              type="button"
              aria-disabled={pending}
              onClick={() => run(() => placePiece(resident.game_id, active.deck, active.anchor), lineFor(resident.game_id, PLACED_LINES))}
              className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Put it here
            </button>
          ) : null}
        </div>
      ) : null}
      {line ? <p role="status" className="mt-1 text-sm text-foreground">{name}: &ldquo;{line}&rdquo;</p> : null}
      {failed ? <p role="status" className="text-xs text-muted-foreground">{failed}</p> : null}
    </div>
  )
}
