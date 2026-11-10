"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { XPParticles } from "./xp-particles"
import type { PlayerStats } from "@/lib/types"

interface XPToastData {
  total: number
  bonuses: string[]
}

const XPToastContext = createContext<(data: XPToastData) => void>(() => {})

export function useXPToast() {
  return useContext(XPToastContext)
}

/** Store current stats in sessionStorage so the Progress page can animate from old → new */
export function storePendingXP(xp: number, playerStats: PlayerStats | null) {
  if (!playerStats || xp <= 0) return
  try {
    sessionStorage.setItem("pendingXP", JSON.stringify({
      xp,
      previousStats: {
        totalXP: playerStats.totalXP,
        level: playerStats.level,
        xpInCurrentLevel: playerStats.xpInCurrentLevel,
        xpToNextLevel: playerStats.xpToNextLevel,
        totalSessions: playerStats.totalSessions,
      },
      timestamp: Date.now(),
    }))
  } catch {
    // sessionStorage unavailable — skip
  }
}

// Starting or finishing a session reloads the page while the toast is still up. The toast is
// kept in sessionStorage until it has finished, so a reload in between can show it again.
const TOAST_KEY = "pendingXPToast"
const TOAST_REPLAY_MS = 10000

function storeToast(data: XPToastData, levelUp: boolean) {
  try {
    sessionStorage.setItem(TOAST_KEY, JSON.stringify({ data, levelUp, timestamp: Date.now() }))
  } catch {
    // sessionStorage unavailable — the toast simply is not replayed
  }
}

function clearToast() {
  try {
    sessionStorage.removeItem(TOAST_KEY)
  } catch {
    // ignore
  }
}

function takeInterruptedToast(): { data: XPToastData; levelUp: boolean } | null {
  try {
    const raw = sessionStorage.getItem(TOAST_KEY)
    if (!raw) return null
    sessionStorage.removeItem(TOAST_KEY)
    const { data, levelUp, timestamp } = JSON.parse(raw) as { data: XPToastData; levelUp: boolean; timestamp: number }
    if (Date.now() - timestamp >= TOAST_REPLAY_MS || !(data?.total > 0) || !Array.isArray(data.bonuses)) return null
    return { data, levelUp: levelUp === true }
  } catch {
    return null
  }
}

export function XPToastProvider({ children, playerStats }: { children: ReactNode; playerStats?: PlayerStats | null }) {
  const [toast, setToast] = useState<XPToastData | null>(null)
  const [isLevelUp, setIsLevelUp] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [particleCount, setParticleCount] = useState(28)
  const toastRef = useRef<HTMLDivElement>(null)
  const [particleOrigin, setParticleOrigin] = useState({ x: 0, y: 0 })

  const present = useCallback((data: XPToastData, levelUp: boolean) => {
    setToast(data)
    setIsLevelUp(levelUp)

    // Trigger particles after a brief delay (let toast render first)
    setTimeout(() => {
      const el = toastRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        setParticleOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      } else {
        setParticleOrigin({ x: window.innerWidth / 2, y: 120 })
      }
      setParticleCount(levelUp ? 60 : 28)
      setShowParticles(true)
    }, 100)

    setTimeout(() => {
      setToast(null)
      clearToast()
    }, levelUp ? 3000 : 2000)
  }, [])

  const showToast = useCallback((data: XPToastData) => {
    if (data.total <= 0) return

    // Detect level-up: current XP in level + awarded >= XP needed
    const levelUp = playerStats
      ? playerStats.xpInCurrentLevel + data.total >= playerStats.xpToNextLevel
      : false

    // Store pending XP for progress page animation
    if (playerStats) {
      storePendingXP(data.total, playerStats)
    }

    storeToast(data, levelUp)
    present(data, levelUp)
  }, [playerStats, present])

  // A toast cut short by a reload is shown again. Stats have already moved on by then, so the
  // level-up flag comes from the original toast and the Progress hand-off is left untouched.
  useEffect(() => {
    const interrupted = takeInterruptedToast()
    if (!interrupted) return
    // sessionStorage only exists on the client, so it can only be read after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    present(interrupted.data, interrupted.levelUp)
  }, [present])

  return (
    <XPToastContext.Provider value={showToast}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            ref={toastRef}
            key="xp-toast"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 shadow-lg shadow-black/20">
              <div className="text-center">
                {isLevelUp && (
                <div className="text-xs font-bold text-primary tracking-wider uppercase mb-0.5">
                    ⬆ Level Up!
                  </div>
                )}
                <span className="text-lg font-bold text-primary">
                  +{toast.total} XP
                </span>
                {toast.bonuses.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {toast.bonuses.join(" · ")}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {showParticles && (
        <XPParticles
          originX={particleOrigin.x}
          originY={particleOrigin.y}
          count={particleCount}
          spread={particleCount > 28 ? 10 : 7}
          onComplete={() => setShowParticles(false)}
        />
      )}
    </XPToastContext.Provider>
  )
}
