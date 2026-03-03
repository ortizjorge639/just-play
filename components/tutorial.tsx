"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface TutorialProps {
  onComplete: () => void
  onSkip?: () => void
}

const SLIDES = [
  {
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    title: "Welcome to Just Play",
    subtitle: "Stop scrolling through your library. Start playing.",
  },
  {
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    title: "We Pick for You",
    subtitle: "Tell us your mood, time, and energy. We'll show you 1-3 perfect games.",
  },
  {
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H3.75" />
      </svg>
    ),
    title: "Swipe to Decide",
    subtitle: "Swipe up to lock in a game. Swipe down to skip. It's that simple.",
  },
  {
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Track Your Time",
    subtitle: "Start playing when you're ready. Finish when you're done. See your progress over time.",
  },
  {
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    ),
    title: "Ready?",
    subtitle: "Let's find something to play.",
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
      <div className="flex-1 flex flex-col items-center justify-center px-8">
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
            className="flex flex-col items-center text-center max-w-sm"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="mb-8 text-primary"
            >
              {slide.icon}
            </motion.div>

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
          {isLastSlide ? "Get Started" : "Continue"}
        </motion.button>
      </div>
    </div>
  )
}
