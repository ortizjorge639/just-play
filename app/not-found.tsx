import Link from "next/link"

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold text-foreground">That page isn&apos;t here</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        The link may be old or mistyped. Your games are right where you left them.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Back to Just Play
      </Link>
    </main>
  )
}
