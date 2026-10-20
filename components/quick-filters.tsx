"use client"

import { useState, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { savePreferences } from "@/app/actions"
import type { UserPreferences } from "@/lib/types"

const MOODS = [
  { value: "adventurous", label: "Adventurous" },
  { value: "chill", label: "Chill" },
  { value: "competitive", label: "Competitive" },
  { value: "creative", label: "Creative" },
]

const TIMES = [
  { value: 30, label: "~30 min" },
  { value: 60, label: "~1 hour" },
  { value: 120, label: "2+ hours" },
]

const ENERGIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

interface QuickFiltersProps {
  currentPreferences: UserPreferences
  onApply: () => void
  onCancel: () => void
}

export function QuickFilters({ currentPreferences, onApply, onCancel }: QuickFiltersProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(currentPreferences)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleApply() {
    setError(null)
    startTransition(async () => {
      try {
        await savePreferences(preferences)
        onApply()
      } catch (e) {
        const message = e instanceof Error ? e.message : "Something went wrong while saving your preferences"
        setError(message)
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-md glass-card rounded-t-3xl p-6 pb-10 flex flex-col gap-5 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-12 rounded-full bg-muted-foreground/30 shrink-0" />
        
        <div className="text-center flex flex-col gap-1">
          <h3 className="text-lg font-bold text-foreground">Update Filters</h3>
          <p className="text-sm text-muted-foreground">Tweak your preferences for new picks</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg bg-destructive/20 p-4"
          >
            <p className="text-sm text-destructive">Couldn&apos;t save your filters. Check your connection and try again.</p>
          </motion.div>
        )}

        {/* Mood */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Mood</label>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((mood) => (
              <button
                key={mood.value}
                onClick={() => setPreferences((prev) => ({ ...prev, mood: mood.value }))}
                className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  preferences.mood === mood.value
                    ? "bg-primary text-primary-foreground"
                    : "glass-card text-foreground hover:bg-muted"
                }`}
              >
                {mood.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Time available</label>
          <div className="flex flex-wrap gap-2">
            {TIMES.map((time) => (
              <button
                key={time.value}
                onClick={() => setPreferences((prev) => ({ ...prev, time_available: time.value }))}
                className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  preferences.time_available === time.value
                    ? "bg-primary text-primary-foreground"
                    : "glass-card text-foreground hover:bg-muted"
                }`}
              >
                {time.label}
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Energy level</label>
          <div className="flex flex-wrap gap-2">
            {ENERGIES.map((energy) => (
              <button
                key={energy.value}
                onClick={() => setPreferences((prev) => ({ ...prev, energy: energy.value }))}
                className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  preferences.energy === energy.value
                    ? "bg-primary text-primary-foreground"
                    : "glass-card text-foreground hover:bg-muted"
                }`}
              >
                {energy.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={handleApply}
            disabled={isPending}
            className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 min-h-[44px]"
          >
            {isPending ? "Applying..." : "Apply & Refresh"}
          </button>
          {error && (
            <button
              onClick={() => setError(null)}
              className="h-12 w-full rounded-xl bg-muted text-base font-medium text-foreground transition-colors hover:bg-muted/80 min-h-[44px]"
            >
              Dismiss
            </button>
          )}
          <button
            onClick={onCancel}
            className="h-12 w-full rounded-xl bg-secondary text-base font-medium text-foreground transition-colors hover:bg-muted min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
