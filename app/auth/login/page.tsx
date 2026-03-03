import Link from "next/link"
import { login, adminBypass } from "../actions"

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            Just Play
          </h1>
          <p className="text-muted-foreground text-base">
            Stop scrolling. Start playing.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-12 w-full rounded-lg bg-secondary px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-lg bg-secondary px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80"
          >
            Sign In
          </button>
        </form>

        <div className="relative flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">OR</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={adminBypass}>
          <button
            type="submit"
            className="h-12 w-full rounded-lg border border-border bg-secondary text-base font-medium text-foreground transition-colors hover:bg-muted active:bg-muted/80"
          >
            Quick Play (Test Mode)
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {"Don't have an account? "}
          <Link
            href="/auth/sign-up"
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
