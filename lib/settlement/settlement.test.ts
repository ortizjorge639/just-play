import assert from "node:assert/strict"
import { test } from "node:test"
import { PARTS, familyForGenres, partFor } from "./catalog"
import { DECK_CAPACITY, LAYOUT_VERSION, layoutSettlement } from "./layout"
import { deckOrigin, slotOffset, DECK_SPACING, SLOT_RING_RADIUS } from "./transforms"
import type { SettlementResident } from "./types"

function resident(n: number, genres: string[] = []): SettlementResident {
  return {
    game_id: `game-${String(n).padStart(5, "0")}`,
    arrived_at: new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString(),
    game: { genres },
  }
}
const many = (count: number) => Array.from({ length: count }, (_, i) => resident(i))

test("genres map to a family, first match wins, and the unknown go to other", () => {
  assert.equal(familyForGenres(["Simulator"]), "cozy")
  assert.equal(familyForGenres(["Role-playing (RPG)", "Indie"]), "fantasy")
  assert.equal(familyForGenres(["Indie", "Puzzle"]), "puzzle")
  assert.equal(familyForGenres(["Shooter"]), "action")
  assert.equal(familyForGenres(["Something new"]), "other")
  assert.equal(familyForGenres([]), "other")
  assert.equal(familyForGenres(null), "other")
  assert.equal(familyForGenres(undefined), "other")
})

test("the same game always gets the same part, and it matches its family", () => {
  for (const genres of [["Puzzle"], ["Simulator"], [], undefined]) {
    const first = partFor("game-x", genres)
    for (let i = 0; i < 20; i++) assert.equal(partFor("game-x", genres).id, first.id)
    assert.equal(first.family, familyForGenres(genres))
  }
})

test("every family has at least one part, so a pick can never be empty", () => {
  for (const family of ["cozy", "fantasy", "puzzle", "action", "other"] as const) {
    assert.ok(PARTS.some(part => part.family === family), family)
  }
  assert.equal(new Set(PARTS.map(part => part.id)).size, PARTS.length)
})

test("an empty settlement still has a first deck", () => {
  const layout = layoutSettlement([])
  assert.equal(layout.version, LAYOUT_VERSION)
  assert.deepEqual(layout.decks, [{ index: 0, parent: null, residents: 0 }])
  assert.deepEqual(layout.placements, [])
})

test("a deck fills at its capacity, then the next one opens", () => {
  const full = layoutSettlement(many(DECK_CAPACITY))
  assert.equal(full.decks.length, 1)
  assert.equal(full.decks[0].residents, DECK_CAPACITY)
  const spill = layoutSettlement(many(DECK_CAPACITY + 1))
  assert.equal(spill.decks.length, 2)
  assert.deepEqual(spill.decks[1], { index: 1, parent: 0, residents: 1 })
  assert.deepEqual(spill.placements[DECK_CAPACITY], {
    gameId: "game-00006", partId: spill.placements[DECK_CAPACITY].partId, deck: 1, slot: 0,
  })
})

test("a new arrival never moves anyone who already has a home", () => {
  const all = many(40)
  for (let k = 0; k < all.length; k++) {
    const before = layoutSettlement(all.slice(0, k)).placements
    const after = layoutSettlement(all.slice(0, k + 1)).placements
    assert.deepEqual(after.slice(0, k), before, `after adding resident ${k}`)
  }
})

test("input order does not matter, and equal arrival times break ties by game id", () => {
  const sameMoment = "2026-03-03T10:00:00.000Z"
  const list: SettlementResident[] = ["c", "a", "b"].map(id => ({ game_id: id, arrived_at: sameMoment }))
  const forward = layoutSettlement(list).placements.map(p => p.gameId)
  const backward = layoutSettlement([...list].reverse()).placements.map(p => p.gameId)
  assert.deepEqual(forward, ["a", "b", "c"])
  assert.deepEqual(backward, forward)
})

test("no two residents share a spot, at any size", () => {
  for (const count of [0, 1, 6, 7, 50, 500, 5000]) {
    const layout = layoutSettlement(many(count))
    const spots = new Set(layout.placements.map(p => `${p.deck}:${p.slot}`))
    assert.equal(layout.placements.length, count)
    assert.equal(spots.size, count)
    assert.equal(layout.decks.length, Math.max(1, Math.ceil(count / DECK_CAPACITY)))
    assert.equal(layout.decks.reduce((sum, d) => sum + d.residents, 0), count)
    for (const p of layout.placements) assert.ok(p.slot >= 0 && p.slot < DECK_CAPACITY)
  }
})

test("every deck after the first is bridged to an earlier one", () => {
  const { decks } = layoutSettlement(many(200))
  assert.equal(decks[0].parent, null)
  for (const deck of decks.slice(1)) {
    assert.ok(deck.parent !== null && deck.parent < deck.index)
  }
  for (const deck of decks) {
    assert.ok(decks.filter(d => d.parent === deck.index).length <= 2)
  }
})

test("5000 residents lay out quickly", () => {
  const list = many(5000)
  const start = performance.now()
  layoutSettlement(list)
  assert.ok(performance.now() - start < 250)
})

test("a resident whose game has no genre data still gets a part", () => {
  const layout = layoutSettlement([{ game_id: "g", arrived_at: "2026-01-01T00:00:00Z", game: null }])
  assert.equal(PARTS.find(p => p.id === layout.placements[0].partId)?.family, "other")
})

test("deck 0 sits at the origin", () => {
  assert.deepEqual(deckOrigin(0), { x: 0, z: 0 })
})

test("every deck has its own spot, at least one spacing from the others", () => {
  const origins = Array.from({ length: 63 }, (_, i) => deckOrigin(i))
  for (let i = 0; i < origins.length; i++) {
    for (let j = i + 1; j < origins.length; j++) {
      const gap = Math.hypot(origins[i].x - origins[j].x, origins[i].z - origins[j].z)
      assert.ok(gap >= DECK_SPACING - 1e-9)
    }
  }
})

test("slots sit evenly on one ring", () => {
  const points = Array.from({ length: DECK_CAPACITY }, (_, slot) => slotOffset(slot, DECK_CAPACITY))
  for (const p of points) assert.ok(Math.abs(Math.hypot(p.x, p.z) - SLOT_RING_RADIUS) < 1e-9)
  assert.equal(new Set(points.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size, DECK_CAPACITY)
})
