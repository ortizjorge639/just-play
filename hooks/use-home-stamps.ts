"use client"

import { useState, useSyncExternalStore } from "react"

const key = "just-play-home-stamps"
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function readEnabled() {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === null || stored === "true") return true
    if (stored === "false") return false
    console.warn("[home-stamps] Invalid saved preference; showing stamps.")
  } catch (error) {
    console.warn("[home-stamps] Could not read saved preference.", error)
  }
  return true
}

export function useHomeStamps() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true)
  const [error, setError] = useState<string | null>(null)

  const setEnabled = (next: boolean) => {
    try {
      window.localStorage.setItem(key, String(next))
      setError(null)
      listeners.forEach(listener => listener())
    } catch (error) {
      console.warn("[home-stamps] Could not save preference.", error)
      setError("Could not save your stamp setting on this device. Please try again.")
    }
  }

  return { enabled, setEnabled, error }
}
