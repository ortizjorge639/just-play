import { DECK_CAPACITY } from "./layout"
import type { Layout, SavedSpot } from "./types"

// Every home with its spot, ready to save. Saving the full list is what pins an automatic layout.
export function toSpots(layout: Layout): SavedSpot[] {
  return layout.placements.map((p) => ({ game_id: p.gameId, deck: p.deck, cell: p.slot, rotation: p.rotation }))
}

// Decks are numbered 0, 1, 2 with none empty, so a deck that lost its last home closes up.
export function compactDecks(spots: readonly SavedSpot[]): SavedSpot[] {
  const used = [...new Set(spots.map((s) => s.deck))].sort((a, b) => a - b)
  const renumber = new Map(used.map((deck, index) => [deck, index]))
  return spots.map((s) => ({ ...s, deck: renumber.get(s.deck) ?? s.deck }))
}

// Moves a home to a spot. If another home is there, the two swap. Cells outside a deck's
// automatic spots are refused until the scene can draw them.
export function moveHome(spots: readonly SavedSpot[], gameId: string, deck: number, cell: number): SavedSpot[] {
  const mover = spots.find((s) => s.game_id === gameId)
  if (!mover || deck < 0 || cell < 0 || cell >= DECK_CAPACITY) return [...spots]
  if (mover.deck === deck && mover.cell === cell) return [...spots]
  const occupant = spots.find((s) => s.deck === deck && s.cell === cell)
  const next = spots.map((s) => {
    if (s.game_id === gameId) return { ...s, deck, cell }
    if (occupant && s.game_id === occupant.game_id) return { ...s, deck: mover.deck, cell: mover.cell }
    return s
  })
  return compactDecks(next)
}

export function sameSpots(a: readonly SavedSpot[], b: readonly SavedSpot[]): boolean {
  if (a.length !== b.length) return false
  const key = (s: SavedSpot) => `${s.game_id}:${s.deck}:${s.cell}:${s.rotation}`
  const set = new Set(a.map(key))
  return b.every((s) => set.has(key(s)))
}
