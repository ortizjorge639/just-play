import { partFor } from "./catalog"
import type { Deck, Layout, Placement, SettlementResident } from "./types"

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

export function layoutSettlement(residents: readonly SettlementResident[]): Layout {
  const ordered = [...residents].sort(byArrival)

  const placements: Placement[] = ordered.map((resident, index) => ({
    gameId: resident.game_id,
    partId: partFor(resident.game_id, resident.game?.genres).id,
    deck: Math.floor(index / DECK_CAPACITY),
    slot: index % DECK_CAPACITY,
  }))

  // The first deck always exists, so an empty settlement still has somewhere to start.
  const deckCount = Math.max(1, Math.ceil(ordered.length / DECK_CAPACITY))
  const decks: Deck[] = Array.from({ length: deckCount }, (_, index) => ({
    index,
    // Each deck bridges to an earlier one and can carry up to two more.
    parent: index === 0 ? null : Math.floor((index - 1) / 2),
    residents: Math.min(DECK_CAPACITY, Math.max(0, ordered.length - index * DECK_CAPACITY)),
  }))

  return { version: LAYOUT_VERSION, decks, placements }
}
