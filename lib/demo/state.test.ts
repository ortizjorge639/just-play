import test from "node:test"
import assert from "node:assert/strict"
import type { DemoAction, DemoState, GameId, Result } from "./contracts"
import {
  GAMES, GAME_BY_ID, SAVE_KEY, createDemoState, parseDemoSave, reduceDemoState, residentsFor,
} from "./state"

const START = "2026-09-05T18:00:00.000Z"
const FINISH = "2026-09-05T19:00:00.000Z"
const REPLAY = "2026-09-06T18:00:00.000Z"
const REFINISH = "2026-09-06T19:00:00.000Z"

function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(result.error)
  return result.value
}

function rejected(result: Result<unknown>) {
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.error.trim().length > 0, "Failures need a visible explanation")
}

function freeze(state: DemoState): DemoState {
  for (const field of Object.values(state)) {
    if (typeof field === "object" && field !== null) Object.freeze(field)
  }
  return Object.freeze(state)
}

function start(state = createDemoState(), gameId: GameId = "ember", at = START) {
  return value(reduceDemoState(state, { type: "start", gameId, at }))
}

function complete(state: DemoState, gameId: GameId = "ember", at = FINISH) {
  return value(reduceDemoState(state, { type: "complete", gameId, at }))
}

test("the catalog contains exactly six original sample games and a stable save key", () => {
  assert.equal(SAVE_KEY, "just-play-canopy-demo-v1")
  assert.deepEqual(GAMES.map(({ id, title, character }) => [id, title, character]), [
    ["mosslight", "Mosslight Valley", "Pip"],
    ["ember", "The Last Ember", "Sol"],
    ["paper", "Paper Skies", "Wren"],
    ["tide", "Tidebound", "Nori"],
    ["orbit", "Little Orbit", "Io"],
    ["rain", "After the Rain", "Rue"],
  ])
  assert.equal(new Set(GAMES.map(game => game.color)).size, 6)
  for (const game of GAMES) {
    assert.equal(GAME_BY_ID[game.id], game)
    assert.match(game.color, /^#[0-9a-f]{6}$/i)
    assert.ok(game.description && game.memory && game.symbol)
  }
})

test("a fresh world starts with Pip and Wren at home, four backlog games and no visitor", () => {
  const state = createDemoState()
  assert.equal(state.version, 1)
  assert.equal(state.revision, 0)
  assert.equal(state.builtHouse, false)
  assert.equal(Object.values(state.games).filter(status => status === "completed").length, 2)
  assert.equal(Object.values(state.games).filter(status => status === "backlog").length, 4)
  assert.ok(!Object.values(state.games).includes("playing"))
  assert.deepEqual(residentsFor(state), [
    { gameId: "mosslight", kind: "resident", home: "grove" },
    { gameId: "paper", kind: "resident", home: "grove" },
  ])
  assert.deepEqual(value(parseDemoSave(JSON.stringify(state))), state)
})

test("starting then completing The Last Ember introduces Sol and makes that same character permanent", () => {
  const initial = freeze(createDemoState())
  const before = JSON.stringify(initial)
  const visiting = freeze(start(initial))
  assert.equal(visiting.revision, 1)
  assert.equal(visiting.games.ember, "playing")
  assert.equal(visiting.started.ember, START)
  assert.equal(visiting.completions.ember, undefined)
  assert.equal(visiting.homes.ember, undefined)
  assert.deepEqual(residentsFor(visiting).find(resident => resident.gameId === "ember"), {
    gameId: "ember", kind: "visitor", home: "lodge",
  })
  const permanent = complete(visiting)
  assert.equal(permanent.revision, 2)
  assert.equal(permanent.games.ember, "completed")
  assert.equal(permanent.completions.ember, FINISH)
  assert.deepEqual(residentsFor(permanent).find(resident => resident.gameId === "ember"), {
    gameId: "ember", kind: "resident", home: "grove",
  })
  assert.equal(residentsFor(permanent).length, 3)
  assert.equal(JSON.stringify(initial), before)
  assert.equal(visiting.games.ember, "playing")
  assert.equal(visiting.homes.ember, undefined)
})

test("replaying preserves permanent identity, chosen home, notes and first completion", () => {
  let state = complete(start())
  state = value(reduceDemoState(state, { type: "build" }))
  state = value(reduceDemoState(state, { type: "move", gameId: "ember", home: "plot" }))
  state = value(reduceDemoState(state, { type: "note", gameId: "ember", text: "The lantern scene." }))
  const before = freeze(state)
  const replay = freeze(start(before, "ember", REPLAY))
  assert.equal(replay.games.ember, "playing")
  assert.equal(replay.started.ember, REPLAY)
  assert.equal(replay.completions.ember, FINISH)
  assert.equal(replay.homes.ember, "plot")
  assert.deepEqual(residentsFor(replay), residentsFor(before))
  assert.equal(residentsFor(replay).filter(resident => resident.gameId === "ember").length, 1)
  const finished = complete(replay, "ember", REFINISH)
  assert.equal(finished.games.ember, "completed")
  assert.equal(finished.completions.ember, FINISH)
  assert.equal(finished.homes.ember, "plot")
  assert.equal(finished.notes.ember, "The lantern scene.")
  assert.deepEqual(value(parseDemoSave(JSON.stringify(replay))), replay)
  assert.deepEqual(value(parseDemoSave(JSON.stringify(finished))), finished)
})

test("starting an already playing game and completing an already completed game are idempotent", () => {
  const playing = freeze(start())
  assert.equal(start(playing, "ember", REPLAY), playing)
  const completed = freeze(complete(playing))
  assert.equal(complete(completed, "ember", REFINISH), completed)
  assert.equal(completed.revision, 2)
  assert.equal(complete(completed, "mosslight", REFINISH), completed)
  assert.equal(completed.started.ember, START)
  assert.equal(completed.completions.ember, FINISH)
})

test("only one game can play, including replays, and the wrong game cannot be completed", () => {
  const state = freeze(start())
  const before = JSON.stringify(state)
  for (const gameId of ["tide", "mosslight", "paper"] as const) {
    rejected(reduceDemoState(state, { type: "start", gameId, at: START }))
  }
  rejected(reduceDemoState(state, { type: "complete", gameId: "tide", at: FINISH }))
  rejected(reduceDemoState(createDemoState(), { type: "complete", gameId: "ember", at: FINISH }))
  assert.equal(complete(state, "mosslight", FINISH), state)
  assert.equal(JSON.stringify(state), before)
  assert.equal(start(complete(state), "tide").games.tide, "playing")
})

test("dates are deterministic, reject completion before start, and allow an immediate finish", () => {
  const initial = createDemoState()
  const action: DemoAction = Object.freeze({ type: "start", gameId: "ember", at: START })
  assert.deepEqual(value(reduceDemoState(initial, action)), value(reduceDemoState(initial, action)))
  rejected(reduceDemoState(start(), { type: "complete", gameId: "ember", at: "2026-09-04T00:00:00Z" }))
  rejected(reduceDemoState(complete(start()), { type: "start", gameId: "ember", at: START }))
  assert.equal(complete(start(), "ember", START).completions.ember, START)
  assert.equal(start(initial, "ember", "2028-02-29T12:30:00Z").started.ember, "2028-02-29T12:30:00Z")
})

test("a house is built only once, only permanent residents move, and moving is idempotent", () => {
  const initial = freeze(createDemoState())
  rejected(reduceDemoState(initial, { type: "move", gameId: "mosslight", home: "plot" }))
  rejected(reduceDemoState(initial, { type: "move", gameId: "ember", home: "grove" }))
  const built = freeze(value(reduceDemoState(initial, { type: "build" })))
  assert.equal(built.builtHouse, true)
  assert.equal(built.revision, 1)
  assert.equal(value(reduceDemoState(built, { type: "build" })), built)
  rejected(reduceDemoState(start(built), { type: "move", gameId: "ember", home: "plot" }))
  const moved = freeze(value(reduceDemoState(built, { type: "move", gameId: "mosslight", home: "plot" })))
  assert.equal(moved.homes.mosslight, "plot")
  assert.equal(moved.revision, 2)
  assert.equal(built.homes.mosslight, "grove")
  assert.equal(value(reduceDemoState(moved, { type: "move", gameId: "mosslight", home: "plot" })), moved)
  const replay = start(moved, "mosslight")
  const movedDuringReplay = value(reduceDemoState(replay, { type: "move", gameId: "mosslight", home: "grove" }))
  assert.equal(movedDuringReplay.games.mosslight, "playing")
  assert.deepEqual(residentsFor(movedDuringReplay).find(resident => resident.gameId === "mosslight"), {
    gameId: "mosslight", kind: "resident", home: "grove",
  })
})

test("notes support any known game, preserve text, enforce 500 characters, and can be cleared", () => {
  const initial = freeze(createDemoState())
  assert.equal(value(reduceDemoState(initial, { type: "note", gameId: "ember", text: "" })), initial)
  const text = "  A quiet moment.\n".padEnd(500, "x")
  assert.equal(text.length, 500)
  const noted = freeze(value(reduceDemoState(initial, { type: "note", gameId: "ember", text })))
  assert.equal(noted.notes.ember, text)
  assert.equal(noted.revision, 1)
  assert.equal(value(reduceDemoState(noted, { type: "note", gameId: "ember", text })), noted)
  rejected(reduceDemoState(noted, { type: "note", gameId: "ember", text: `${text}x` }))
  assert.deepEqual(value(parseDemoSave(JSON.stringify(noted))), noted)
  const cleared = value(reduceDemoState(noted, { type: "note", gameId: "ember", text: "" }))
  assert.equal(cleared.notes.ember, undefined)
  assert.ok(!Object.hasOwn(cleared.notes, "ember"))
  assert.equal(cleared.revision, 2)
  assert.deepEqual(initial.notes, {})
})

const badActions: [string, unknown][] = [
  ["null", null],
  ["array", []],
  ["unknown type", { type: "reset" }],
  ["prototype type", { type: "toString" }],
  ["unknown game", { type: "start", gameId: "unknown", at: START }],
  ["prototype game", { type: "complete", gameId: "constructor", at: FINISH }],
  ["unknown note game", { type: "note", gameId: "__proto__", text: "hello" }],
  ["unknown move game", { type: "move", gameId: "missing", home: "grove" }],
  ["unknown home", { type: "move", gameId: "mosslight", home: "lodge" }],
  ["missing date", { type: "start", gameId: "ember" }],
  ["numeric date", { type: "start", gameId: "ember", at: 1 }],
  ["non-ISO date", { type: "start", gameId: "ember", at: "September 5, 2026" }],
  ["impossible date", { type: "start", gameId: "ember", at: "2026-02-30T12:00:00Z" }],
  ["non-leap date", { type: "complete", gameId: "ember", at: "2026-02-29T12:00:00Z" }],
  ["invalid time", { type: "complete", gameId: "ember", at: "2026-09-05T24:00:00Z" }],
  ["ambiguous local time", { type: "start", gameId: "ember", at: "2026-09-05T18:00:00" }],
  ["non-string note", { type: "note", gameId: "ember", text: 42 }],
  ["oversized note", { type: "note", gameId: "ember", text: "x".repeat(501) }],
  ["extra action keys", { type: "build", builtHouse: false }],
  ["inherited action fields", Object.create({ type: "build" })],
]

for (const [name, action] of badActions) {
  test(`runtime action validation rejects ${name} without mutating the world`, () => {
    const state = freeze(createDemoState())
    const before = JSON.stringify(state)
    rejected(reduceDemoState(state, action as DemoAction))
    assert.equal(JSON.stringify(state), before)
  })
}

test("the entire library can be played sequentially with one permanent identity per game", () => {
  let state = createDemoState()
  for (const game of GAMES) {
    state = start(freeze(state), game.id)
    state = complete(freeze(state), game.id)
  }
  assert.ok(Object.values(state.games).every(status => status === "completed"))
  assert.equal(residentsFor(state).length, GAMES.length)
  assert.equal(new Set(residentsFor(state).map(resident => resident.gameId)).size, GAMES.length)
  assert.ok(residentsFor(state).every(resident => resident.kind === "resident"))
  assert.deepEqual(value(parseDemoSave(JSON.stringify(state))), state)
})

test("every action stage round-trips through JSON into detached save objects", () => {
  let state = createDemoState()
  const actions: DemoAction[] = [
    { type: "start", gameId: "ember", at: START },
    { type: "complete", gameId: "ember", at: FINISH },
    { type: "build" },
    { type: "move", gameId: "ember", home: "plot" },
    { type: "note", gameId: "ember", text: "A note with “quotes”, 🌿, and\nnewlines." },
    { type: "start", gameId: "ember", at: REPLAY },
    { type: "complete", gameId: "ember", at: REFINISH },
  ]
  for (const action of actions) {
    state = value(reduceDemoState(freeze(state), action))
    const parsed = value(parseDemoSave(JSON.stringify(state)))
    assert.deepEqual(parsed, state)
    assert.notEqual(parsed, state)
    assert.notEqual(parsed.games, state.games)
    assert.notEqual(parsed.homes, state.homes)
  }
})

const base = createDemoState()
const corruptSaves: [string, unknown][] = [
  ["null", null],
  ["array", []],
  ["number", 7],
  ["unknown version", { ...base, version: 2 }],
  ["string version", { ...base, version: "1" }],
  ["missing field", { ...base, notes: undefined }],
  ["unknown field", { ...base, residents: [] }],
  ["negative revision", { ...base, revision: -1 }],
  ["fractional revision", { ...base, revision: 1.5 }],
  ["unsafe revision", { ...base, revision: Number.MAX_SAFE_INTEGER + 1 }],
  ["string revision", { ...base, revision: "0" }],
  ["invalid house flag", { ...base, builtHouse: "true" }],
  ["missing game", { ...base, games: { ...base.games, ember: undefined } }],
  ["unknown game key", { ...base, games: { ...base.games, counterfeit: "backlog" } }],
  ["invalid status", { ...base, games: { ...base.games, ember: "finished" } }],
  ["array map", { ...base, notes: [] }],
  ["unknown date key", { ...base, started: { ...base.started, counterfeit: START } }],
  ["invalid start date", { ...base, started: { ...base.started, mosslight: "yesterday" } }],
  ["invalid completion date", { ...base, completions: { ...base.completions, paper: "2026-02-30T10:00:00Z" } }],
  ["missing start", { ...base, started: {} }],
  ["completion without date", { ...base, completions: {} }],
  ["completion without home", { ...base, homes: {} }],
  ["home without completion", { ...base, homes: { ...base.homes, ember: "grove" } }],
  ["backlog with start", { ...base, started: { ...base.started, ember: START } }],
  ["backlog with completion", {
    ...base, started: { ...base.started, ember: START }, completions: { ...base.completions, ember: FINISH },
    homes: { ...base.homes, ember: "grove" },
  }],
  ["playing without start", { ...base, games: { ...base.games, ember: "playing" } }],
  ["more than one playing", {
    ...base, games: { ...base.games, ember: "playing", tide: "playing" },
    started: { ...base.started, ember: START, tide: START },
  }],
  ["visitor with a permanent home", {
    ...start(), homes: { ...base.homes, ember: "grove" },
  }],
  ["replay before first completion", { ...base, games: { ...base.games, mosslight: "playing" } }],
  ["invalid home", { ...base, homes: { ...base.homes, mosslight: "lodge" } }],
  ["unbuilt plot home", { ...base, homes: { ...base.homes, mosslight: "plot" } }],
  ["unknown home key", { ...base, homes: { ...base.homes, stranger: "grove" } }],
  ["unknown note key", { ...base, notes: { stranger: "hello" } }],
  ["non-string note", { ...base, notes: { ember: 5 } }],
  ["oversized note", { ...base, notes: { ember: "x".repeat(501) } }],
  ["prototype key", { ...base, notes: { ["__proto__"]: "hello" } }],
]

for (const [name, save] of corruptSaves) {
  test(`save validation rejects ${name} instead of resetting`, () => {
    rejected(parseDemoSave(JSON.stringify(save)))
  })
}

test("malformed JSON and non-string runtime save values are rejected", () => {
  for (const raw of ["", "{", "undefined", '{"version":1,}', "[] trailing"]) rejected(parseDemoSave(raw))
  rejected(parseDemoSave(null as unknown as string))
})

test("malformed runtime state is rejected instead of crashing or spreading corrupt data", () => {
  rejected(reduceDemoState(null as unknown as DemoState, { type: "build" }))
  rejected(reduceDemoState({ ...createDemoState(), notes: [] } as unknown as DemoState, { type: "build" }))
})

test("revision overflow cannot create an invalid save, while no-ops stay idempotent", () => {
  const state = { ...createDemoState(), revision: Number.MAX_SAFE_INTEGER }
  rejected(reduceDemoState(state, { type: "build" }))
  assert.equal(value(reduceDemoState(state, { type: "move", gameId: "mosslight", home: "grove" })), state)
  assert.deepEqual(value(parseDemoSave(JSON.stringify(state))), state)
})

test("resetting produces fresh nested objects and never carries changes into another world", () => {
  const first = createDemoState()
  const second = createDemoState()
  assert.deepEqual(first, second)
  assert.notEqual(first, second)
  for (const key of ["games", "started", "completions", "homes", "notes"] as const) {
    assert.notEqual(first[key], second[key])
  }
  first.games.ember = "playing"
  first.started.ember = START
  first.homes.paper = "plot"
  first.notes.ember = "Changed."
  first.builtHouse = true
  first.revision = 20
  assert.deepEqual(second, createDemoState())
  const residents = residentsFor(second)
  residents[0].home = "plot"
  assert.equal(residentsFor(second)[0].home, "grove")
})
