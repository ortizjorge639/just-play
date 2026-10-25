import { partFor } from "./catalog"
import { tierFor } from "./tiers"
import type { Deck, Layout, Placement, SavedSpot, SettlementResident } from "./types"

// Bump this if a rule below changes, so old and new layouts can be told apart.
export const LAYOUT_VERSION = 1

export const DECK_CAPACITY = 6

// Residents are ordered by arrival, then game id. Rows are only ever added, and arrived_at is set
// by the database when a game is beaten. Anything that imports residents must not backdate
// arrived_at, or it would move people who already have a home.
function byArrival(a: SettlementResident, b: SettlementResident): number {
  const timeA = Date.parse(a.arrived_at)
  const timeB = Date.parse(b.arrived_at)
  if (timeA !== timeB) return timeA - timeB
  return a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : 0
}

// Cells on a deck's grid, 6 by 6. Automatic spots use the first DECK_CAPACITY of them.
export const GRID_SIZE = 6
export const GRID_CELLS = GRID_SIZE * GRID_SIZE

// A saved spot wins over the automatic one. A resident without one takes the first free
// automatic cell, so a new arrival never displaces a home the player placed.
export function layoutSettlement(
  residents: readonly SettlementResident[],
  saved: readonly SavedSpot[] = [],
): Layout {
  const ordered = [...residents].sort(byArrival)
  const spotByGame = new Map<string, SavedSpot>()
  const taken = new Set<string>()
  const known = new Set(ordered.map((r) => r.game_id))
  for (const spot of saved) {
    const key = `${spot.deck}:${spot.cell}`
    if (taken.has(key) || spotByGame.has(spot.game_id)) continue
    if (!known.has(spot.game_id)) continue
    if (spot.deck < 0 || spot.cell < 0 || spot.cell >= GRID_CELLS) continue
    spotByGame.set(spot.game_id, spot)
    taken.add(key)
  }

  // Every cell before the cursor is taken, so the scan for a free cell only moves forward.
  let cursorDeck = 0
  let cursorCell = 0
  const placements: Placement[] = ordered.map((resident) => {
    let deck = 0
    let cell = 0
    let rotation = 0
    const spot = spotByGame.get(resident.game_id)
    if (spot) {
      deck = spot.deck
      cell = spot.cell
      rotation = spot.rotation
    } else {
      while (taken.has(`${cursorDeck}:${cursorCell}`)) {
        cursorCell += 1
        if (cursorCell >= DECK_CAPACITY) {
          cursorDeck += 1
          cursorCell = 0
        }
      }
      deck = cursorDeck
      cell = cursorCell
      taken.add(`${deck}:${cell}`)
    }
    return {
      gameId: resident.game_id,
      partId: partFor(resident.game_id, resident.game?.genres, resident.arrived_at).id,
      deck,
      slot: cell,
      rotation,
      tier: tierFor(resident.minutes_played),
    }
  })

  // The first deck always exists, so an empty settlement still has somewhere to start.
  const deckCount = placements.reduce((n, p) => Math.max(n, p.deck + 1), 1)
  const perDeck = new Array<number>(deckCount).fill(0)
  for (const p of placements) perDeck[p.deck] += 1
  const decks: Deck[] = Array.from({ length: deckCount }, (_, index) => ({
    index,
    // Each deck bridges to an earlier one and can carry up to two more.
    parent: index === 0 ? null : Math.floor((index - 1) / 2),
    residents: perDeck[index],
  }))

  return { version: LAYOUT_VERSION, decks, placements }
}
