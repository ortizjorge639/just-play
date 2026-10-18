"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function useSessionReconciliation<T>(
  initialSession: T | null,
  load: () => Promise<T | null>,
) {
  const [session, setSession] = useState(initialSession)
  const [sessionReadRevision, setSessionReadRevision] = useState(0)
  const [syncError, setSyncError] = useState<string | null>("Checking session state before enabling controls...")
  const revision = useRef(0)
  const mutations = useRef(0)
  const invalidate = useCallback(() => ++revision.current, [])
  const beginMutation = useCallback(() => {
    ++mutations.current
    return invalidate()
  }, [invalidate])
  const endMutation = useCallback(() => {
    mutations.current = Math.max(0, mutations.current - 1)
  }, [])
  const refreshSession = useCallback(async () => {
    if (mutations.current > 0) return
    const request = ++revision.current
    if (!navigator.onLine) {
      setSyncError("Offline. Session controls are disabled until reconnected. Time shown may be stale.")
      return
    }
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const next = await Promise.race([
        load(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Connection timed out.")), 15000)
        }),
      ])
      if (request !== revision.current) return
      setSession(next)
      setSessionReadRevision(request)
      setSyncError(null)
    } catch (cause) {
      if (request !== revision.current) return
      setSyncError(`Could not verify session. Controls disabled; time may be stale. ${cause instanceof Error ? cause.message : "Please retry."}`)
    } finally {
      clearTimeout(timeout)
    }
  }, [load])
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshSession()
    }
    const offline = () => {
      invalidate()
      setSyncError("Offline. Session controls are disabled until reconnected. Time shown may be stale.")
    }
    const visibility = () => {
      invalidate()
      setSyncError("Checking session state before enabling controls...")
      refresh()
    }
    refresh()
    const interval = setInterval(refresh, 20000)
    window.addEventListener("focus", visibility)
    window.addEventListener("online", visibility)
    window.addEventListener("offline", offline)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      invalidate()
      clearInterval(interval)
      window.removeEventListener("focus", visibility)
      window.removeEventListener("online", visibility)
      window.removeEventListener("offline", offline)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [refreshSession, invalidate])
  const updateSession = useCallback((update: (previous: T | null) => T | null) => {
    invalidate()
    setSession(update)
  }, [invalidate])
  return {
    session, sessionReadRevision, setSession, updateSession, syncError, refreshSession,
    invalidateSessionRead: invalidate, beginMutation, endMutation,
  }
}
