import { updatePassword } from "../actions"

export default async function UpdatePasswordPage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
            Choose a New Password
          </h1>
          <p className="text-muted-foreground text-base">
            You&apos;re signed in via your reset link — set a new password to
            finish.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <form action={updatePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="h-12 w-full rounded-lg bg-secondary px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="At least 6 characters"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirm" className="text-sm font-medium text-foreground">
              Confirm new password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="h-12 w-full rounded-lg bg-secondary px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Same password again"
            />
          </div>

          <button
            type="submit"
            className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80"
          >
            Save New Password
          </button>
        </form>
      </div>
    </main>
  )
}
