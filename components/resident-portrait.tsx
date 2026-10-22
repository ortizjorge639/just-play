"use client"

import { useRef, useState, useTransition } from "react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { recordEmote } from "@/app/actions"
import { EMOTES, EMOTE_LABELS, EMOTE_PAST, isEmote, pickEmoteLine, type EmoteKind } from "@/lib/emotes"
import { Resident } from "@/lib/types"

interface ResidentPortraitProps {
  resident: Resident
}

export function ResidentPortrait({ resident }: ResidentPortraitProps) {
  const arrivedDate = new Date(resident.arrived_at)
  const formatted = arrivedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

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
