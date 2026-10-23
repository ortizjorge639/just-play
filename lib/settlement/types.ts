export type PartFamily = "cozy" | "fantasy" | "puzzle" | "action" | "other"

// Only trinkets exist today. Rooms and decks arrive with merit tiers.
export type PartDepth = "trinket"

export interface Part {
  id: string
  family: PartFamily
  depth: PartDepth
  // Null until art exists. Renderers draw a stand-in for a part with no asset.
  asset: string | null
  // Only residents who arrived at or after this time can be given the part. New parts are
  // appended with a later date, so existing homes keep the part they already have.
  availableFrom?: string
}

// The few fields the layout needs. A Resident from lib/types fits as is.
export interface SettlementResident {
  game_id: string
  arrived_at: string
  game?: { genres?: string[] | null } | null
}

export interface Placement {
  gameId: string
  partId: string
  deck: number
  slot: number
}

export interface Deck {
  index: number
  // The deck this one is bridged to. Null for the first deck.
  parent: number | null
  residents: number
}

export interface Layout {
  version: number
  decks: Deck[]
  placements: Placement[]
}

// What a view needs: the layout and a way to pick a resident.
export interface SettlementViewProps {
  layout: Layout
  onSelectResident?: (gameId: string) => void
}
