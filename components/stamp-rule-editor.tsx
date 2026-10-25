"use client"

import { useId, useState, useTransition } from "react"
import { setStampRule } from "@/app/actions"
import { cn } from "@/lib/utils"
import type { StampRule } from "@/lib/types"

type Choice = "none" | "hours" | "milestone"

interface StampRuleEditorProps {
  // null edits the player's default rule; a game id edits that game's own rule.
  gameId: string | null
  rule: StampRule | null
  onSaved: (gameId: string | null, rule: StampRule | null) => void
}

export function StampRuleEditor({ gameId, rule, onSaved }: StampRuleEditorProps) {
  const name = useId()
  const [choice, setChoice] = useState<Choice>(rule?.kind ?? "none")
  const [hours, setHours] = useState(rule?.kind === "hours" ? String(rule.target_minutes / 60) : "10")
  const [label, setLabel] = useState(rule?.kind === "milestone" ? rule.label : "")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const noneLabel = gameId ? "Use my usual rule" : "When I mark it beaten"

  const save = () => {
    setError(null)
    setSaved(false)
    const parsedHours = Number(hours)
    const input =
      choice === "hours"
        ? { kind: "hours" as const, targetMinutes: Math.round(parsedHours * 60) }
        : choice === "milestone"
          ? { kind: "milestone" as const, label }
          : null
    if (choice === "hours" && !(parsedHours > 0)) {
      setError("Pick a number of hours above zero.")
      return
    }
    startTransition(async () => {
      const result = await setStampRule(gameId, input)
      if (!result.ok) {
        setError(result.error ?? "That did not go through. Try again.")
        return
      }
      setSaved(true)
      onSaved(
        gameId,
        input?.kind === "hours"
          ? { kind: "hours", target_minutes: input.targetMinutes, label: null, game_id: gameId }
          : input?.kind === "milestone"
            ? { kind: "milestone", target_minutes: null, label: input.label.trim(), game_id: gameId }
            : null
      )
    })
  }

  const option = (value: Choice, text: string, hint: string) => (
    <label
      className={cn(
        "relative flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border px-4 py-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)]",
        choice === value ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={choice === value}
        onChange={() => {
          setChoice(value)
          setSaved(false)
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <span className="text-sm font-medium text-foreground">{text}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  )

  const inputClass =
    "min-h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"

  return (
    <fieldset className="flex flex-col gap-2" disabled={isPending}>
      <legend className="mb-1 text-base font-medium text-foreground">
        {gameId ? "When does this game count as done?" : "When does a game count as done?"}
      </legend>
      <p className="mb-2 text-sm text-muted-foreground">
        When a game counts as done, it becomes a resident in your settlement. You will find it on the Home tab. Pick what counts as done.
      </p>
      {option("none", noneLabel, gameId ? "Follows what you set for all games." : "Nothing moves in until you say it is beaten.")}
      {option("hours", "After a set number of hours", "It moves in once you have played this long.")}
      {choice === "hours" ? (
        <label className="mx-1 flex flex-col gap-1 text-sm text-muted-foreground">
          Hours
          <input
            type="number"
            inputMode="decimal"
            min={0.5}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={inputClass}
          />
        </label>
      ) : null}
      {option("milestone", "When I say so", "You pick the moment, like finishing a chapter.")}
      {choice === "milestone" ? (
        <label className="mx-1 flex flex-col gap-1 text-sm text-muted-foreground">
          What counts as done enough?
          <input
            type="text"
            maxLength={60}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Reached the second act"
            className={inputClass}
          />
        </label>
      ) : null}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        {saved ? <span role="status" className="text-sm text-muted-foreground">Saved.</span> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </fieldset>
  )
}
