"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { markTutorialComplete } from "@/app/actions"

interface FilterTipProps {
  children: React.ReactNode
  onDismiss?: () => void
}

export function FilterTip({ children, onDismiss }: FilterTipProps) {
  const [visible, setVisible] = useState(true)

  const dismiss = useCallback(async () => {
    setVisible(false)
    await markTutorialComplete()
    onDismiss?.()
  }, [onDismiss])

  if (!visible) return <>{children}</>

  return (
    <div className="relative">
      {/* Pulsing ring behind the button */}
      <motion.div
        className="absolute inset-0 rounded-lg bg-primary/20"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* The actual filter button */}
      <div className="relative z-10" onClick={dismiss}>
        {children}
      </div>
      
      {/* Label */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap"
        >
          <div className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg">
            Customize your picks!
            {/* Arrow pointing up */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-primary" />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
