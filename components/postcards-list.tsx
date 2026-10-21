"use client"

import Image from "next/image"
import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import type { Postcard, Game } from "@/lib/types"
import { deletePostcard, reInviteGame } from "@/app/actions"

interface PostcardsListProps {
  postcards: Array<Postcard & { game?: Game }>
}

export function PostcardsList({ postcards }: PostcardsListProps) {
  const prefersReducedMotion = useReducedMotion()
  const [actionState, setActionState] = useState<Record<string, {
    action: 'delete' | 'reinvite' | null
    loading: boolean
    error?: string
  }>>({})

  const getState = (gameId: string) => actionState[gameId] || { action: null, loading: false }

  const handleDelete = async (gameId: string) => {
    setActionState(prev => ({
      ...prev,
      [gameId]: { action: 'delete', loading: true }
    }))
    try {
      const result = await deletePostcard(gameId)
      if (!result.ok) {
        setActionState(prev => ({
          ...prev,
          [gameId]: { action: null, loading: false, error: result.error }
        }))
      }
    } catch (err) {
      console.error("Failed to delete postcard:", err)
      setActionState(prev => ({
        ...prev,
        [gameId]: { action: null, loading: false, error: "That did not go through. Try again." }
      }))
    }
  }

  const handleReInvite = async (gameId: string) => {
    setActionState(prev => ({
      ...prev,
      [gameId]: { action: 'reinvite', loading: true }
    }))
    try {
      const result = await reInviteGame(gameId)
      if (!result.ok) {
        setActionState(prev => ({
          ...prev,
          [gameId]: { action: null, loading: false, error: result.error }
        }))
      }
    } catch (err) {
      console.error("Failed to re-invite game:", err)
      setActionState(prev => ({
        ...prev,
        [gameId]: { action: null, loading: false, error: "That did not go through. Try again." }
      }))
    }
  }

  if (postcards.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? undefined : { delay: 0.35 }}
      className="mb-6"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Keepsakes
      </h2>
      <div className="grid grid-cols-1 gap-2.5">
        {postcards.map((postcard, i) => {
          const state = getState(postcard.game_id)
          const isLoading = state.loading
          const createdDate = new Date(postcard.created_at)

          return (
            <motion.div
              key={`${postcard.user_id}-${postcard.game_id}`}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? undefined : { delay: 0.35 + 0.05 * i }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-card rounded-lg p-3 border border-border">
                {postcard.game ? (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <Image
                          src={postcard.game.header_image}
                          alt={postcard.game.name}
                          width={56}
                          height={56}
                          className="rounded object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {postcard.game.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(createdDate, { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Error message */}
                    {state.error && (
                      <div className="text-xs text-destructive bg-destructive/10 rounded px-2.5 py-1.5">
                        {state.error}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReInvite(postcard.game_id)}
                        disabled={isLoading}
                        className="text-xs px-2.5 py-1.5 rounded bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        aria-label="Bring back"
                      >
                        {state.action === 'reinvite' && isLoading ? "Bringing back…" : "Bring back"}
                      </button>
                      <button
                        onClick={() => handleDelete(postcard.game_id)}
                        disabled={isLoading}
                        className="text-xs px-2.5 py-1.5 rounded bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        aria-label="Delete"
                      >
                        {state.action === 'delete' && isLoading ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-14 h-14 rounded bg-muted" />
                      <div className="flex-1">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <p className="text-xs text-muted-foreground mt-2">Loading…</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 flex-1 bg-muted rounded" />
                      <div className="h-6 w-12 bg-muted rounded" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
