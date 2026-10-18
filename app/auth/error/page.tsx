import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; reason?: string }>
}) {
  const params = await searchParams
  const recovery = params.reason === "recovery-link"
  const message = recovery
    ? "We could not verify this reset link. It may be expired, already used, or opened in a different browser. Request a fresh link here and open the newest email in this same browser, not your email app's built-in browser."
    : params.reason === "invalid-destination"
      ? "This authentication link has an invalid destination. Return to sign in, or request a fresh password-reset link from this browser."
      : params.message || "Could not authenticate user. If this was a password-reset email, request a fresh link and open it in the same browser that requested it."

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">
            {recovery ? "Reset Link Could Not Be Verified" : "Authentication Error"}
          </h1>
          <p className="text-base text-muted-foreground">
            {message}
          </p>
        </div>

        <Link href="/auth/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Request a fresh reset link
        </Link>
        <Link
          href="/auth/login"
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 min-h-[44px]"
        >
          Back to Login
        </Link>
      </div>
    </div>
  )
}
