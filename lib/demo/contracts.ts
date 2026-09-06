export type GameId = "mosslight" | "ember" | "paper" | "tide" | "orbit" | "rain"
export type GameStatus = "backlog" | "playing" | "completed"
export type HomeId = "grove" | "plot"
export type LocationId = "plaza" | "trailhead" | "lodge" | "grove" | "lookout" | "plot"
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

export interface DemoState {
  version: 1
  revision: number
  games: Record<GameId, GameStatus>
  started: Partial<Record<GameId, string>>
  completions: Partial<Record<GameId, string>>
  homes: Partial<Record<GameId, HomeId>>
  notes: Partial<Record<GameId, string>>
  builtHouse: boolean
}

export type DemoAction =
  | { type: "start"; gameId: GameId; at: string }
  | { type: "complete"; gameId: GameId; at: string }
  | { type: "build" }
  | { type: "move"; gameId: GameId; home: HomeId }
  | { type: "note"; gameId: GameId; text: string }

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface Resident {
  gameId: GameId
  kind: "visitor" | "resident"
  home: "lodge" | HomeId
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
