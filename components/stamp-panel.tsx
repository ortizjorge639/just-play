"use client"

import { useState, useTransition } from "react"
import { confirmStamp } from "@/app/actions"
import { StampRuleEditor } from "./stamp-rule-editor"
import type { Game, StampRule } from "@/lib/types"

interface StampPanelProps {
  game: Game
  playedMinutes: number
  // The rule that applies to this game: its own, else the player's default.
  rule: StampRule | null
  ownRule: StampRule | null
  onRuleSaved: (gameId: string | null, rule: StampRule | null) => void
  onArrived: (game: Game) => void
}

function formatHours(minutes: number) {
  return String(Math.round((minutes / 60) * 10) / 10)
}

function hoursWord(minutes: number) {
  return formatHours(minutes) === "1" ? "hour" : "hours"
}

export function StampPanel({ game, playedMinutes, rule, ownRule, onRuleSaved, onArrived }: StampPanelProps) {
  const [editing, setEditing] = useState(false)
  const [moved, setMoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (moved) return null

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

  return (
    <section aria-label="When this game moves in" className="mb-4 w-full max-w-[320px] text-sm">
      {line ? <p className="text-foreground/80">{line}</p> : null}
      {ready ? (
        <button
          type="button"
          onClick={confirm}
          disabled={isPending}
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-secondary px-4 text-sm font-semibold text-foreground disabled:opacity-50"
        >
          {isPending ? "Moving in..." : "Let it move in"}
        </button>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-destructive">{error}</p> : null}
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        aria-expanded={editing}
        className="mt-1 min-h-11 text-sm text-muted-foreground underline"
      >
        {rule ? "Change for this game" : "Choose when this game moves in"}
      </button>
      {editing ? (
        <div className="mt-2 rounded-xl border border-border p-4">
          <StampRuleEditor gameId={game.id} rule={ownRule} onSaved={onRuleSaved} />
        </div>
      ) : null}
    </section>
  )
}
