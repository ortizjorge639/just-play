"use client"

import { useFullscreenLayer } from "./use-fullscreen-layer"

export function EmptyPlot({ onBack }: { onBack: () => void }) {
  const layer = useFullscreenLayer(onBack)

  return (
    <div ref={layer} role="dialog" aria-modal="true" aria-label="Your settlement" className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          data-initial-focus
          className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground"
        >
          Back to Home
        </button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <div
          aria-hidden="true"
          data-testid="first-home-plot"
          className="relative grid size-56 place-items-center rounded-full border-2 border-dashed border-primary/50 bg-card"
        >
          <div className="grid size-20 place-items-center rounded-2xl border border-primary/60 bg-primary/10">
            <span className="text-3xl text-primary">+</span>
          </div>
        </div>
        <div className="max-w-xs">
          <h2 className="text-xl font-semibold text-foreground">Your first home goes here</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Beat a game and it moves in. Lock one in from the Deck to get started.
          </p>
        </div>
      </div>
    </div>
  )
}
