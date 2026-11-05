import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { CompletedGame, Game, Postcard, Resident } from "@/lib/types"
import { HomeView } from "./home-view"

function game(id: string, name: string): Game {
  return {
    id,
    name,
    genres: [],
    estimated_session_length: 60,
    header_image: `/images/${id}.jpg`,
    description: "",
    featured: false,
    source: "test",
    created_at: "2026-01-01T00:00:00.000Z",
  }
}

function resident(id: string, name: string, arrivedAt: string): Resident {
  return {
    user_id: "player",
    game_id: id,
    arrived_at: arrivedAt,
    arrival_source: "stamp",
    game: game(id, name),
  }
}

function completedGame(id: string, name: string, completedAt: string): CompletedGame {
  return {
    id: `progress-${id}`,
    user_id: "player",
    game_id: id,
    status: "beaten",
    total_sessions: 3,
    total_time_minutes: 120,
    started_at: "2026-01-01T00:00:00.000Z",
    completed_at: completedAt,
    created_at: "2026-01-01T00:00:00.000Z",
    game: game(id, name),
  }
}

function renderHome(
  residents: Resident[],
  postcards: Postcard[] = [],
  completedGames: CompletedGame[] = [],
) {
  return renderToStaticMarkup(
    <HomeView
      residents={residents}
      completedGames={completedGames}
      postcards={postcards}
      invitedGame={null}
    />,
  )
}

test("Home shows completed games and orders arrivals by original arrival", () => {
  const html = renderHome([
    resident("older", "Quiet Harbor", "2026-09-04T12:00:00.000Z"),
    resident("later-set-aside", "Mosslight", "2026-10-12T12:00:00.000Z"),
  ], [], [
    completedGame("older", "Quiet Harbor", "2026-09-04T12:00:00.000Z"),
    completedGame("later-set-aside", "Mosslight", "2026-10-12T12:00:00.000Z"),
  ])
  const timeline = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"))

  assert.match(html, /Completed games/)
  assert.match(html, /\(2\)/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, />See all<\/button>/)
  assert.doesNotMatch(html, /Your home, with the world close by/)
  assert.doesNotMatch(html, /Player(?:&#x27;|&#39;|')s home/)
  assert.doesNotMatch(html, /\b\d+ residents?\b/)
  assert.doesNotMatch(html, /Explore your world|Expand world|settlement/)
  assert.match(html, /aria-label="Completed game cards"/)
  assert.match(html, /aria-roledescription="carousel"/)
  assert.match(html, /aspect-\[4\/3\]/)
  assert.match(html, /url=%2Fimages%2Flater-set-aside\.jpg/)
  assert.ok(html.indexOf("Mosslight") < html.indexOf("Quiet Harbor"))
  assert.match(html, /Completed/)
  assert.match(html, /Arrived/)
  assert.ok(timeline.indexOf("Mosslight") < timeline.indexOf("Quiet Harbor"))
  assert.match(timeline, /October 12, 2026/)
  assert.match(timeline, /September 4, 2026/)
})

test("a postcard without a resident stays out of the arrival timeline", () => {
  const postcard: Postcard = {
    user_id: "player",
    game_id: "postcard",
    created_at: "2026-10-20T12:00:00.000Z",
    game: game("postcard", "A Keepsake"),
  }
  const html = renderHome([resident("arrived", "Lanternfall", "2026-10-12T12:00:00.000Z")], [postcard])
  const timeline = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"))

  assert.match(timeline, /Lanternfall/)
  assert.doesNotMatch(timeline, /A Keepsake/)
  assert.match(html, /Keepsakes \(1\)/)
})

test("Home has a calm empty state without an arrival timeline", () => {
  const html = renderHome([])

  assert.match(html, /No completed games yet\./)
  assert.match(html, /\(0\)/)
  assert.doesNotMatch(html, />See all<\/button>/)
  assert.doesNotMatch(html, /Arrivals/)
  assert.doesNotMatch(html, /<ol/)
})
