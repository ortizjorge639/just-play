"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"

interface XPToastData {
  total: number
  bonuses: string[]
}

const XPToastContext = createContext<(data: XPToastData) => void>(() => {})

export function useXPToast() {
  return useContext(XPToastContext)
}

export function XPToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<XPToastData | null>(null)

  const showToast = useCallback((data: XPToastData) => {
    if (data.total <= 0) return
    setToast(data)
    setTimeout(() => setToast(null), 2500)
  }, [])

  return (
    <XPToastContext.Provider value={showToast}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
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
    </XPToastContext.Provider>
  )
}
