export type GameId = "mosslight" | "ember" | "paper" | "tide" | "orbit" | "rain"
// Retained save vocabulary: "playing" is the one invitation/replay; completions are permanent arrivals.
export type GameStatus = "backlog" | "playing" | "completed"
export type HomeId = "grove" | "plot"
export type SiteId = "plot" | "brook" | "crown" | "fern" | "dusk" | "meadow" | "sunrise"
export type LocationId = "plaza" | "trailhead" | "lodge" | "grove" | "lookout" | SiteId
export type CameraMode = "explore" | "overview" | "ambient" | "still"
export type WorldLight = "golden" | "night"
export type RenderQuality = "high" | "low"

export interface DemoGame {
  id: GameId
  title: string
  character: string
  color: string
  description: string
  memory: string
  symbol: string
}

export interface LegacyDemoState {
  version: 1
  revision: number
  games: Record<GameId, GameStatus>
  started: Partial<Record<GameId, string>>
  completions: Partial<Record<GameId, string>>
  homes: Partial<Record<GameId, HomeId>>
  notes: Partial<Record<GameId, string>>
  builtHouse: boolean
}

export interface MeritTier {
  id: string
  name: string
  milestone: string
  structural: boolean
}

export interface MilestoneRules {
  stamp: string
  tiers: MeritTier[]
}

export interface Confirmation {
  key: string
  milestone: string
  tier: string
  depth: number
  structural: boolean
  at: string
}

export interface Merit {
  depth: number
  structural: boolean
  history: Confirmation[]
}

export interface DemoState extends Omit<LegacyDemoState, "version"> {
  version: 2
  rules: { defaults: MilestoneRules; games: Partial<Record<GameId, MilestoneRules>> }
  merits: Partial<Record<GameId, Merit>>
  remnants: Partial<Record<GameId, string>>
  placements: Partial<Record<GameId, SiteId>>
  migratedFrom: 1 | null
}

export type DemoAction =
  | { type: "start"; gameId: GameId; at: string }
  | { type: "confirm"; gameId: GameId; target: string; at: string }
  | { type: "stop"; gameId: GameId; at: string }
  | { type: "delete-remnant"; gameId: GameId }
  | { type: "rules"; gameId: GameId | null; rules: MilestoneRules | null }
  | { type: "place"; gameId: GameId; site: SiteId }
  | { type: "move"; gameId: GameId; home: HomeId }
  | { type: "note"; gameId: GameId; text: string }

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface Resident {
  gameId: GameId
  kind: "resident"
  home: HomeId
}

export interface WorldLocation {
  id: LocationId
  title: string
  subtitle: string
  x: number
  y: number
  z: number
  radius: number
  arrival: [number, number, number]
}

export interface SceneSnapshot {
  player: { x: number; y: number; z: number; yaw: number }
  location: LocationId
  nearby: LocationId | "door" | "exit" | null
  inside: boolean
  residents: { gameId: GameId; x: number; z: number; activity: string }[]
}

export type SceneCommand =
  | { serial: number; type: "travel"; location: LocationId }
  | { serial: number; type: "recenter" }
  | { serial: number; type: "enter" }
  | { serial: number; type: "exit" }
  | { serial: number; type: "photo" }

export interface ScenePreferences {
  camera: CameraMode
  light: WorldLight
  quality: RenderQuality
  reducedMotion: boolean
}

export interface DemoSceneProps {
  world: DemoState
  preferences: ScenePreferences
  paused: boolean
  command: SceneCommand | null
  touch: { x: number; y: number }
  onSnapshot: (snapshot: SceneSnapshot) => void
  onInteract: (target: LocationId | "door" | "exit") => void
  onReady: () => void
  onError: (message: string) => void
  onPhoto: (blob: Blob) => void
}
