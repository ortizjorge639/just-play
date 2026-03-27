/**
 * Seed script: Fetches popular games from IGDB and generates a SQL migration file.
 *
 * Usage:
 *   pnpm seed:igdb
 *
 * Requires IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in .env.local
 */

import * as fs from "fs"
import * as path from "path"
import * as dotenv from "dotenv"
import {
  getIGDBToken,
  queryIGDB,
  mapIGDBGenres,
  estimateSessionLength,
  fetchTimeToBeat,
  getIGDBImageUrl,
  escapeSQL,
  type IGDBGame,
} from "../lib/igdb"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const RATE_LIMIT_MS = 260 // ~4 req/sec IGDB limit
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const clientId = process.env.IGDB_CLIENT_ID?.trim()
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    console.error(
      "❌ Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET in .env.local"
    )
    process.exit(1)
  }

  console.log("🔑 Authenticating with IGDB (Twitch OAuth)...")
  const token = await getIGDBToken(clientId, clientSecret)
  console.log("✅ Authenticated\n")

  const q = (body: string) =>
    queryIGDB<IGDBGame>("games", body, clientId, token.access_token)

  const gameFields = `fields name, genres.id, genres.name, themes.id, themes.name,
    keywords.id, keywords.name, cover.image_id, summary,
    rating, total_rating, total_rating_count, category;`

  // ── Keyword IDs ────────────────────────────────────────────────────
  // Look up IGDB keyword IDs for genres the scoring engine cares about
  console.log("🔍 Looking up keyword IDs for roguelike, metroidvania, farming, cozy...")
  const keywordResults = await queryIGDB<{ id: number; name: string }>(
    "keywords",
    `fields id, name; where name ~ *"roguelike"* | name ~ *"roguelite"* | name ~ *"metroidvania"* | name ~ *"farming"* | name ~ *"cozy"*; limit 20;`,
    clientId,
    token.access_token
  )
  await sleep(RATE_LIMIT_MS)

  const keywordIds: Record<string, number[]> = {
    roguelike: [],
    metroidvania: [],
    farming: [],
    cozy: [],
  }
  for (const kw of keywordResults) {
    const lower = kw.name.toLowerCase()
    if (lower.includes("roguelike") || lower.includes("roguelite"))
      keywordIds.roguelike.push(kw.id)
    if (lower.includes("metroidvania")) keywordIds.metroidvania.push(kw.id)
    if (lower.includes("farming")) keywordIds.farming.push(kw.id)
    if (lower.includes("cozy")) keywordIds.cozy.push(kw.id)
  }
  console.log(
    `   Found keyword IDs: ${JSON.stringify(keywordIds, null, 0)}\n`
  )

  // ── Game Queries ───────────────────────────────────────────────────
  // Fetch popular games across multiple categories for broad coverage
  const queries: { label: string; body: string }[] = [
    {
      label: "Top rated games (broad)",
      body: `${gameFields}
        where total_rating > 80 & total_rating_count > 50 & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 50;`,
    },
    {
      label: "Popular indie games",
      body: `${gameFields}
        where total_rating > 75 & total_rating_count > 20 & genres = (32) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 25;`,
    },
    {
      label: "Strategy & 4X games",
      body: `${gameFields}
        where total_rating > 70 & total_rating_count > 15 & genres = (15,16) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 20;`,
    },
    {
      label: "Platformers",
      body: `${gameFields}
        where total_rating > 70 & total_rating_count > 15 & genres = (8) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 20;`,
    },
    {
      label: "Simulators",
      body: `${gameFields}
        where total_rating > 70 & total_rating_count > 15 & genres = (13) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 20;`,
    },
    {
      label: "Card & Board games",
      body: `${gameFields}
        where total_rating > 65 & total_rating_count > 10 & genres = (35) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 15;`,
    },
    {
      label: "Action / Hack-n-slash",
      body: `${gameFields}
        where total_rating > 75 & total_rating_count > 20 & genres = (25) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 20;`,
    },
    {
      label: "RPGs",
      body: `${gameFields}
        where total_rating > 75 & total_rating_count > 20 & genres = (12) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 20;`,
    },
  ]

  // Add keyword-based queries for roguelikes, metroidvanias, farming games
  if (keywordIds.roguelike.length > 0) {
    queries.push({
      label: "Roguelikes (by keyword)",
      body: `${gameFields}
        where total_rating > 65 & total_rating_count > 10 & keywords = (${keywordIds.roguelike.join(",")}) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 20;`,
    })
  }
  if (keywordIds.metroidvania.length > 0) {
    queries.push({
      label: "Metroidvanias (by keyword)",
      body: `${gameFields}
        where total_rating > 65 & total_rating_count > 10 & keywords = (${keywordIds.metroidvania.join(",")}) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 20;`,
    })
  }
  if (keywordIds.farming.length > 0) {
    queries.push({
      label: "Farming / Cozy games (by keyword)",
      body: `${gameFields}
        where total_rating > 60 & total_rating_count > 5 & keywords = (${[...keywordIds.farming, ...keywordIds.cozy].join(",")}) & cover != null & version_parent = null & parent_game = null;
        sort total_rating desc; limit 15;`,
    })
  }

  // ── Fetch All ──────────────────────────────────────────────────────
  const allGames = new Map<number, IGDBGame>()

  for (const { label, body } of queries) {
    console.log(`🎮 Fetching: ${label}...`)
    try {
      const games = await q(body)
      let added = 0
      for (const game of games) {
        if (!allGames.has(game.id)) {
          allGames.set(game.id, game)
          added++
        }
      }
      console.log(`   → ${games.length} results, ${added} new (${allGames.size} total)`)
    } catch (err) {
      console.error(`   ⚠ Failed: ${err}`)
    }
    await sleep(RATE_LIMIT_MS)
  }

  console.log(`\n📦 Total unique games: ${allGames.size}`)

  // ── Fetch Time-to-Beat Data ─────────────────────────────────────────
  console.log("⏱ Fetching time-to-beat data from IGDB...")
  const gameIds = Array.from(allGames.keys())
  const ttbMap = new Map<number, number>()

  // Batch in chunks of 500 (IGDB limit)
  for (let i = 0; i < gameIds.length; i += 500) {
    const chunk = gameIds.slice(i, i + 500)
    const chunkResult = await fetchTimeToBeat(chunk, clientId, token.access_token)
    for (const [id, mins] of chunkResult) {
      ttbMap.set(id, mins)
    }
    await sleep(RATE_LIMIT_MS)
  }
  console.log(`   → Found time-to-beat data for ${ttbMap.size} / ${allGames.size} games`)

  // ── Generate SQL ───────────────────────────────────────────────────
  const sqlLines: string[] = [
    "-- IGDB game catalog — auto-generated by scripts/seed-igdb.ts",
    `-- Generated: ${new Date().toISOString()}`,
    `-- Total games: COUNT_PLACEHOLDER`,
    "",
  ]

  let validCount = 0

  for (const game of allGames.values()) {
    const genres = mapIGDBGenres(game)
    const imageId = game.cover?.image_id

    // Skip games with no usable genres or no cover art
    if (genres.length === 0 || !imageId) continue

    const id = `igdb-${game.id}`
    const name = escapeSQL(game.name)
    const genresArray = genres.map((g) => `'${g}'`).join(",")
    const sessionLength = estimateSessionLength(game)
    const ttb = ttbMap.get(game.id)
    const imageUrl = getIGDBImageUrl(imageId)
    const description = escapeSQL((game.summary || "").slice(0, 500))

    sqlLines.push(
      `INSERT INTO public.games (id, name, genres, estimated_session_length, time_to_beat_minutes, header_image, description, source)` +
        ` VALUES ('${id}', '${name}', ARRAY[${genresArray}], ${sessionLength}, ${ttb ?? "NULL"}, '${imageUrl}', '${description}', 'igdb')` +
        ` ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, genres = EXCLUDED.genres,` +
        ` estimated_session_length = EXCLUDED.estimated_session_length, time_to_beat_minutes = EXCLUDED.time_to_beat_minutes,` +
        ` header_image = EXCLUDED.header_image, description = EXCLUDED.description;`
    )
    validCount++
  }

  // Replace placeholder with actual count
  sqlLines[2] = `-- Total games: ${validCount}`

  const outputPath = path.join(__dirname, "011_seed_igdb_games.sql")
  fs.writeFileSync(outputPath, sqlLines.join("\n") + "\n")

  console.log(`\n✅ Generated ${outputPath}`)
  console.log(`   ${validCount} games ready to insert`)
  console.log(
    `\n💡 Run this SQL in your Supabase SQL Editor (after running 010_add_igdb_source.sql)`
  )
}

main().catch((err) => {
  console.error("❌ Fatal error:", err)
  process.exit(1)
})
