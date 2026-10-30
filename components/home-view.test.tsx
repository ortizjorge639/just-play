import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { Game, Postcard, Resident } from "@/lib/types"
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

function renderHome(residents: Resident[], postcards: Postcard[] = []) {
  return renderToStaticMarkup(
    <HomeView
      displayName="Player"
      residents={residents}
      postcards={postcards}
      invitedGame={null}
    />,
  )
}

test("Home shows game artwork and orders every resident by original arrival", () => {
  const html = renderHome([
    resident("older", "Quiet Harbor", "2026-09-04T12:00:00.000Z"),
    resident("later-set-aside", "Mosslight", "2026-10-12T12:00:00.000Z"),
  ])
  const timeline = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"))

  assert.match(html, /The games you made room for\./)
  assert.doesNotMatch(html, /Your home, with the world close by/)
  assert.doesNotMatch(html, /Player(?:&#x27;|&#39;|')s home/)
  assert.doesNotMatch(html, /\b\d+ residents?\b/)
  assert.match(html, /url=%2Fimages%2Folder\.jpg/)
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

  assert.match(html, /No residents yet\. There is no rush\./)
  assert.doesNotMatch(html, /Arrivals/)
  assert.doesNotMatch(html, /<ol/)
})
