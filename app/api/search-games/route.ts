import { NextRequest, NextResponse } from "next/server"
import { searchIGDBGames } from "@/lib/igdb"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const query = request.nextUrl.searchParams.get("q")?.trim()
  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  try {
    const results = await searchIGDBGames(query)
    return NextResponse.json(results)
  } catch (error) {
    console.error("[search-games] IGDB search error:", error)
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    )
  }
}
