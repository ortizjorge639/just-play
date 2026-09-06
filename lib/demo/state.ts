import type {
  DemoAction, DemoGame, DemoState, GameId, GameStatus, HomeId, Resident, Result,
} from "./contracts"

export const SAVE_KEY = "just-play-canopy-demo-v1"

export const GAMES: readonly DemoGame[] = Object.freeze(([
  {
    id: "mosslight", title: "Mosslight Valley", character: "Pip", color: "#8CAB73",
    description: "Tend a tiny lantern garden in a valley that wakes after sunset.",
    memory: "You left a little light for the next traveler.",
    symbol: "✿",
  },
  {
    id: "ember", title: "The Last Ember", character: "Sol", color: "#D58A6F",
    description: "Carry a warm ember across a sleeping mountain, one small step at a time.",
    memory: "The fire was small. The journey was not.",
    symbol: "✦",
  },
  {
    id: "paper", title: "Paper Skies", character: "Wren", color: "#8DB9CC",
    description: "Fold a paper glider and deliver letters between drifting islands.",
    memory: "Some letters take the scenic route.",
    symbol: "◇",
  },
  {
    id: "tide", title: "Tidebound", character: "Nori", color: "#70A99B",
    description: "Chart a quiet archipelago and listen to what the tide brings home.",
    memory: "Every shore had a story worth hearing.",
    symbol: "≈",
  },
  {
    id: "orbit", title: "Little Orbit", character: "Io", color: "#AAA0CC",
    description: "Help a pocket-sized observatory find its place among the stars.",
    memory: "A small world still has room for wonder.",
    symbol: "☾",
  },
  {
    id: "rain", title: "After the Rain", character: "Rue", color: "#E4C16F",
    description: "Follow the puddles through a neighborhood learning to bloom again.",
    memory: "You noticed the flowers on the way home.",
    symbol: "☀",
  },
] satisfies DemoGame[]).map(game => Object.freeze(game)))

export const GAME_BY_ID: Record<GameId, DemoGame> = Object.freeze(
  Object.fromEntries(GAMES.map(game => [game.id, game])),
) as Record<GameId, DemoGame>

const STATE_KEYS = ["version", "revision", "games", "started", "completions", "homes", "notes", "builtHouse"]
const ACTION_KEYS = {
  start: ["type", "gameId", "at"],
  complete: ["type", "gameId", "at"],
  build: ["type"],
  move: ["type", "gameId", "home"],
  note: ["type", "gameId", "text"],
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}

function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GAME_BY_ID, value)
}

function isStatus(value: unknown): value is GameStatus {
  return value === "backlog" || value === "playing" || value === "completed"
}

function isHome(value: unknown): value is HomeId {
  return value === "grove" || value === "plot"
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value)
  if (!match) return false
  const time = Date.parse(value)
  return Number.isFinite(time) &&
    new Date(time).toISOString() === `${match[1]}.${(match[2] ?? "").padEnd(3, "0")}Z`
}

function isGameMap<T>(
  value: unknown,
  accepts: (entry: unknown) => entry is T,
): value is Partial<Record<GameId, T>> {
  return isRecord(value) &&
    Object.entries(value).every(([key, entry]) => isGameId(key) && accepts(entry))
}

function isCompleteGameMap<T>(
  value: unknown,
  accepts: (entry: unknown) => entry is T,
): value is Record<GameId, T> {
  return isGameMap(value, accepts) && GAMES.every(({ id }) => Object.hasOwn(value, id))
}

function failure(error: string): Result<never> {
  return { ok: false, error }
}

