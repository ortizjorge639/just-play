"use client"

import { useState, useCallback, useRef, useId } from "react"
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
  const [goalOpen, setGoalOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const pages = parsePages(notes)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState(goal)
  const [direction, setDirection] = useState(0)
  const constraintsRef = useRef(null)
  const goalId = useId()
  const notesId = useId()

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
      const updated = [...pages]
      updated[currentPage] = text
      onNotesChange(JSON.stringify(updated))
    },
    [currentPage, pages, onNotesChange]
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

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
        <button
          onClick={() => setGoalOpen(o => !o)}
          aria-expanded={goalOpen}
          aria-controls={goalOpen ? goalId : undefined}
          className="flex min-h-11 w-full items-center gap-3 text-left transition-colors hover:text-primary"
        >
          <span className="flex min-w-0 flex-1 items-baseline gap-3">
            <span className="shrink-0 text-sm font-semibold text-foreground">Session goal</span>
            {goal && !goalOpen ? <span className="truncate text-sm text-muted-foreground">{goal}</span> : null}
          </span>
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
              id={goalId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                {editingGoal || !goal ? (
                  <div className="flex flex-col gap-3">
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

                    {(editingGoal || goal) ? (
                      <>
                        <input
                          type="text"
                          value={goalDraft}
                          onChange={e => setGoalDraft(e.target.value)}
                          aria-label="Session goal"
                          placeholder="Set an intention for this session"
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
                      aria-label="Edit session goal"
                      className="p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
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
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
        <button
          onClick={() => setNotesOpen(o => !o)}
          aria-expanded={notesOpen}
          aria-controls={notesOpen ? notesId : undefined}
          className="flex min-h-11 w-full items-center gap-3 text-left transition-colors hover:text-primary"
        >
          <span className="flex-1 text-sm font-semibold text-foreground">Notes</span>
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
              id={notesId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="relative pt-4">
                <div className="relative flex flex-col overflow-hidden">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs tabular-nums text-muted-foreground">{currentPage + 1}/10</span>
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
                            aria-label={`Session notes, page ${currentPage + 1}`}
                            value={pages[currentPage]}
                            onChange={e => handlePageEdit(e.target.value)}
                            placeholder="Add a note for next time"
                            className="w-full min-h-[100px] rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring resize-y leading-relaxed"
                          />
                        </motion.div>
                      </AnimatePresence>
                    </motion.div>
                  </div>

                  {/* The dots stay small to look at; each one's tap area is 44px tall and as wide as the row allows. */}
                  <div className="mt-1 flex items-center justify-center border-t border-border/20 pt-1">
                    <button
                      onClick={() => flipPage(-1)}
                      disabled={currentPage === 0}
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-15"
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    <div className="flex min-w-0 max-w-[20rem] flex-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setDirection(i > currentPage ? 1 : -1)
                            setCurrentPage(i)
                          }}
                          aria-label={`Page ${i + 1}`}
                          aria-current={i === currentPage ? "page" : undefined}
                          className="group flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <span
                            aria-hidden="true"
                            className={`rounded-full transition-all ${
                              i === currentPage
                                ? "h-2 w-2 bg-primary"
                                : pages[i]?.trim()
                                  ? "h-1.5 w-1.5 bg-foreground/30 group-hover:bg-foreground/60"
                                  : "h-1.5 w-1.5 bg-muted-foreground/15 group-hover:bg-muted-foreground/50"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => flipPage(1)}
                      disabled={currentPage === 9}
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-15"
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
      </section>
    </div>
  )
}
