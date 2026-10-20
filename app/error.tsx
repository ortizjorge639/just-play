"use client"

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold text-foreground">Couldn&apos;t load your games</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Your data is safe. The connection failed before anything loaded. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </main>
  )
}
