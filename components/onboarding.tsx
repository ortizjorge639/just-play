"use client"

import { useState, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { savePreferences } from "@/app/actions"
import type { UserPreferences } from "@/lib/types"

const STEPS = ["mood", "time", "energy", "genres", "style"] as const

const MOODS = [
  { value: "adventurous", label: "Adventurous", desc: "I want to explore and discover" },
  { value: "chill", label: "Chill", desc: "Low stakes, cozy vibes" },
  { value: "competitive", label: "Competitive", desc: "I want a challenge" },
  { value: "creative", label: "Creative", desc: "I want to build or express" },
]

const TIMES = [
  { value: 30, label: "Quick hit", desc: "~30 min" },
  { value: 60, label: "Standard", desc: "~1 hour" },
  { value: 120, label: "Deep dive", desc: "2+ hours" },
]

const ENERGIES = [
  { value: "low", label: "Low", desc: "Brain off, auto-pilot welcome" },
  { value: "medium", label: "Medium", desc: "Engaged but not sweating" },
  { value: "high", label: "High", desc: "Full focus, peak performance" },
]

const GENRES = [
  "action",
  "roguelike",
  "strategy",
  "simulation",
  "platformer",
  "metroidvania",
  "relaxing",
  "card-game",
  "indie",
  "farming",
]

const STYLES = [
  { value: "one", label: "Just one", desc: "Give me THE pick" },
  { value: "few", label: "A few options", desc: "2-3 cards to choose from" },
  { value: "surprise", label: "Surprise me", desc: "Dealer's choice" },
]

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [isPending, startTransition] = useTransition()
  const [direction, setDirection] = useState(1)

  const currentStep = STEPS[step]

  function next() {
    if (step < STEPS.length - 1) {
      setDirection(1)
      setStep(step + 1)
    } else {
      // Save and complete
      startTransition(async () => {
        await savePreferences(preferences)
        onComplete()
      })
    }
  }

  function back() {
    if (step > 0) {
      setDirection(-1)
      setStep(step - 1)
    }
  }

  function selectOption(key: string, value: string | number | string[]) {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  function toggleGenre(genre: string) {
    const current = preferences.genre_preferences || []
    const next = current.includes(genre)
      ? current.filter((g) => g !== genre)
      : [...current, genre]
    setPreferences((prev) => ({ ...prev, genre_preferences: next }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case "mood":
        return !!preferences.mood
      case "time":
        return !!preferences.time_available
      case "energy":
        return !!preferences.energy
      case "genres":
        return (preferences.genre_preferences?.length || 0) > 0
      case "style":
        return !!preferences.play_style
      default:
        return false
    }
  }

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8">
      {/* Progress indicator */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: i <= step ? "#5865F2" : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      {/* Back button */}
      {step > 0 && (
        <button
          onClick={back}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors self-start min-h-[44px]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="flex-1 flex flex-col"
          >
            {currentStep === "mood" && (
              <StepContainer
                title="How are you feeling?"
                subtitle="Sets the vibe for your recommendations"
              >
                <div className="flex flex-col gap-3">
                  {MOODS.map((mood) => (
                    <OptionButton
                      key={mood.value}
                      selected={preferences.mood === mood.value}
                      onClick={() => selectOption("mood", mood.value)}
                      label={mood.label}
                      description={mood.desc}
                    />
                  ))}
                </div>
              </StepContainer>
            )}

            {currentStep === "time" && (
              <StepContainer
                title="How much time do you have?"
                subtitle="We'll match games to your window"
              >
                <div className="flex flex-col gap-3">
                  {TIMES.map((time) => (
                    <OptionButton
                      key={time.value}
                      selected={preferences.time_available === time.value}
                      onClick={() => selectOption("time_available", time.value)}
                      label={time.label}
                      description={time.desc}
                    />
                  ))}
                </div>
              </StepContainer>
            )}

            {currentStep === "energy" && (
              <StepContainer
                title="Energy level?"
                subtitle="No judgment. We all have couch potato days."
              >
                <div className="flex flex-col gap-3">
                  {ENERGIES.map((energy) => (
                    <OptionButton
                      key={energy.value}
                      selected={preferences.energy === energy.value}
                      onClick={() => selectOption("energy", energy.value)}
                      label={energy.label}
                      description={energy.desc}
                    />
                  ))}
                </div>
              </StepContainer>
            )}

            {currentStep === "genres" && (
              <StepContainer
                title="Pick your genres"
                subtitle="Select all that interest you"
              >
                <div className="flex flex-wrap gap-3">
                  {GENRES.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                        preferences.genre_preferences?.includes(genre)
                          ? "bg-primary text-primary-foreground"
                          : "glass-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {genre.replace("-", " ")}
                    </button>
                  ))}
                </div>
              </StepContainer>
            )}

            {currentStep === "style" && (
              <StepContainer
                title="How many choices?"
                subtitle="We'll never show more than 3"
              >
                <div className="flex flex-col gap-3">
                  {STYLES.map((style) => (
                    <OptionButton
                      key={style.value}
                      selected={preferences.play_style === style.value}
                      onClick={() => selectOption("play_style", style.value)}
                      label={style.label}
                      description={style.desc}
                    />
                  ))}
                </div>
              </StepContainer>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Next button */}
      <div className="pt-6 pb-2">
        <button
          onClick={next}
          disabled={!canProceed() || isPending}
          className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending
            ? "Saving..."
            : step === STEPS.length - 1
            ? "Let's Play"
            : "Continue"}
        </button>
      </div>
    </main>
  )
}

function StepContainer({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-foreground text-balance">{title}</h2>
        <p className="text-muted-foreground text-base">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function OptionButton({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean
  onClick: () => void
  label: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-0.5 rounded-xl p-4 text-left transition-all min-h-[60px] ${
        selected
          ? "bg-primary/15 border-2 border-primary"
          : "glass-card hover:bg-muted"
      }`}
    >
      <span
        className={`text-base font-semibold ${
          selected ? "text-primary" : "text-foreground"
        }`}
      >
        {label}
      </span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  )
}
