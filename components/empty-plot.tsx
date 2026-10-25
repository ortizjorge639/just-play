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
        <svg
          aria-hidden="true"
          data-testid="first-home-plot"
          viewBox="0 0 240 180"
          className="w-full max-w-[280px]"
        >
          <ellipse cx="120" cy="140" rx="104" ry="26" className="fill-card stroke-border" strokeWidth="1.5" />
          <g className="text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" strokeLinejoin="round">
            <ellipse cx="120" cy="136" rx="56" ry="14" opacity="0.7" />
            <path d="M92 130V96h56v34" opacity="0.5" />
            <path d="M84 98l36-30 36 30z" opacity="0.5" />
            <path d="M114 130v-18h12v18" opacity="0.5" />
          </g>
          <g>
            <rect x="196" y="112" width="5" height="22" rx="2" className="fill-muted-foreground/50" />
            <circle cx="198" cy="102" r="15" className="fill-muted-foreground/30" />
            <rect x="34" y="118" width="5" height="18" rx="2" className="fill-muted-foreground/50" />
            <circle cx="36" cy="110" r="12" className="fill-muted-foreground/30" />
          </g>
        </svg>
        <div className="max-w-xs">
          <h2 className="text-xl font-semibold text-foreground">Your first home goes here</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Finish a game and it moves in here as a resident. Lock one in from the Deck to get started.
          </p>
        </div>
      </div>
    </div>
  )
}
