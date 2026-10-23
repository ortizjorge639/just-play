"use client"

import { useRef, useState, useTransition } from "react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { placePiece, recordEmote, removePiece } from "@/app/actions"
import { EMOTES, EMOTE_LABELS, EMOTE_PAST, isEmote, pickEmoteLine, type EmoteKind } from "@/lib/emotes"
import { Resident, SettlementPiece } from "@/lib/types"
import { ANCHORS_PER_DECK } from "@/lib/settlement/transforms"
import { tierFor, tierName } from "@/lib/settlement/tiers"

interface ResidentPortraitProps {
  resident: Resident
  pieces?: SettlementPiece[]
  deckCount?: number
}

export function ResidentPortrait({ resident, pieces, deckCount = 1 }: ResidentPortraitProps) {
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
        <LoftSection resident={resident} name={resident.game.name} pieces={pieces} deckCount={deckCount} />
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

function LoftSection({ resident, name, pieces, deckCount }: { resident: Resident; name: string; pieces: SettlementPiece[]; deckCount: number }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const trigger = useRef<HTMLButtonElement>(null)
  const mine = pieces.find((p) => p.game_id === resident.game_id)
  const taken = new Set(pieces.filter((p) => p.game_id !== resident.game_id).map((p) => `${p.deck}:${p.anchor}`))

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    if (pending) return
    setFailed(null)
    setOpen(false)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setFailed(result.error ?? "Couldn't do that.")
    })
    trigger.current?.focus()
  }

  const spots: { deck: number; anchor: number }[] = []
  for (let deck = 0; deck < deckCount; deck++) {
    for (let anchor = 0; anchor < ANCHORS_PER_DECK; anchor++) {
      if (!taken.has(`${deck}:${anchor}`) && !(mine && mine.deck === deck && mine.anchor === anchor)) spots.push({ deck, anchor })
    }
  }

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
          aria-label={`${mine ? "Move" : "Place"} the loft for ${name}`}
          onClick={() => setOpen((o) => !o)}
          className="min-h-11 text-sm text-muted-foreground underline"
        >
          {mine ? "Move it" : "Place it"}
        </button>
        {mine ? (
          <button
            type="button"
            aria-disabled={pending}
            aria-label={`Take back the loft for ${name}`}
            onClick={() => run(() => removePiece(resident.game_id))}
            className="min-h-11 text-sm text-muted-foreground underline"
          >
            Take it back
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          aria-label="Free spots"
          className="flex flex-wrap gap-2"
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); trigger.current?.focus() } }}
        >
          {spots.length === 0 ? <li className="text-xs text-muted-foreground">No free spots.</li> : null}
          {spots.map((s, i) => (
            <li key={`${s.deck}:${s.anchor}`}>
              <button
                type="button"
                autoFocus={i === 0}
                onClick={() => run(() => placePiece(resident.game_id, s.deck, s.anchor))}
                className="min-h-11 rounded-lg border border-border px-4 text-sm text-foreground"
              >
                Deck {s.deck + 1}, spot {s.anchor + 1}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {failed ? <p role="status" className="text-xs text-muted-foreground">{failed}</p> : null}
    </div>
  )
}
