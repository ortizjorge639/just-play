import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const params = await searchParams
  const message = params.message || "An error occurred during authentication"

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
            Authentication Error
          </h1>
          <p className="text-base text-muted-foreground">
            {message}
          </p>
        </div>

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
