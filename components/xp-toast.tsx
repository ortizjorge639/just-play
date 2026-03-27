"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
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

export function XPToastProvider({ children, playerStats }: { children: ReactNode; playerStats?: PlayerStats | null }) {
  const [toast, setToast] = useState<XPToastData | null>(null)
  const [showParticles, setShowParticles] = useState(false)
  const toastRef = useRef<HTMLDivElement>(null)
  const [particleOrigin, setParticleOrigin] = useState({ x: 0, y: 0 })

  const showToast = useCallback((data: XPToastData) => {
    if (data.total <= 0) return
    setToast(data)

    // Store pending XP for progress page animation
    if (playerStats) {
      storePendingXP(data.total, playerStats)
    }

    // Trigger particles after a brief delay (let toast render first)
    setTimeout(() => {
      const el = toastRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        setParticleOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      } else {
        setParticleOrigin({ x: window.innerWidth / 2, y: 120 })
      }
      setShowParticles(true)
    }, 100)

    setTimeout(() => setToast(null), 2000)
  }, [playerStats])

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
            <div className="rounded-xl bg-chart-1/20 border border-chart-1/30 backdrop-blur-lg px-4 py-2 shadow-lg shadow-chart-1/10">
              <div className="text-center">
                <span className="text-lg font-bold text-chart-1">
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
          count={28}
          spread={7}
          onComplete={() => setShowParticles(false)}
        />
      )}
    </XPToastContext.Provider>
  )
}
