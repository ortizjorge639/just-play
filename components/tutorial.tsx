"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

interface TutorialProps {
  onComplete: () => void
  onSkip?: () => void
}

const SLIDES = [
  {
    title: "Welcome to Just Play",
    subtitle: "Stop scrolling through your library. Start playing.",
  },
  {
    image: "/finding_game_to_play.jpeg",
    title: "Swipe to Find Your Game",
    subtitle: "We pick 1–3 games based on your mood, time, and energy. Swipe up to lock in, down to skip.",
  },
  {
    image: "/game_in_progress.jpeg",
    title: "Track Your Session",
    subtitle: "A live timer, notes, and goals keep you focused. Pause anytime, pick up later.",
  },
  {
    image: "/coming%20back%20to%20your%20game.jpeg",
    title: "Pick Up Where You Left Off",
    subtitle: "Your game stays locked in between sessions. Come back tomorrow and keep going.",
  },
  {
    image: "/progress%20page.jpeg",
    title: "See Your Journey",
    subtitle: "Sessions, play time, streaks — watch your gaming habits come together.",
  },
]

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [direction, setDirection] = useState(1)

  const isLastSlide = currentSlide === SLIDES.length - 1

  const next = useCallback(() => {
    if (isLastSlide) {
      onComplete()
    } else {
      setDirection(1)
      setCurrentSlide((prev) => prev + 1)
    }
  }, [isLastSlide, onComplete])

  const skip = useCallback(() => {
    if (onSkip) {
      onSkip()
    } else {
      onComplete()
    }
  }, [onComplete, onSkip])

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentSlide ? 1 : -1)
    setCurrentSlide(index)
  }, [currentSlide])

  const slide = SLIDES[currentSlide]

  const variants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 60 : -60,
    }),
    center: {
      opacity: 1,
      x: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -60 : 60,
    }),
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Skip button */}
      {!isLastSlide && (
        <div className="absolute top-0 right-0 p-6 z-10">
          <button
            onClick={skip}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
          >
            Skip
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              opacity: { duration: 0.2 }
            }}
            className="flex flex-col items-center text-center max-w-sm w-full"
          >
            {/* Screenshot or welcome icon */}
            {slide.image ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mb-6 w-full max-w-[240px] rounded-2xl overflow-hidden border border-border/30 shadow-lg shadow-primary/5"
              >
                <Image
                  src={slide.image}
                  alt={slide.title}
                  width={240}
                  height={480}
                  className="w-full h-auto"
                />
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mb-8 text-primary"
              >
                <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              </motion.div>
            )}

            {/* Title */}
            <motion.h1
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-2xl font-bold text-foreground mb-3 text-balance"
            >
              {slide.title}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-base text-muted-foreground text-balance leading-relaxed"
            >
              {slide.subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section */}
      <div className="px-8 pb-12 pt-6 flex flex-col gap-6">
        {/* Pagination dots */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={`Go to slide ${index + 1}`}
            >
              <motion.div
                className="rounded-full"
                animate={{
                  width: index === currentSlide ? 24 : 8,
                  backgroundColor: index === currentSlide ? "#5865F2" : "rgba(255,255,255,0.2)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ height: 8 }}
              />
            </button>
          ))}
        </div>

        {/* Continue button */}
        <motion.button
          onClick={next}
          whileTap={{ scale: 0.98 }}
          className="h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 min-h-[56px]"
        >
          {isLastSlide ? "Let's Play" : "Continue"}
        </motion.button>
      </div>
    </div>
  )
}
