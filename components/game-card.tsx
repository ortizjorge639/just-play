"use client"

import { motion, type PanInfo } from "framer-motion"
import { useRef, useState, useCallback } from "react"
import Image from "next/image"
import type { Game } from "@/lib/types"

interface GameCardProps {
  game: Game
  index: number
  total: number
  onLockIn: (game: Game) => void
  onReject: (game: Game) => void
  isTop: boolean
}

export function GameCard({
  game,
  index,
  total,
  onLockIn,
  onReject,
  isTop,
}: GameCardProps) {
  const [dragDirection, setDragDirection] = useState<"none" | "up" | "down" | "left" | "right">("none")
  const [showDetail, setShowDetail] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const stackOffset = (total - 1 - index) * 8
  const stackScale = 1 - (total - 1 - index) * 0.04

  const handleDrag = useCallback((_: unknown, info: PanInfo) => {
    const { offset } = info
    const absX = Math.abs(offset.x)
    const absY = Math.abs(offset.y)

    if (absX < 20 && absY < 20) {
      setDragDirection("none")
      return
    }

    if (absY > absX) {
      setDragDirection(offset.y < 0 ? "up" : "down")
    } else {
      setDragDirection(offset.x > 0 ? "right" : "left")
    }
  }, [])

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const { offset, velocity } = info
      const absX = Math.abs(offset.x)
      const absY = Math.abs(offset.y)

      // Swipe up = lock in
      if (offset.y < -100 || (offset.y < -50 && velocity.y < -500)) {
        onLockIn(game)
        return
      }

      // Swipe down = soft reject
      if (offset.y > 100 || (offset.y > 50 && velocity.y > 500)) {
        onReject(game)
        return
      }

      // Horizontal swipes = paging (treated as reject/next for now)
      if (absX > 120 || (absX > 60 && Math.abs(velocity.x) > 500)) {
        onReject(game)
        return
      }

      // Not enough = snap back
      setDragDirection("none")
    },
    [game, onLockIn, onReject]
  )

  const handlePointerDown = useCallback(() => {
    pressTimer.current = setTimeout(() => {
      setShowDetail(true)
    }, 250)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }, [])

  const getHintColor = () => {
    if (dragDirection === "up") return "rgba(59, 165, 93, 0.3)"
    if (dragDirection === "down") return "rgba(237, 66, 69, 0.15)"
    return "transparent"
  }

  const getHintLabel = () => {
    if (dragDirection === "up") return "Lock In"
    if (dragDirection === "down") return "Skip"
    return null
  }

  return (
    <>
      <motion.div
        ref={cardRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{
          zIndex: index,
          pointerEvents: isTop ? "auto" : "none",
        }}
        initial={{ y: 20, opacity: 0, scale: stackScale }}
        animate={{
          y: stackOffset,
          opacity: 1,
          scale: stackScale,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <motion.div
          drag={isTop}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.6}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          whileDrag={{ cursor: "grabbing" }}
          className="relative w-full max-w-[320px] cursor-grab select-none touch-none"
          style={{ aspectRatio: "3/4" }}
        >
          {/* Card body */}
          <div
            className="relative h-full w-full overflow-hidden rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: getHintColor() !== "transparent"
                ? `0 0 40px ${getHintColor()}, inset 0 0 40px ${getHintColor()}`
                : "0 8px 32px rgba(0,0,0,0.4)",
              transition: "box-shadow 0.2s ease",
            }}
          >
            {/* Game image */}
            <div className="relative h-[55%] w-full overflow-hidden">
              <Image
                src={game.header_image}
                alt={game.name}
                fill
                className="object-cover"
                sizes="320px"
                priority={isTop}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f14] via-transparent to-transparent" />
            </div>

            {/* Game info */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 p-5">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-foreground leading-tight">{game.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {game.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {game.genres?.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-foreground/80"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    {genre.replace("-", " ")}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>~{game.estimated_session_length} min</span>
              </div>
            </div>

            {/* Drag hint overlay */}
            {getHintLabel() && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center rounded-2xl"
                style={{ background: getHintColor() }}
              >
                <span
                  className={`text-2xl font-bold ${
                    dragDirection === "up" ? "text-success" : "text-destructive"
                  }`}
                >
                  {getHintLabel()}
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Detail popup on press-hold */}
      {showDetail && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-6"
          onClick={() => setShowDetail(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="glass-card w-full max-w-sm p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-xl">
              <Image
                src={game.header_image}
                alt={game.name}
                fill
                className="object-cover"
                sizes="360px"
              />
            </div>
            <h3 className="text-xl font-bold text-foreground">{game.name}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {game.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {game.genres?.map((genre) => (
                <span
                  key={genre}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-foreground/80"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  {genre.replace("-", " ")}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>~{game.estimated_session_length} min session</span>
            </div>
            <button
              onClick={() => setShowDetail(false)}
              className="mt-2 h-12 w-full rounded-xl bg-secondary text-sm font-medium text-foreground transition-colors hover:bg-muted min-h-[44px]"
            >
              Tap anywhere to close
            </button>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}
