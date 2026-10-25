"use client"

import { useSyncExternalStore } from "react"

const KEY = "jp-seen-move-in-note"
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
const dismissed = () => { try { return localStorage.getItem(KEY) === "1" } catch { return false } }

export function MoveInNote() {
  // Server snapshot is "dismissed" so nothing flashes before the browser checks.
  const gone = useSyncExternalStore(subscribe, dismissed, () => true)
  if (gone) return null
  const dismiss = () => {
    try { localStorage.setItem(KEY, "1") } catch { /* it may show once more next visit */ }
    listeners.forEach((fn) => fn())
  }
  return (
    <div data-testid="move-in-note" className="mb-4 w-full max-w-[320px] rounded-xl border border-border bg-card/60 p-4 text-sm">
      <p className="text-foreground">When you finish a game, it moves into your settlement as a resident. You can see them on the Home tab. Change when a game counts as done in Settings.</p>
      <button onClick={dismiss} className="mt-3 min-h-[44px] rounded-lg bg-secondary px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        Got it
      </button>
    </div>
  )
}
