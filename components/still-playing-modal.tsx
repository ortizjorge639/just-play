"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"

interface StillPlayingModalProps {
  elapsed: number
  onStillPlaying: () => void
  onFinishSession: () => void
  onAutoPause: () => void
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`
  if (hrs > 0) return `${hrs}h`
  return `${mins}m`
}

const AUTO_PAUSE_SECONDS = 600 // 10 minutes

export function StillPlayingModal({
  elapsed,
  onStillPlaying,
  onFinishSession,
  onAutoPause,
}: StillPlayingModalProps) {
  const [countdown, setCountdown] = useState(AUTO_PAUSE_SECONDS)

  useEffect(() => {
    if (countdown <= 0) {
      onAutoPause()
      return
    }
    const interval = setInterval(() => {
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [countdown, onAutoPause])

  const countdownMins = Math.floor(countdown / 60)
  const countdownSecs = countdown % 60

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-sm rounded-2xl bg-background p-6 text-center"
      >
        {/* Pulsing icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FAA61A]/10">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <svg className="h-8 w-8 text-[#FAA61A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>
        </div>

        <h2 className="text-xl font-bold text-foreground mb-1">Still playing?</h2>
        <p className="text-sm text-muted-foreground mb-1">
          You&apos;ve been playing for <span className="font-semibold text-foreground">{formatDuration(elapsed)}</span>
        </p>
        <p className="text-xs text-muted-foreground/70 mb-6">
          Auto-pausing in {countdownMins}:{countdownSecs.toString().padStart(2, "0")}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onStillPlaying}
            className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] min-h-[44px]"
          >
            Still Playing
          </button>
          <button
            onClick={onFinishSession}
            className="h-12 w-full rounded-xl border border-muted-foreground/20 text-sm font-semibold text-muted-foreground transition-all active:scale-[0.98] min-h-[44px] hover:border-destructive/50 hover:text-destructive"
          >
            Finish Session
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
