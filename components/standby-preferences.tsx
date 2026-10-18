"use client"

import { useState, useTransition } from "react"
import { saveStandbyPreferences } from "@/app/actions"
import type { StandbyPreferences } from "@/lib/types"

export const DEFAULT_STANDBY_PREFERENCES: StandbyPreferences = {
  record_time: true,
  show_clock: true,
  reminders: false,
  keep_awake: false,
}

export function StandbyPreferencesForm({
  value,
  onSaved,
}: {
  value: StandbyPreferences
  onSaved: (value: StandbyPreferences) => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const options = [
    ["record_time", "Record play time for future sessions"],
    ["show_clock", "Show elapsed clock (recorded sessions only)"],
    ["reminders", "Gentle StandBy reminders (recorded sessions; never auto-pause)"],
    ["keep_awake", "Keep screen awake while StandBy is visible"],
  ] as const

  return (
    <fieldset disabled={pending} className="space-y-2">
      <legend className="mb-2 font-semibold">StandBy &amp; time</legend>
      {options.map(([key, label]) => (
        <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={value[key]} onChange={(event) => {
            const next = { ...value, [key]: event.target.checked }
            setError(null)
            startTransition(async () => {
              try {
                await saveStandbyPreferences(next)
                onSaved(next)
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Could not save preferences.")
              }
            })
          }} />
          {label}
        </label>
      ))}
      <p className="text-xs text-muted-foreground">
        Recording is fixed when a session is created. Hiding the clock never stops recording.
        Without recording, no played duration or duration XP is saved. Lifecycle timestamps remain.
        Keep-awake cannot prevent device locking or work in the background.
      </p>
      <p role="status" className="text-sm">{pending ? "Saving..." : error}</p>
    </fieldset>
  )
}
