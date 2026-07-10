import Link from "next/link"
import { requestPasswordReset } from "../actions"

export default async function ForgotPasswordPage(props: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error
  const sent = searchParams.sent === "1"

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            Lost Password
          </h1>
          <p className="text-muted-foreground text-base">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-primary/10 p-4 text-sm text-foreground">
              If an account exists for that email, a reset link is on its way.
              Check your inbox (and spam folder) — the link opens a page where
              you can choose a new password.
            </div>
            <Link
              href="/auth/forgot-password"
              className="text-center text-sm font-medium text-primary hover:underline"
            >
              Send another link
            </Link>
          </div>
        ) : (
          <form action={requestPasswordReset} className="flex flex-col gap-4">
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

            <button
              type="submit"
              className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80"
            >
              Send Reset Link
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {"Remembered it? "}
          <Link
            href="/auth/login"
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
