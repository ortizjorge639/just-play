// Where things sit in a 3D settlement, in metres. Pure, so it can be tested without WebGL.

// The approved deck, with its bridge, is about 19 m wide. Leave room between decks.
export const DECK_SPACING = 26
export const SLOT_RING_RADIUS = 3.4

export interface Point {
  x: number
  z: number
}

// Decks form a tree: deck 0 at the origin, each deck bridging to the one before it.
// Row n holds 2^n decks, centred on x = 0, so adding a deck never moves an earlier one.
export function deckOrigin(index: number): Point {
  const row = Math.floor(Math.log2(index + 1))
  const first = 2 ** row - 1
  const count = 2 ** row
  return { x: (index - first - (count - 1) / 2) * DECK_SPACING, z: row * DECK_SPACING }
}

export function slotOffset(slot: number, capacity: number): Point {
  const angle = (slot / capacity) * Math.PI * 2
  return { x: Math.cos(angle) * SLOT_RING_RADIUS, z: Math.sin(angle) * SLOT_RING_RADIUS }
}
