"use client"

import { useEffect, useState } from "react"

export function useStandbyWakeLock(enabled: boolean) {
  const [state, setState] = useState("Requesting keep-awake...")
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let requesting = false
    let retryOnVisible = false
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      if (disposed || requesting || lock || document.visibilityState !== "visible") return
      if (!navigator.wakeLock?.request) {
        setState("Keep-awake unavailable in this browser")
        return
      }
      requesting = true
      try {
        const acquired = await navigator.wakeLock.request("screen")
        if (disposed || document.visibilityState !== "visible") {
          await acquired.release().catch((cause) => {
            console.error("Could not release delayed StandBy wake lock", cause)
            if (!disposed) setState("Could not release keep-awake")
          })
          return
        }
        lock = acquired
        setState("Keep-awake active while visible")
        acquired.addEventListener("release", () => {
          if (lock === acquired) lock = null
          if (!disposed) setState("Keep-awake released; screen may sleep")
        })
      } catch {
        if (!disposed) setState("Keep-awake denied or unavailable; screen may sleep")
      } finally {
        requesting = false
        if (retryOnVisible && !disposed && document.visibilityState === "visible") {
          retryOnVisible = false
          void acquire()
        }
      }
    }
    const visibility = () => {
      if (document.visibilityState === "visible") {
        retryOnVisible = requesting
        void acquire()
      } else if (lock) {
        const released = lock
        void released.release().then(() => {
          if (lock === released) lock = null
          if (!disposed && document.visibilityState === "visible") void acquire()
        }).catch(() => {
          if (!disposed) setState("Could not release keep-awake")
        })
      }
    }
    void acquire()
    document.addEventListener("visibilitychange", visibility)
    return () => {
      disposed = true
      document.removeEventListener("visibilitychange", visibility)
      if (lock) void lock.release().catch((error) => console.error("Could not release StandBy wake lock", error))
    }
  }, [enabled])
  return enabled ? state : "Keep-awake off"
}
