/**
 * IGDB API client for fetching video game data.
 * Uses Twitch OAuth for authentication.
 * https://api-docs.igdb.com
 */

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
const IGDB_BASE_URL = "https://api.igdb.com/v4"

// ── Types ──────────────────────────────────────────────────────────────

export interface IGDBToken {
  access_token: string
  expires_in: number
  token_type: string
}

export interface IGDBGame {
  id: number
  name: string
  genres?: { id: number; name: string }[]
  themes?: { id: number; name: string }[]
  keywords?: { id: number; name: string }[]
  cover?: { url: string; image_id: string }
  summary?: string
  rating?: number
  total_rating?: number
  total_rating_count?: number
  game_modes?: { id: number; name: string }[]
  category?: number
}

export interface IGDBTimeToBeat {
  game_id: number
  hastily?: number
  normally?: number
  completely?: number
}

// ── Genre Mapping ──────────────────────────────────────────────────────
// Maps IGDB genre IDs → Just Play genre strings used by the scoring engine

const IGDB_GENRE_MAP: Record<number, string[]> = {
  4: ["action", "challenging"],    // Fighting
  5: ["action"],                   // Shooter
  8: ["platformer"],               // Platform
  9: ["puzzle"],                   // Puzzle
  10: ["racing"],                  // Racing
  11: ["strategy"],                // RTS
  12: ["rpg"],                     // RPG
  13: ["simulation"],              // Simulator
  14: ["sport"],                   // Sport
  15: ["strategy"],                // Strategy
  16: ["strategy", "turn-based"],  // Turn-based strategy
  24: ["strategy"],                // Tactical
  25: ["action"],                  // Hack and slash
  31: ["adventure"],               // Adventure
  32: ["indie"],                   // Indie
  33: ["action"],                  // Arcade
  34: ["visual-novel"],            // Visual Novel
  35: ["card-game"],               // Card & Board Game
  36: ["action"],                  // MOBA
}

const IGDB_THEME_MAP: Record<number, string[]> = {
  1: ["action"],                   // Action
  33: ["sandbox"],                 // Sandbox
  38: ["open-world"],              // Open world
  40: ["social"],                  // Party
  41: ["4x", "strategy"],         // 4X
}

// Keyword substrings that map to Just Play genres
const KEYWORD_GENRE_MAP: Record<string, string[]> = {
  roguelike: ["roguelike"],
  roguelite: ["roguelike"],
  "rogue-like": ["roguelike"],
  metroidvania: ["metroidvania"],
  farming: ["farming"],
  relaxing: ["relaxing"],
  cozy: ["relaxing"],
  atmospheric: ["atmospheric"],
  "open world": ["open-world"],
}

// ── API Functions ──────────────────────────────────────────────────────

