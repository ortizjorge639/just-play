import type {
  DemoAction, DemoGame, DemoState, GameId, GameStatus, HomeId, Resident, Result,
  LegacyDemoState, MilestoneRules, Merit, Confirmation, SiteId,
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
  confirm: ["type", "gameId", "target", "at"],
  stop: ["type", "gameId", "at"],
  "delete-remnant": ["type", "gameId"],
  rules: ["type", "gameId", "rules"],
  place: ["type", "gameId", "site"],
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

function validateLegacyState(value: unknown): Result<LegacyDemoState> {
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

export const SITE_IDS: readonly SiteId[] = ["plot", "brook", "crown", "fern", "dusk", "meadow", "sunrise"]
const isSite = (value: unknown): value is SiteId => typeof value === "string" && SITE_IDS.includes(value as SiteId)
const shortText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max
const MAX_MILESTONE_LENGTH = 120
const MAX_TIER_NAME_LENGTH = 30
const MAX_CONFIRMATION_KEY_LENGTH = JSON.stringify([
  "tier-5",
  "\u0000".repeat(MAX_MILESTONE_LENGTH),
  "\u0000".repeat(MAX_TIER_NAME_LENGTH),
  5,
  false,
]).length

export function defaultRules(): MilestoneRules {
  return {
    stamp: "Play for 2 hours",
    tiers: [
      { id: "tier-1", name: "Visited", milestone: "Play for 2 hours", structural: false },
      { id: "tier-2", name: "Resident", milestone: "Reach the credits", structural: true },
      { id: "tier-3", name: "Elder", milestone: "Finish my personal full-completion goal", structural: true },
    ],
  }
}

function isRules(value: unknown): value is MilestoneRules {
  if (!isRecord(value) || !hasKeys(value, ["stamp", "tiers"]) || !shortText(value.stamp, MAX_MILESTONE_LENGTH) ||
    !Array.isArray(value.tiers) || value.tiers.length < 1 || value.tiers.length > 5) return false
  const ids = new Set<string>()
  return value.tiers.every(tier => {
    if (!isRecord(tier) || !hasKeys(tier, ["id", "name", "milestone", "structural"]) ||
      typeof tier.id !== "string" || !/^tier-[1-5]$/.test(tier.id) || ids.has(tier.id) ||
      !shortText(tier.name, MAX_TIER_NAME_LENGTH) || !shortText(tier.milestone, MAX_MILESTONE_LENGTH) ||
      typeof tier.structural !== "boolean") return false
    ids.add(tier.id)
    return true
  })
}

function isConfirmation(value: unknown): value is Confirmation {
  return isRecord(value) && hasKeys(value, ["key", "milestone", "tier", "depth", "structural", "at"]) &&
    shortText(value.key, MAX_CONFIRMATION_KEY_LENGTH) &&
    shortText(value.milestone, MAX_MILESTONE_LENGTH) && shortText(value.tier, MAX_TIER_NAME_LENGTH) &&
    typeof value.depth === "number" && Number.isInteger(value.depth) && value.depth >= 0 && value.depth <= 5 &&
    typeof value.structural === "boolean" && isDate(value.at)
}

function isMerit(value: unknown): value is Merit {
  if (!isRecord(value) || !hasKeys(value, ["depth", "structural", "history"]) ||
    !Array.isArray(value.history) || value.history.length > 200 || !value.history.every(isConfirmation)) return false
  return new Set(value.history.map(item => item.key)).size === value.history.length &&
    value.depth === Math.max(0, ...value.history.map(item => item.depth)) &&
    value.structural === value.history.some(item => item.structural)
}

function validateState(value: unknown): Result<DemoState> {
  if (!isRecord(value)) return failure("This save must contain a demo world object.")
  if (value.version !== 2) return failure("This save uses an unsupported demo version.")
  if (!hasKeys(value, [...STATE_KEYS, "rules", "merits", "remnants", "placements", "migratedFrom"])) return failure("This save has missing or unknown fields.")
  if (typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
    typeof value.builtHouse !== "boolean" || (value.migratedFrom !== null && value.migratedFrom !== 1)) return failure("This save has invalid world metadata.")
  if (value.builtHouse && value.migratedFrom !== 1) return failure("Fern House is reserved for preserved legacy construction.")
  if (!isCompleteGameMap(value.games, isStatus) || !isGameMap(value.started, isDate) ||
    !isGameMap(value.completions, isDate) || !isGameMap(value.homes, isHome) ||
    !isGameMap(value.notes, (note): note is string => typeof note === "string" && note.length <= 500)) return failure("This save has invalid games, dates, homes, or notes.")
  if (!isRecord(value.rules) || !hasKeys(value.rules, ["defaults", "games"]) ||
    !isRules(value.rules.defaults) || !isGameMap(value.rules.games, isRules)) return failure("This save has invalid milestone rules. Use one to five named tiers and a stamp.")
  if (!isGameMap(value.merits, isMerit) || !isGameMap(value.remnants, isDate) ||
    !isGameMap(value.placements, isSite)) return failure("This save has invalid merit history, keepsakes, or placements.")
  if (Object.values(value.games).filter(status => status === "playing").length > 1) return failure("Only one invitation or replay can be active at a time.")
  const occupied = new Set<SiteId>(value.builtHouse ? ["plot"] : [])
  for (const { id } of GAMES) {
    const arrived = value.completions[id]
    if ((arrived === undefined) !== (value.homes[id] === undefined)) return failure("Every arrival needs its permanent home and arrival date.")
    if ((value.games[id] !== "backlog" || arrived) && !value.started[id]) return failure("An invitation needs a valid start date.")
    if (value.games[id] === "completed" && !arrived || value.games[id] === "backlog" && arrived) return failure("Arrival and game status disagree.")
    if (value.games[id] === "playing" && arrived && Date.parse(value.started[id]!) < Date.parse(arrived)) return failure("A replay cannot begin before arrival.")
    if (value.homes[id] === "plot" && !value.builtHouse) return failure("This legacy home has not been built.")
    if (value.remnants[id] && (arrived || !value.started[id])) return failure("A keepsake needs an unarrived invitation history.")
    const site = value.placements[id]
    if (site) {
      if (!arrived || !value.merits[id]?.structural || occupied.has(site)) return failure("Each placed addition needs an arrival, an earned structure, and a vacant branch.")
      occupied.add(site)
    }
  }
  return {
    ok: true,
    value: {
      version: value.version,
      revision: value.revision,
      games: value.games,
      started: value.started,
      completions: value.completions,
      homes: value.homes,
      notes: value.notes,
      builtHouse: value.builtHouse,
      rules: { defaults: value.rules.defaults, games: value.rules.games },
      merits: value.merits,
      remnants: value.remnants,
      placements: value.placements,
      migratedFrom: value.migratedFrom,
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
  if (type === "rules") {
    if (value.gameId !== null && !isGameId(value.gameId)) return failure("Choose default rules or a sample game.")
    if (value.rules === null && value.gameId !== null) return { ok: true, value: { type, gameId: value.gameId, rules: null } }
    if (!isRules(value.rules)) return failure("Use a stamp and one to five tiers, each with a name and milestone.")
    return { ok: true, value: { type, gameId: value.gameId, rules: structuredClone(value.rules) } }
  }
  if (!isGameId(value.gameId)) return failure("Choose one of the six sample games.")
  const gameId = value.gameId
  switch (type) {
    case "start":
    case "stop":
      if (!isDate(value.at)) return failure("This action needs a valid ISO UTC date.")
      return { ok: true, value: { type, gameId, at: value.at } }
    case "confirm":
      if (!isDate(value.at) || typeof value.target !== "string" || !/^(stamp|tier-[1-5])$/.test(value.target)) return failure("Choose a configured stamp or tier and a valid date.")
      return { ok: true, value: { type, gameId, target: value.target, at: value.at } }
    case "delete-remnant":
      return { ok: true, value: { type, gameId } }
    case "place":
      if (!isSite(value.site)) return failure("Choose an authored compatible branch.")
      return { ok: true, value: { type, gameId, site: value.site } }
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
    version: 2,
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
    rules: { defaults: defaultRules(), games: {} },
    merits: {},
    remnants: {},
    placements: {},
    migratedFrom: null,
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

  action = validAction.value
  switch (action.type) {
    case "start": {
      if (state.games[action.gameId] === "playing") return { ok: true, value: state }
      const playing = GAMES.find(game => state.games[game.id] === "playing")
      if (playing) return failure(`End ${playing.title}'s invitation or replay before inviting another game.`)
      const completed = state.completions[action.gameId]
      if (completed && Date.parse(action.at) < Date.parse(completed)) {
        return failure("A replay cannot start before the game's first completion.")
      }
      return changed(state, {
        games: { ...state.games, [action.gameId]: "playing" },
        started: { ...state.started, [action.gameId]: action.at },
      })
    }
    case "confirm": {
      const id = action.gameId
      if (state.games[id] !== "playing" && !state.completions[id]) return failure("Invite this game before confirming a sample milestone.")
      if (Date.parse(action.at) < Date.parse(state.started[id]!)) return failure("A milestone cannot predate this invitation.")
      const proof = proofFor(state, id, action.target)
      if (!proof) return failure("This tier no longer exists. Review the current rules.")
      const { milestone, depth, structural } = proof
      const record: Confirmation = { ...proof, at: action.at }
      const merit = state.merits[id] ?? { depth: 0, structural: false, history: [] }
      if (merit.history.some(item => item.key === record.key)) return { ok: true, value: state }
      if (merit.history.length >= 200) return failure("This sample has reached its 200-entry confirmation limit. Your existing history is safe.")
      const arrives = !state.completions[id] && milestone === rulesFor(state, id).stamp
      const remnants = { ...state.remnants }
      if (arrives) delete remnants[id]
      return changed(state, {
        ...(arrives ? {
          games: { ...state.games, [id]: "completed" },
          completions: { ...state.completions, [id]: action.at },
          homes: { ...state.homes, [id]: "grove" },
        } : {}),
        remnants,
        merits: { ...state.merits, [id]: { depth: Math.max(merit.depth, depth), structural: merit.structural || structural, history: [...merit.history, record] } },
      })
    }
    case "stop": {
      const id = action.gameId
      if (state.games[id] !== "playing") return { ok: true, value: state }
      if (Date.parse(action.at) < Date.parse(state.started[id]!)) return failure("An invitation cannot end before it starts.")
      return changed(state, {
        games: { ...state.games, [id]: state.completions[id] ? "completed" : "backlog" },
        remnants: state.completions[id] ? state.remnants : { ...state.remnants, [id]: state.remnants[id] ?? action.at },
      })
    }
    case "delete-remnant": {
      if (!state.remnants[action.gameId]) return { ok: true, value: state }
      const remnants = { ...state.remnants }
      delete remnants[action.gameId]
      return changed(state, { remnants })
    }
    case "rules": {
      if (action.gameId === null) {
        if (JSON.stringify(state.rules.defaults) === JSON.stringify(action.rules)) return { ok: true, value: state }
        return changed(state, { rules: { ...state.rules, defaults: action.rules! } })
      }
      const games = { ...state.rules.games }
      if (action.rules === null) delete games[action.gameId]
      else games[action.gameId] = action.rules
      if (JSON.stringify(games) === JSON.stringify(state.rules.games)) return { ok: true, value: state }
      return changed(state, { rules: { ...state.rules, games } })
    }
    case "place":
      if (state.placements[action.gameId] === action.site) return { ok: true, value: state }
      if (state.placements[action.gameId]) return failure("This contribution is already placed. Later tiers enrich it in place.")
      if (!state.completions[action.gameId] || !state.merits[action.gameId]?.structural) return failure("Earn arrival and a structural tier before choosing a branch.")
      if (Object.values(state.placements).includes(action.site) || state.builtHouse && action.site === "plot") return failure("That branch already holds a contribution.")
      return changed(state, { placements: { ...state.placements, [action.gameId]: action.site } })
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
  if (isRecord(value) && value.version === 1) {
    const legacy = validateLegacyState(value)
    if (!legacy.ok) return legacy
    return validateState({
      ...legacy.value, version: 2, rules: { defaults: defaultRules(), games: {} },
      merits: {}, remnants: {}, placements: {}, migratedFrom: 1,
    })
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
    return []
  })
}

export function rulesFor(state: DemoState, id: GameId) {
  return state.rules.games[id] ?? state.rules.defaults
}

export function proofFor(state: DemoState, id: GameId, target: string): Omit<Confirmation, "at"> | null {
  const rules = rulesFor(state, id)
  const tier = rules.tiers.find(tier => tier.id === target)
  if (target !== "stamp" && !tier) return null
  const milestone = tier?.milestone ?? rules.stamp
  const matching = rules.tiers.map((tier, index) => ({ ...tier, depth: index + 1 })).filter(tier => tier.milestone === milestone)
  const depth = Math.max(0, ...matching.map(tier => tier.depth))
  const structural = matching.some(tier => tier.structural)
  return {
    key: JSON.stringify([target, milestone, tier?.name ?? "Arrival stamp", depth, structural]),
    milestone, tier: tier?.name ?? "Arrival stamp", depth, structural,
  }
}

export function hasConfirmed(state: DemoState, id: GameId, target: string) {
  const proof = proofFor(state, id, target)
  return Boolean(proof && state.merits[id]?.history.some(item => item.key === proof.key))
}

export function earnedStructure(state: DemoState, id: GameId) {
  return Boolean(state.completions[id] && state.merits[id]?.structural)
}

export const CONTRIBUTIONS: Record<GameId, { small: string; structure: string; detail: string }> = {
  mosslight: { small: "Lantern seedling", structure: "Lantern garden", detail: "Pip's glowing planters and garden pergola" },
  ember: { small: "Ember reliquary", structure: "Ember hearth deck", detail: "Sol's open hearth, timber canopy, and ember display" },
  paper: { small: "Folded glider", structure: "Letter-writing loft", detail: "Wren's airy writing pavilion and suspended paper gliders" },
  tide: { small: "Tideglass vessel", structure: "Tide garden", detail: "Nori's tide pool, stepping stones, and chart table" },
  orbit: { small: "Pocket orrery", structure: "Stargazing deck", detail: "Io's telescope, orbital sculpture, and star chart" },
  rain: { small: "Rainflower pot", structure: "Rain garden patio", detail: "Rue's rain chains, flowering trellis, and reflecting basin" },
}
