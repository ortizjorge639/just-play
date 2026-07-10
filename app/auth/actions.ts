"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const message = error.message.toLowerCase().includes("rate limit")
      ? "Too many attempts. Please wait a few minutes before trying again."
      : error.message
    return redirect("/auth/login?error=" + encodeURIComponent(message))
  }

  return redirect("/")
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const displayName = formData.get("display_name") as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")}/auth/callback`,
      data: {
        display_name: displayName || email.split("@")[0],
      },
    },
  })

  if (error) {
    const message = error.message.toLowerCase().includes("rate limit")
      ? "Too many sign-up attempts. Please wait a few minutes before trying again."
      : error.message
    return redirect("/auth/sign-up?error=" + encodeURIComponent(message))
  }

  return redirect("/auth/sign-up-success")
}

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  )
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get("email") as string)?.trim()

  if (!email) {
    return redirect("/auth/forgot-password?error=" + encodeURIComponent("Enter your email address"))
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password`,
  })

  if (error) {
    const message = error.message.toLowerCase().includes("rate limit")
      ? "Too many reset emails requested. Please wait a few minutes and try again."
      : error.message
    return redirect("/auth/forgot-password?error=" + encodeURIComponent(message))
  }

  // Same response whether or not the email has an account — don't leak which
  // addresses are registered.
  return redirect("/auth/forgot-password?sent=1")
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get("password") as string
  const confirm = formData.get("confirm") as string

  if (!password || password.length < 6) {
    return redirect("/auth/update-password?error=" + encodeURIComponent("Password must be at least 6 characters"))
  }
  if (password !== confirm) {
    return redirect("/auth/update-password?error=" + encodeURIComponent("Passwords don't match"))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return redirect(
      "/auth/forgot-password?error=" +
        encodeURIComponent("Your reset link expired or was already used. Request a new one below."),
    )
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return redirect("/auth/update-password?error=" + encodeURIComponent(error.message))
  }

  return redirect("/?password_updated=1")
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return redirect("/auth/login")
}

export async function adminBypass() {
  const supabase = await createClient()

  // Use the pre-configured test user (email already confirmed in database)
  const { error } = await supabase.auth.signInWithPassword({
    email: "test@justplay.dev",
    password: "testpassword123",
  })

  if (error) {
    return redirect("/auth/login?error=" + encodeURIComponent(error.message))
  }

  return redirect("/")
}
