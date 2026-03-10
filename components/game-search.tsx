"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import type { Game } from "@/lib/types"
import type { IGDBSearchResult } from "@/lib/igdb"

interface GameSearchProps {
  onGameSelected: (game: Game) => void
}

export function GameSearch({ onGameSelected }: GameSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<IGDBSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when search opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to let animation start before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Debounced IGDB search
  const searchGames = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/search-games?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error("Search failed")
      const data = await res.json()
      if (Array.isArray(data)) {
        setResults(data)
      } else {
        setResults([])
      }
    } catch {
      setError("Search failed. Try again.")
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (value.length < 2) {
        setResults([])
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      debounceRef.current = setTimeout(() => searchGames(value), 300)
    },
    [searchGames]
  )

  const handleSelectGame = useCallback(
    async (result: IGDBSearchResult) => {
      setIsLoading(true)
      try {
        const { addSearchedGame } = await import("@/app/actions")
        const game = await addSearchedGame(result)
        // Close search and notify parent
        setIsOpen(false)
        setQuery("")
        setResults([])
        setError(null)
        onGameSelected(game)
      } catch (e) {
        const msg = e instanceof Error ? e.message : ""
        if (msg.includes("SERVICE_ROLE")) {
          setError("Server config needed. Ask admin to add SUPABASE_SERVICE_ROLE_KEY.")
        } else {
          setError("Failed to add game. Try again.")
        }
      } finally {
        setIsLoading(false)
      }
    },
    [onGameSelected]
  )

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setQuery("")
    setResults([])
    setError(null)
  }, [])

  return (
    <>
      {/* Search FAB — bottom right, above bottom nav */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => setIsOpen(true)}
            className="fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full glass-card shadow-lg active:scale-95 transition-transform"
            style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
            aria-label="Search for a game"
          >
            <svg
              className="h-5 w-5 text-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Search overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Blurred backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md"
              onClick={handleClose}
            />

            {/* Search container — anchored above nav bar */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed left-0 right-0 z-50 flex flex-col"
              style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
            >
              {/* Results list — transparent bg, white text */}
              <AnimatePresence mode="popLayout">
                {(results.length > 0 || isLoading || error) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mx-3 mb-2 max-h-[50vh] overflow-y-auto rounded-2xl"
                  >
                    {isLoading && results.length === 0 && (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                      </div>
                    )}

                    {error && (
                      <div className="px-4 py-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}

                    {results.map((result, i) => (
                      <motion.button
                        key={result.igdbId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => handleSelectGame(result)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10 active:bg-white/15 rounded-xl"
                      >
                        {/* Game cover thumbnail */}
                        <div className="h-12 w-9 flex-shrink-0 overflow-hidden rounded-md bg-white/5">
                          {result.coverUrl ? (
                            <Image
                              src={result.coverUrl}
                              alt={result.name}
                              width={36}
                              height={48}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg
                                className="h-4 w-4 text-muted-foreground"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25c0 .828.672 1.5 1.5 1.5z"
                                />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Game info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {result.name}
                          </p>
                          {result.genres.length > 0 && (
                            <p className="text-xs text-white/50 truncate">
                              {result.genres.slice(0, 3).join(" · ")}
                            </p>
                          )}
                        </div>

                        {/* Add indicator */}
                        <svg
                          className="h-4 w-4 flex-shrink-0 text-white/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                      </motion.button>
                    ))}

                    {!isLoading && results.length === 0 && query.length >= 2 && !error && (
                      <div className="px-4 py-6 text-center text-sm text-white/50">
                        No games found for &ldquo;{query}&rdquo;
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search bar — glassmorphic */}
              <div className="mx-3 mb-3 flex items-center gap-3 rounded-2xl glass-card px-4 py-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search any game..."
                  autoComplete="off"
                  autoCorrect="on"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {(query || isLoading) && (
                  <button
                    onClick={() => {
                      setQuery("")
                      setResults([])
                      setError(null)
                      inputRef.current?.focus()
                    }}
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