export async function getIGDBToken(
  clientId: string,
  clientSecret: string
): Promise<IGDBToken> {
  const url = `${TWITCH_TOKEN_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
  const res = await fetch(url, { method: "POST" })
  if (!res.ok) {
    throw new Error(`Failed to get IGDB token: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

export async function queryIGDB<T = unknown>(
  endpoint: string,
  query: string,
  clientId: string,
  accessToken: string
): Promise<T[]> {
  const res = await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "text/plain",
    },
    body: query,
  })
  if (!res.ok) {
    throw new Error(`IGDB API error: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

// ── Mapping Helpers ────────────────────────────────────────────────────

export function mapIGDBGenres(game: IGDBGame): string[] {
  const genres = new Set<string>()

  game.genres?.forEach((g) => {
    IGDB_GENRE_MAP[g.id]?.forEach((mapped) => genres.add(mapped))
  })

  game.themes?.forEach((t) => {
    IGDB_THEME_MAP[t.id]?.forEach((mapped) => genres.add(mapped))
  })

  game.keywords?.forEach((k) => {
    const lower = k.name.toLowerCase()
    for (const [keyword, mapped] of Object.entries(KEYWORD_GENRE_MAP)) {
      if (lower.includes(keyword)) {
        mapped.forEach((g) => genres.add(g))
      }
    }
  })

  return Array.from(genres)
}

export function estimateSessionLength(game: IGDBGame): number {
  const genreIds = new Set(game.genres?.map((g) => g.id) || [])
  const themeIds = new Set(game.themes?.map((t) => t.id) || [])

  // 4X / Grand Strategy → long sessions
  if (themeIds.has(41) || genreIds.has(16)) return 120
  // Strategy / RPG → medium-long
  if (genreIds.has(15) || genreIds.has(11) || genreIds.has(12)) return 60
  // Simulation → medium
  if (genreIds.has(13)) return 60
  // Card & Board → medium
  if (genreIds.has(35)) return 45
  // Platformer / Arcade → short
  if (genreIds.has(8) || genreIds.has(33)) return 30
  // Action / Fighting / Shooter → medium-short
  if (genreIds.has(4) || genreIds.has(5) || genreIds.has(25)) return 45
  // Puzzle → short
  if (genreIds.has(9)) return 30
  // Default
  return 45
}

export function getIGDBImageUrl(
  imageId: string,
  size: string = "t_720p"
): string {
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`
}

export function escapeSQL(str: string): string {
  return str.replace(/'/g, "''")
}

// ── Runtime Token Cache ───────────────────────────────────────────────
// IGDB tokens last ~60 days; cache in memory to avoid re-auth on every search

let cachedToken: { accessToken: string; expiresAt: number } | null = null

export async function getCachedIGDBToken(): Promise<string> {
  const clientId = process.env.IGDB_CLIENT_ID?.trim()
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error("Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET")
  }

  // Return cached token if still valid (with 5-min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.accessToken
  }

  const token = await getIGDBToken(clientId, clientSecret)
  cachedToken = {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  }
  return cachedToken.accessToken
}

// ── Search Helper ─────────────────────────────────────────────────────

export interface IGDBSearchResult {
  igdbId: number
  name: string
  coverUrl: string | null
  genres: string[]
  estimatedSessionLength: number
  timeToBeatMinutes: number | null
  description: string
}

/**
 * Fetch time-to-beat data for a batch of IGDB game IDs.
 * Returns a map of gameId → minutes (using "normally" with fallbacks).
 */
export async function fetchTimeToBeat(
  gameIds: number[],
  clientId: string,
  accessToken: string
): Promise<Map<number, number>> {
  if (gameIds.length === 0) return new Map()

  const idList = gameIds.join(",")
  const body = `fields game_id, hastily, normally, completely; where game_id = (${idList}); limit 500;`

  try {
    const results = await queryIGDB<IGDBTimeToBeat>(
      "game_time_to_beats",
      body,
      clientId,
      accessToken
    )

    const map = new Map<number, number>()
    for (const entry of results) {
      // Prefer "normally", fall back to "hastily" or "completely"
      const seconds = entry.normally ?? entry.hastily ?? entry.completely
      if (seconds && seconds > 0) {
        map.set(entry.game_id, Math.round(seconds / 60))
      }
    }
    return map
  } catch {
    // time_to_beat is best-effort — don't break search if it fails
    return new Map()
  }
}

export async function searchIGDBGames(
  query: string
): Promise<IGDBSearchResult[]> {
  const clientId = process.env.IGDB_CLIENT_ID?.trim()
  if (!clientId) throw new Error("Missing IGDB_CLIENT_ID")

  const accessToken = await getCachedIGDBToken()

  const body = `
    search "${query.replace(/"/g, '\\"')}";
    fields name, cover.image_id, genres.id, genres.name, themes.id, themes.name,
      keywords.id, keywords.name, summary, category;
    limit 8;
  `

  const games = await queryIGDB<IGDBGame>("games", body, clientId, accessToken)

  // Batch-fetch time-to-beat data for all results
  const ttbMap = await fetchTimeToBeat(
    games.map((g) => g.id),
    clientId,
    accessToken
  )

  return games.map((game) => ({
    igdbId: game.id,
    name: game.name,
    coverUrl: game.cover?.image_id
      ? getIGDBImageUrl(game.cover.image_id)
      : null,
    genres: mapIGDBGenres(game),
    estimatedSessionLength: estimateSessionLength(game),
    timeToBeatMinutes: ttbMap.get(game.id) ?? null,
    description: (game.summary || "").slice(0, 500),
  }))
}