function validateState(value: unknown): Result<DemoState> {
  if (!isRecord(value)) return failure("This save must contain a demo world object.")
  if (value.version !== 1) return failure("This save uses an unsupported demo version.")
  if (!hasKeys(value, STATE_KEYS)) return failure("This save has missing or unknown fields.")
  if (typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 0) {
    return failure("This save has an invalid revision.")
  }
  if (typeof value.builtHouse !== "boolean") return failure("This save has an invalid house state.")
  if (!isCompleteGameMap(value.games, isStatus)) {
    return failure("This save must include exactly the six sample games with valid statuses.")
  }
  if (!isGameMap(value.started, isDate) || !isGameMap(value.completions, isDate)) {
    return failure("This save has invalid game dates. Use valid ISO UTC dates.")
  }
  if (!isGameMap(value.homes, isHome)) return failure("This save has an invalid resident home.")
  if (!isGameMap(value.notes, (note): note is string => typeof note === "string" && note.length <= 500)) {
    return failure("This save has invalid notes. Each note can contain at most 500 characters.")
  }
  let playing = 0
  for (const { id, title } of GAMES) {
    const status = value.games[id]
    const started = value.started[id]
    const completed = value.completions[id]
    const home = value.homes[id]
    if (status === "playing") playing++
    if (status === "backlog" && (started !== undefined || completed !== undefined || home !== undefined)) {
      return failure(`${title} is in the backlog but already has a visit or resident history.`)
    }
    if (status !== "backlog" && started === undefined) {
      return failure(`${title} must have a start date before it can be played or completed.`)
    }
    if (status === "completed" && completed === undefined) {
      return failure(`${title} is completed but has no completion date.`)
    }
    if ((completed === undefined) !== (home === undefined)) {
      return failure(`${title} must have both a completion date and a permanent home, or neither.`)
    }
    if (status === "playing" && completed && started && Date.parse(started) < Date.parse(completed)) {
      return failure(`${title}'s replay cannot start before its first completion.`)
    }
    if (home === "plot" && !value.builtHouse) {
      return failure(`${title}'s resident cannot live at Fern House before it is built.`)
    }
  }
  if (playing > 1) return failure("Only one sample game can be playing at a time.")
  return {
    ok: true,
    value: {
      version: 1, revision: value.revision, games: value.games, started: value.started,
      completions: value.completions, homes: value.homes, notes: value.notes, builtHouse: value.builtHouse,
    },
  }
}

function validateAction(value: unknown): Result<DemoAction> {
  if (!isRecord(value) || typeof value.type !== "string" ||
    !Object.prototype.hasOwnProperty.call(ACTION_KEYS, value.type)) {
    return failure("That demo action is not supported.")
  }
  const type = value.type as DemoAction["type"]
  if (!hasKeys(value, ACTION_KEYS[type])) return failure("This demo action has missing or unknown fields.")
  if (type === "build") return { ok: true, value: { type } }
  if (!isGameId(value.gameId)) return failure("Choose one of the six sample games.")
  const gameId = value.gameId
  switch (type) {
    case "start":
    case "complete":
      if (!isDate(value.at)) return failure("This action needs a valid ISO UTC date.")
      return { ok: true, value: { type, gameId, at: value.at } }
    case "move":
      if (!isHome(value.home)) return failure("Choose the resident grove or Fern House.")
      return { ok: true, value: { type, gameId, home: value.home } }
    case "note":
      if (typeof value.text !== "string" || value.text.length > 500) {
        return failure("A note can contain at most 500 characters.")
      }
      return { ok: true, value: { type, gameId, text: value.text } }
  }
}

export function createDemoState(): DemoState {
  return {
    version: 1,
    revision: 0,
    games: {
      mosslight: "completed", ember: "backlog", paper: "completed",
      tide: "backlog", orbit: "backlog", rain: "backlog",
    },
    started: {
      mosslight: "2026-04-03T16:00:00.000Z",
      paper: "2026-04-10T16:00:00.000Z",
    },
    completions: {
      mosslight: "2026-04-06T17:00:00.000Z",
      paper: "2026-04-12T17:00:00.000Z",
    },
    homes: { mosslight: "grove", paper: "grove" },
    notes: {},
    builtHouse: false,
  }
}

