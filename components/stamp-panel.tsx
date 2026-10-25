"use client"

import { useState, useTransition } from "react"
import { confirmStamp } from "@/app/actions"
import type { Game, StampRule } from "@/lib/types"

interface StampPanelProps {
  game: Game
  playedMinutes: number
  // The rule that applies to this game: its own, else the player's default.
  rule: StampRule | null
  onArrived: (game: Game) => void
}

function formatHours(minutes: number) {
  return String(Math.round((minutes / 60) * 10) / 10)
}

function hoursWord(minutes: number) {
  return formatHours(minutes) === "1" ? "hour" : "hours"
}

export function StampPanel({ game, playedMinutes, rule, onArrived }: StampPanelProps) {
  const [later, setLater] = useState(false)
  const [moved, setMoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (moved || !rule) return null

  const ready = rule?.kind === "milestone" || (rule?.kind === "hours" && playedMinutes >= rule.target_minutes)

  const confirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await confirmStamp(game.id)
      if (!result.ok) {
        setError(result.error ?? "That did not go through. Try again.")
        return
      }
      setMoved(true)
      if (result.arrived) onArrived(game)
    })
  }

  const line =
    rule?.kind === "hours"
      ? ready
        ? `You've played ${formatHours(rule.target_minutes)} ${hoursWord(rule.target_minutes)}.`
        : `${formatHours(playedMinutes)} of ${formatHours(rule.target_minutes)} ${hoursWord(rule.target_minutes)}`
      : rule?.kind === "milestone"
        ? `Your own mark: ${rule.label}`
        : null

  if (!ready) {
    return line ? <p aria-label="When this game counts as done" className="mb-4 w-full max-w-[320px] text-sm text-foreground/70">{line}</p> : null
  }
  if (later) return null

  return (
    <section aria-label="When this game counts as done" className="mb-4 w-full max-w-[320px] rounded-xl border border-border bg-card/60 p-4 text-sm">
      <p className="text-base font-semibold text-foreground">Is {game.name} done?</p>
      {line ? <p className="mt-1 text-foreground/80">{line}</p> : null}
      <button
        type="button"
        onClick={confirm}
        disabled={isPending}
        className="mt-3 min-h-11 w-full rounded-xl bg-success px-4 text-sm font-semibold text-success-foreground disabled:opacity-50"
      >
        {isPending ? "Moving in..." : "Let it move in"}
      </button>
      <button
        type="button"
        onClick={() => setLater(true)}
        className="mt-2 min-h-11 w-full rounded-xl border border-border px-4 text-sm font-medium text-foreground/80 hover:bg-muted"
      >
        Not yet
      </button>
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
    </section>
  )
}
