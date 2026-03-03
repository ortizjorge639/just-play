"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"

interface SessionNotepadProps {
  goal: string
  notes: string
  onGoalSave: (goal: string) => void
  onNotesChange: (notes: string) => void
}

const GOAL_PRESETS = [
  "Beat the game",
  "Reach Diamond",
  "Collect all items",
  "Finish a quest",
  "Try a new build",
  "Just vibe",
]

function parsePages(raw: string): string[] {
  if (!raw) return Array.from({ length: 10 }, () => "")
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      const pages = arr.map((p: unknown) => String(p ?? ""))
      while (pages.length < 10) pages.push("")
      return pages.slice(0, 10)
    }
  } catch { /* legacy plain string */ }
  const pages = Array.from({ length: 10 }, () => "")
  pages[0] = raw
  return pages
}

export function SessionNotepad({
  goal,
  notes,
  onGoalSave,
  onNotesChange,
}: SessionNotepadProps) {
  const [goalOpen, setGoalOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [pages, setPages] = useState(() => parsePages(notes))
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState(goal)
  const [direction, setDirection] = useState(0)
  const constraintsRef = useRef(null)

  const flipPage = useCallback((dir: number) => {
    setCurrentPage(p => {
      const next = p + dir
      if (next < 0 || next > 9) return p
      setDirection(dir)
      return next
    })
  }, [])

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const threshold = 40
      if (info.offset.x < -threshold && info.velocity.x < -100) {
        flipPage(1)
      } else if (info.offset.x > threshold && info.velocity.x > 100) {
        flipPage(-1)
      }
    },
    [flipPage]
  )

  const handlePageEdit = useCallback(
    (text: string) => {
      setPages(prev => {
        const updated = [...prev]
        updated[currentPage] = text
        onNotesChange(JSON.stringify(updated))
        return updated
      })
    },
    [currentPage, onNotesChange]
  )

  const handleGoalSubmit = useCallback(() => {
    const trimmed = goalDraft.trim()
    if (trimmed) {
      onGoalSave(trimmed)
      setEditingGoal(false)
    }
  }, [goalDraft, onGoalSave])

  const handlePresetPick = useCallback((preset: string) => {
    setGoalDraft(preset)
    setEditingGoal(true)
  }, [])

  const usedPages = pages.filter(p => p.trim()).length

  return (
    <div className="flex flex-col gap-3">
      {/* Goal pill */}
      <div>
        <button
          onClick={() => setGoalOpen(o => !o)}
          className="flex items-center gap-2 w-full px-4 py-3 rounded-xl glass-card transition-all active:scale-[0.98] min-h-[44px]"
        >
          <span className="text-sm">🎯</span>
          <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
            {goal || "Set a Goal"}
          </span>
          {goal && !goalOpen && (
            <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium">
              set
            </span>
          )}
          <svg
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${goalOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <AnimatePresence>
          {goalOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="glass-card p-4 rounded-xl mt-2">
                {editingGoal || !goal ? (
                  <div className="flex flex-col gap-3">
                    {/* Preset bubbles — only when no goal is set */}
                    {!goal && !editingGoal && (
                      <div className="flex flex-wrap gap-2">
                        {GOAL_PRESETS.map(preset => (
                          <button
                            key={preset}
                            onClick={() => handlePresetPick(preset)}
                            className="px-3 py-1.5 rounded-full bg-secondary/80 text-xs font-medium text-foreground transition-colors hover:bg-primary/20 hover:text-primary active:scale-95 min-h-[32px]"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Custom input — shown when editing or after picking a preset */}
                    {(editingGoal || goal) ? (
                      <>
                        <input
                          type="text"
                          value={goalDraft}
                          onChange={e => setGoalDraft(e.target.value)}
                          placeholder="Type your goal..."
                          className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                          onKeyDown={e => e.key === "Enter" && handleGoalSubmit()}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleGoalSubmit}
                            disabled={!goalDraft.trim()}
                            className="flex-1 h-9 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40 min-h-[36px]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingGoal(false)
                              setGoalDraft(goal)
                            }}
                            className="h-9 px-3 rounded-lg text-sm text-muted-foreground min-h-[36px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingGoal(true)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left min-h-[36px]"
                      >
                        Or type your own...
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-foreground font-medium flex-1">{goal}</p>
                    <button
                      onClick={() => {
                        setEditingGoal(true)
                        setGoalDraft(goal)
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notes pill */}
      <div>
        <button
          onClick={() => setNotesOpen(o => !o)}
          className="flex items-center gap-2 w-full px-4 py-3 rounded-xl glass-card transition-all active:scale-[0.98] min-h-[44px]"
        >
          <span className="text-sm">📝</span>
          <span className="text-sm font-medium text-foreground flex-1 text-left">
            Notes
          </span>
          {!notesOpen && (
            <span className="text-[10px] text-muted-foreground tabular-nums bg-secondary/80 px-1.5 py-0.5 rounded-full">
              {usedPages > 0 ? `${usedPages} pg` : "empty"}
            </span>
          )}
          <svg
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${notesOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <AnimatePresence>
          {notesOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="relative pb-1.5 mt-2">
                {/* Stacked page edges */}
                <div className="absolute bottom-0.5 left-1.5 right-1.5 top-1 rounded-xl border border-border/30 bg-card/40" />
                <div className="absolute bottom-0 left-3 right-3 top-2 rounded-xl border border-border/15 bg-card/20" />

                <div className="relative glass-card rounded-xl p-4 flex flex-col overflow-hidden">
                  {/* Page header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Page {currentPage + 1}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {currentPage + 1}/10
                    </span>
                  </div>

                  {/* Swipeable page area */}
                  <div ref={constraintsRef} className="relative touch-pan-y">
                    <motion.div
                      drag="x"
                      dragConstraints={constraintsRef}
                      dragElastic={0.15}
                      onDragEnd={handleDragEnd}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={currentPage}
                          initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          <textarea
                            value={pages[currentPage]}
                            onChange={e => handlePageEdit(e.target.value)}
                            placeholder="Write something..."
                            className="w-full h-[100px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none resize-none leading-relaxed"
                          />
                        </motion.div>
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  {/* Page dots */}
                  <div className="flex items-center justify-center gap-1 pt-2 border-t border-border/20 mt-1">
                    <button
                      onClick={() => flipPage(-1)}
                      disabled={currentPage === 0}
                      className="text-muted-foreground disabled:opacity-15 text-sm leading-none px-1 min-h-[24px]"
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    <div className="flex gap-[3px]">
                      {Array.from({ length: 10 }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setDirection(i > currentPage ? 1 : -1)
                            setCurrentPage(i)
                          }}
                          className={`rounded-full transition-all ${
                            i === currentPage
                              ? "w-2 h-2 bg-primary"
                              : pages[i]?.trim()
                                ? "w-1.5 h-1.5 bg-foreground/30"
                                : "w-1.5 h-1.5 bg-muted-foreground/15"
                          }`}
                          aria-label={`Page ${i + 1}`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => flipPage(1)}
                      disabled={currentPage === 9}
                      className="text-muted-foreground disabled:opacity-15 text-sm leading-none px-1 min-h-[24px]"
                      aria-label="Next page"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
