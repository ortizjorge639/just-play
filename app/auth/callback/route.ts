import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { AuthRedirectError, authCallbackDestination, trustedAppOrigin } from "@/lib/auth-redirects"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const { searchParams } = url
  let origin: string
  try {
    origin = trustedAppOrigin(url.origin)
  } catch (error) {
    if (!(error instanceof AuthRedirectError)) throw error
    return new NextResponse("Invalid authentication callback origin.", { status: 400 })
  }
  const code = searchParams.get("code")
  let next: "/" | "/auth/update-password"
  try {
    next = authCallbackDestination(searchParams.get("next"))
  } catch (error) {
    if (!(error instanceof AuthRedirectError)) throw error
    return NextResponse.redirect(`${origin}/auth/error?reason=invalid-destination`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const reason = next === "/auth/update-password" ? "recovery-link" : "callback"
  return NextResponse.redirect(`${origin}/auth/error?reason=${reason}`)
}
