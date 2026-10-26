"use client"

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import type { Game } from "@/lib/types"

const KEY = "jp-deck"
const listeners = new Set<() => void>()

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function parse(raw: string | null): Game[] | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as { day?: string; games?: Game[] }
    if (data.day !== today() || !Array.isArray(data.games)) return null
    return data.games
  } catch {
    return null
  }
}

export function clearPersistedDeck() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {}
}

/** Deck that survives a reload for the rest of the local day. */
export function usePersistedDeck(initial: Game[]) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null)
  const stored = useMemo(() => parse(raw), [raw])
  const deck = stored ?? initial
  const initialRef = useRef(initial)
  useEffect(() => {
    initialRef.current = initial
  }, [initial])

  const setDeck = useCallback(
    (next: Game[] | ((prev: Game[]) => Game[])) => {
      const current = parse(readRaw()) ?? initialRef.current
      const games = typeof next === "function" ? next(current) : next
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ day: today(), games }))
      } catch {}
      listeners.forEach((l) => l())
    },
    []
  )

  return [deck, setDeck] as const
}
