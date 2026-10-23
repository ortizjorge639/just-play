import type { Part, PartFamily } from "./types"

export const PARTS: readonly Part[] = [
  { id: "cozy-plant", family: "cozy", depth: "trinket", asset: null },
  { id: "cozy-lantern", family: "cozy", depth: "trinket", asset: "/canopy/ember-small-38963249.glb" },
  { id: "fantasy-chest", family: "fantasy", depth: "trinket", asset: null },
  { id: "fantasy-banner", family: "fantasy", depth: "trinket", asset: null },
  { id: "puzzle-lamp", family: "puzzle", depth: "trinket", asset: null },
  { id: "puzzle-board", family: "puzzle", depth: "trinket", asset: null },
  { id: "action-trophy", family: "action", depth: "trinket", asset: null },
  { id: "action-poster", family: "action", depth: "trinket", asset: null },
  { id: "other-frame", family: "other", depth: "trinket", asset: null },
  { id: "other-shelf", family: "other", depth: "trinket", asset: null },
]

// First matching genre wins, checked in the order the game lists them.
// Genre names come from IGDB and Steam and are uneven, so match on fragments.
const FAMILY_FRAGMENTS: ReadonlyArray<readonly [PartFamily, readonly string[]]> = [
  ["cozy", ["simulat", "casual", "farming", "life", "family"]],
  ["fantasy", ["rpg", "role-playing", "adventure", "fantasy"]],
  ["puzzle", ["puzzle", "point-and-click", "visual novel", "card", "board", "strategy"]],
  ["action", ["action", "shooter", "fighting", "platform", "racing", "sport", "hack"]],
]

export function familyForGenres(genres: readonly string[] | null | undefined): PartFamily {
  for (const genre of genres ?? []) {
    const name = genre.toLowerCase()
    for (const [family, fragments] of FAMILY_FRAGMENTS) {
      if (fragments.some(fragment => name.includes(fragment))) return family
    }
  }
  return "other"
}

function hash(text: string): number {
  let value = 0
  for (const ch of text) value = (value * 31 + ch.charCodeAt(0)) >>> 0
  return value
}

// The same game always gets the same part, for every player. No stored rows.
export function partFor(gameId: string, genres: readonly string[] | null | undefined): Part {
  const family = familyForGenres(genres)
  const options = PARTS.filter(part => part.family === family)
  return options[hash(gameId) % options.length]
}
