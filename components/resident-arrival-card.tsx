"use client"

import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import * as Dialog from "@radix-ui/react-dialog"
import type { Game } from "@/lib/types"

interface ResidentArrivalCardProps {
  game: Game
  isOpen: boolean
  onClose: () => void
}

export function ResidentArrivalCard({ game, isOpen, onClose }: ResidentArrivalCardProps) {
  const prefersReducedMotion = useReducedMotion()

  const variants = prefersReducedMotion
    ? { enter: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, y: 10 },
      }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {isOpen && (
            <>
              <Dialog.Overlay
                asChild
                forceMount
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content
                asChild
                forceMount
                className="fixed inset-0 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={variants.enter}
                  animate={variants.enter}
                  exit={variants.exit}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
                  className="w-full max-w-sm rounded-2xl bg-card border border-border p-8 shadow-lg"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="inline-block rounded-full bg-success/20 p-3">
                      <svg
                        className="h-6 w-6 text-success"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>

                    <div>
                      <Dialog.Title className="text-xl font-bold text-foreground mb-1">
                        {game.name} has moved in
                      </Dialog.Title>
                      <Dialog.Description className="text-sm text-muted-foreground">
                        You can find it under Residents in Progress.
                      </Dialog.Description>
                    </div>

                    <button
                      onClick={onClose}
                      className="mt-2 min-h-11 w-full rounded-lg bg-success text-success-foreground font-medium transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
                    >
                      Got it
                    </button>
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
