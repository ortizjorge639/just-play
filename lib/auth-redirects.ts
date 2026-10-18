interface AuthOriginEnvironment {
  NODE_ENV?: string
  NEXT_PUBLIC_SITE_URL?: string
  VERCEL_URL?: string
  VERCEL_BRANCH_URL?: string
  VERCEL_PROJECT_PRODUCTION_URL?: string
}

export class AuthRedirectError extends Error {}

function parseOrigin(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new AuthRedirectError("Invalid application origin")
  }
  if (
    url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
    !["https:", "http:"].includes(url.protocol)
  ) {
    throw new AuthRedirectError("Invalid application origin")
  }
  return url
}

export function trustedAppOrigin(
  value: string,
  environment: AuthOriginEnvironment = process.env,
): string {
  const url = parseOrigin(value)
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if (local && environment.NODE_ENV !== "production") return url.origin
  if (url.protocol !== "https:") throw new AuthRedirectError("HTTPS is required")

  const configured = [
    environment.NEXT_PUBLIC_SITE_URL,
    ...[
      environment.VERCEL_URL,
      environment.VERCEL_BRANCH_URL,
      environment.VERCEL_PROJECT_PRODUCTION_URL,
    ].filter(Boolean).map((host) => `https://${host}`),
  ].filter((origin): origin is string => !!origin)
  if (!configured.some((origin) => parseOrigin(origin).origin === url.origin)) {
    throw new AuthRedirectError("Untrusted application origin")
  }
  return url.origin
}

export function recoveryRedirectTo(
  requestOrigin: string | null,
  requestHost: string | null,
  environment: AuthOriginEnvironment = process.env,
): string {
  if (!requestOrigin || !requestHost) throw new AuthRedirectError("Missing request origin")
  const origin = trustedAppOrigin(requestOrigin, environment)
  if (new URL(origin).host !== requestHost.toLowerCase()) {
    throw new AuthRedirectError("Request origin does not match the application host")
  }
  return `${origin}/auth/callback?next=/auth/update-password`
}

export function authCallbackDestination(next: string | null): "/" | "/auth/update-password" {
  if (next === null || next === "/") return "/"
  if (next === "/auth/update-password") return next
  throw new AuthRedirectError("Invalid authentication destination")
}
