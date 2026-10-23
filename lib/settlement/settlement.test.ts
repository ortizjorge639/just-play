import assert from "node:assert/strict"
import { test } from "node:test"
import { PARTS, familyForGenres, partFor } from "./catalog"
import { readFileSync } from "node:fs"
import { TIERS, tierFor } from "./tiers"
import { DECK_CAPACITY, LAYOUT_VERSION, layoutSettlement } from "./layout"
import { anchorOffset, ANCHORS_PER_DECK, ANCHOR_RADIUS, deckOrigin, slotOffset, DECK_SPACING, SLOT_RING_RADIUS } from "./transforms"
import type { Part, SettlementResident } from "./types"

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
    gameId: "game-00006", partId: spill.placements[DECK_CAPACITY].partId, deck: 1, slot: 0, tier: 0,
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

test("adding a part later never changes the part of a home that already exists", () => {
  const before = PARTS
  const grown: Part[] = [
    ...before,
    { id: "cozy-kettle", family: "cozy", depth: "trinket", asset: null, availableFrom: "2027-01-01T00:00:00Z" },
    { id: "cozy-quilt", family: "cozy", depth: "trinket", asset: null, availableFrom: "2027-06-01T00:00:00Z" },
  ]
  const early = "2026-03-01T00:00:00Z"
  for (let n = 0; n < 200; n++) {
    const id = `game-${n}`
    assert.equal(partFor(id, ["Simulator"], early, grown).id, partFor(id, ["Simulator"], early, before).id)
  }
})

test("residents arriving after a part is added can be given it", () => {
  const grown: Part[] = [
    ...PARTS,
    { id: "cozy-kettle", family: "cozy", depth: "trinket", asset: null, availableFrom: "2027-01-01T00:00:00Z" },
  ]
  const picked = new Set(
    Array.from({ length: 200 }, (_, n) => partFor(`game-${n}`, ["Simulator"], "2027-02-01T00:00:00Z", grown).id),
  )
  assert.ok(picked.has("cozy-kettle"))
})

test("tiers change at exact boundaries and never go below zero", () => {
  assert.equal(tierFor(0), 0)
  assert.equal(tierFor(119), 0)
  assert.equal(tierFor(120), 1)
  assert.equal(tierFor(599), 1)
  assert.equal(tierFor(600), 2)
  assert.equal(tierFor(2999), 2)
  assert.equal(tierFor(3000), 3)
  assert.equal(tierFor(1e9), 3)
  assert.equal(tierFor(-5), 0)
  assert.equal(tierFor(null), 0)
  assert.equal(tierFor(undefined), 0)
  assert.equal(tierFor(Number.NaN), 0)
})

test("tier is carried on placements and never moves anyone", () => {
  const base = many(8)
  const plain = layoutSettlement(base).placements
  const played = layoutSettlement(base.map((r, i) => ({ ...r, minutes_played: i * 700 }))).placements
  assert.deepEqual(played.map(({ tier: _t, ...p }) => p), plain.map(({ tier: _t, ...p }) => p))
  assert.deepEqual(played.map((p) => p.tier), [0, 2, 2, 2, 2, 3, 3, 3])
})

test("rim spots are distinct, outside the home ring and inside the deck", () => {
  const spots = Array.from({ length: ANCHORS_PER_DECK }, (_, a) => anchorOffset(a))
  assert.equal(new Set(spots.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size, ANCHORS_PER_DECK)
  for (const p of spots) {
    assert.ok(Math.abs(Math.hypot(p.x, p.z) - ANCHOR_RADIUS) < 1e-9)
    assert.ok(ANCHOR_RADIUS > SLOT_RING_RADIUS + 1 && ANCHOR_RADIUS < 6)
  }
})

test("migration 029 uses the same Elder threshold, deck size and spot count as the code", () => {
  const sql = readFileSync(new URL("../../scripts/029_settlement_pieces.sql", import.meta.url), "utf8")
  const elder = TIERS[TIERS.length - 1].minutes
  assert.ok(sql.includes(`< ${elder} THEN`), "Elder minutes differ from SQL")
  assert.ok(sql.includes(`(residents_count + ${DECK_CAPACITY - 1}) / ${DECK_CAPACITY}`), "deck size differs from SQL")
  assert.ok(sql.includes(`p_anchor > ${ANCHORS_PER_DECK - 1}`), "spot count differs from SQL")
})