function changed(state: DemoState, patch: Partial<DemoState>): Result<DemoState> {
  if (state.revision === Number.MAX_SAFE_INTEGER) return failure("This save has reached its revision limit.")
  return { ok: true, value: { ...state, ...patch, revision: state.revision + 1 } }
}

export function reduceDemoState(state: DemoState, action: DemoAction): Result<DemoState> {
  const validState = validateState(state)
  if (!validState.ok) return validState
  const validAction = validateAction(action)
  if (!validAction.ok) return validAction

  switch (action.type) {
    case "start": {
      if (state.games[action.gameId] === "playing") return { ok: true, value: state }
      const playing = GAMES.find(game => state.games[game.id] === "playing")
      if (playing) return failure(`Finish ${playing.title} before starting another game.`)
      const completed = state.completions[action.gameId]
      if (completed && Date.parse(action.at) < Date.parse(completed)) {
        return failure("A replay cannot start before the game's first completion.")
      }
      return changed(state, {
        games: { ...state.games, [action.gameId]: "playing" },
        started: { ...state.started, [action.gameId]: action.at },
      })
    }
    case "complete": {
      if (state.games[action.gameId] === "completed") return { ok: true, value: state }
      if (state.games[action.gameId] !== "playing") return failure("Start this game before completing it.")
      const started = state.started[action.gameId]!
      if (Date.parse(action.at) < Date.parse(started)) {
        return failure("A game cannot be completed before its start date.")
      }
      return changed(state, {
        games: { ...state.games, [action.gameId]: "completed" },
        // The first finish is the permanent residency milestone, not a replay's finish.
        completions: { ...state.completions, [action.gameId]: state.completions[action.gameId] ?? action.at },
        homes: { ...state.homes, [action.gameId]: state.homes[action.gameId] ?? "grove" },
      })
    }
    case "build":
      if (state.builtHouse) return { ok: true, value: state }
      return changed(state, { builtHouse: true })
    case "move":
      if (!state.completions[action.gameId]) return failure("Only permanent residents can move home.")
      if (action.home === "plot" && !state.builtHouse) return failure("Build Fern House before moving anyone in.")
      if (state.homes[action.gameId] === action.home) return { ok: true, value: state }
      return changed(state, { homes: { ...state.homes, [action.gameId]: action.home } })
    case "note": {
      if ((state.notes[action.gameId] ?? "") === action.text) return { ok: true, value: state }
      const notes = { ...state.notes }
      if (action.text === "") delete notes[action.gameId]
      else notes[action.gameId] = action.text
      return changed(state, { notes })
    }
  }
}

export function parseDemoSave(raw: string): Result<DemoState> {
  if (typeof raw !== "string") return failure("This local save must be JSON text.")
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return failure("This local save is not valid JSON. Your current world has not been changed.")
  }
  return validateState(value)
}

export type DemoSaveObservation = {
  raw: string | null
  revision: number | null
}

export function observeDemoSave(raw: string | null): DemoSaveObservation {
  if (raw === null) return { raw, revision: null }
  const parsed = parseDemoSave(raw)
  return { raw, revision: parsed.ok ? parsed.value.revision : null }
}

export function matchesObservedDemoSave(observed: DemoSaveObservation, currentRaw: string | null) {
  if (currentRaw !== observed.raw) return false
  if (observed.revision === null) return true
  if (currentRaw === null) return false
  const parsed = parseDemoSave(currentRaw)
  return parsed.ok && parsed.value.revision === observed.revision
}

export function residentsFor(state: DemoState): Resident[] {
  return GAMES.flatMap(({ id }): Resident[] => {
    if (state.completions[id] && state.homes[id]) {
      return [{ gameId: id, kind: "resident", home: state.homes[id] }]
    }
    if (state.games[id] === "playing") return [{ gameId: id, kind: "visitor", home: "lodge" }]
    return []
  })
}
