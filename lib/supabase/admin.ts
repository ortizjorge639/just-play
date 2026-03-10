import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Admin Supabase client that bypasses RLS.
 * Used for server-side operations on shared tables (e.g., inserting games).
 * Requires SUPABASE_SERVICE_ROLE_KEY env var.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it from Supabase Dashboard > Settings > API."
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
