import test from "node:test"
import assert from "node:assert/strict"
import type { DemoAction, DemoState, GameId, LegacyDemoState, Result } from "./contracts"
import {
  CONTRIBUTIONS, GAMES, GAME_BY_ID, SAVE_KEY, SITE_IDS, createDemoState, defaultRules,
  earnedStructure, hasConfirmed, matchesObservedDemoSave, observeDemoSave, parseDemoSave,
  reduceDemoState, residentsFor, rulesFor,
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
  if (!result.ok) assert.ok(result.error.trim().length > 0)
}
function freeze<T>(input: T): T {
  if (input && typeof input === "object") {
    Object.values(input).forEach(freeze)
    Object.freeze(input)
  }
  return input
}
function act(state: DemoState, action: DemoAction) {
  const next = value(reduceDemoState(freeze(state), action))
  assert.deepEqual(value(parseDemoSave(JSON.stringify(next))), next, "Every transition must round-trip")
  return next
}
function start(state = createDemoState(), gameId: GameId = "ember", at = START) {
  return act(state, { type: "start", gameId, at })
}
function confirm(state: DemoState, target = "stamp", gameId: GameId = "ember", at = FINISH) {
  return act(state, { type: "confirm", gameId, target, at })
}
function stop(state: DemoState, gameId: GameId = "ember", at = FINISH) {
  return act(state, { type: "stop", gameId, at })
}
function legacy(): LegacyDemoState {
  const { revision, games, started, completions, homes, notes, builtHouse } = createDemoState()
  return { version: 1, revision, games, started, completions, homes, notes, builtHouse }
}

test("six original games and a stable save key preserve the existing world", () => {
  assert.equal(SAVE_KEY, "just-play-canopy-demo-v1")
  assert.deepEqual(GAMES.map(game => game.character), ["Pip", "Sol", "Wren", "Nori", "Io", "Rue"])
  assert.equal(new Set(GAMES.map(game => game.color)).size, 6)
  assert.equal(new Set(Object.values(CONTRIBUTIONS).map(item => item.structure)).size, 6)
  for (const game of GAMES) {
    assert.equal(GAME_BY_ID[game.id], game)
    assert.match(game.color, /^#[0-9a-f]{6}$/i)
    assert.ok(game.description && game.memory && game.symbol)
  }
  const state = createDemoState()
  assert.equal(state.version, 2)
  assert.equal(state.revision, 0)
  assert.equal(Object.values(state.games).filter(status => status === "backlog").length, 4)
  assert.deepEqual(residentsFor(state), [
    { gameId: "mosslight", kind: "resident", home: "grove" },
    { gameId: "paper", kind: "resident", home: "grove" },
  ])
  assert.deepEqual(value(parseDemoSave(JSON.stringify(state))), state)
})

test("invitations remain outside; the chosen two-hour stamp makes that identity permanent", () => {
  const initial = createDemoState(), before = JSON.stringify(initial)
  const invited = start(initial)
  assert.equal(invited.games.ember, "playing")
  assert.equal(invited.completions.ember, undefined)
  assert.equal(invited.homes.ember, undefined)
  assert.ok(!residentsFor(invited).some(resident => resident.gameId === "ember"))
  assert.equal(start(invited), invited)
  const arrived = confirm(invited)
  assert.equal(arrived.completions.ember, FINISH)
  assert.equal(arrived.games.ember, "completed")
  assert.equal(arrived.merits.ember?.depth, 1)
  assert.equal(earnedStructure(arrived, "ember"), false)
  assert.deepEqual(residentsFor(arrived).at(1), { gameId: "ember", kind: "resident", home: "grove" })
  assert.equal(confirm(arrived), arrived)
  assert.equal(JSON.stringify(initial), before)
})

test("credits earn a structure, a player places it, deeper tiers enrich the same resident", () => {
  let state = confirm(start())
  rejected(reduceDemoState(state, { type: "place", gameId: "ember", site: "brook" }))
  state = confirm(state, "tier-2")
  assert.equal(earnedStructure(state, "ember"), true)
  assert.deepEqual(state.placements, {}, "A reward must never auto-place")
  state = act(state, { type: "place", gameId: "ember", site: "brook" })
  assert.equal(act(state, { type: "place", gameId: "ember", site: "brook" }), state)
  rejected(reduceDemoState(state, { type: "place", gameId: "ember", site: "crown" }))
  const deeper = confirm(state, "tier-3")
  assert.equal(deeper.merits.ember?.depth, 3)
  assert.deepEqual(deeper.placements, state.placements)
  assert.equal(residentsFor(deeper).filter(resident => resident.gameId === "ember").length, 1)
  assert.equal(deeper.completions.ember, FINISH)
})

test("arrival and depth are independent, not determined by tier names", () => {
  let state = createDemoState()
  const rules = defaultRules()
  rules.stamp = "Reach my third island"
  rules.tiers[0].name = "Elder"
  rules.tiers[1].name = "Visited"
  state = act(state, { type: "rules", gameId: "ember", rules })
  state = start(state)
  state = confirm(state, "tier-2")
  assert.equal(state.merits.ember?.structural, true)
  assert.equal(earnedStructure(state, "ember"), false)
  assert.equal(state.completions.ember, undefined)
  assert.ok(!residentsFor(state).some(resident => resident.gameId === "ember"))
  state = confirm(state)
  assert.equal(earnedStructure(state, "ember"), true)
  assert.equal(state.completions.ember, FINISH)
  assert.equal(state.merits.ember?.depth, 2)
})

test("default/per-game editable tiers preserve original earned proof history and permanent arrivals", () => {
  let state = confirm(confirm(start()), "tier-2")
  const original = structuredClone(state.merits.ember)
  const rules = defaultRules()
  rules.stamp = "Earn my platinum"
  rules.tiers = [{ id: "tier-5", name: "A good afternoon", milestone: "Walk one trail", structural: false }]
  state = act(state, { type: "rules", gameId: null, rules })
  assert.deepEqual(rulesFor(state, "ember"), rules)
  assert.deepEqual(state.merits.ember, original)
  assert.equal(state.completions.ember, FINISH)
  assert.equal(earnedStructure(state, "ember"), true)
  const custom = { ...rules, stamp: "Play one chapter" }
  state = act(state, { type: "rules", gameId: "ember", rules: custom })
  assert.equal(rulesFor(state, "ember").stamp, "Play one chapter")
  assert.equal(rulesFor(state, "tide").stamp, "Earn my platinum")
  state = confirm(state, "tier-5")
  assert.equal(state.merits.ember?.history.length, 3)
  assert.deepEqual(state.merits.ember?.history.slice(0, 2), original?.history)
  assert.equal(state.merits.ember?.depth, 2, "Editing/reconfirming lower rules does not downgrade earned depth")
  rejected(reduceDemoState(state, { type: "confirm", gameId: "ember", target: "tier-2", at: FINISH }))
  state = act(state, { type: "rules", gameId: "ember", rules: null })
  assert.equal(rulesFor(state, "ember").stamp, "Earn my platinum")
  assert.equal(act(state, { type: "rules", gameId: "ember", rules: null }), state)
})

test("a matching named milestone can earn arrival but never implicitly verifies deeper proofs", () => {
  let state = start()
  state = confirm(state, "tier-1")
  assert.equal(state.completions.ember, FINISH)
  assert.equal(state.merits.ember?.history.length, 1)
  assert.equal(state.merits.ember?.structural, false)
  assert.equal(state.merits.ember?.history[0].milestone, "Play for 2 hours")
})

test("changing a tier's contribution rule requires fresh self-confirmation, not a disabled stale proof", () => {
  let state = confirm(start(), "tier-1")
  assert.equal(hasConfirmed(state, "ember", "tier-1"), true)
  const rules = defaultRules()
  rules.tiers[0].structural = true
  state = act(state, { type: "rules", gameId: "ember", rules })
  assert.equal(hasConfirmed(state, "ember", "tier-1"), false)
  assert.equal(earnedStructure(state, "ember"), false)
  state = confirm(state, "tier-1")
  assert.equal(earnedStructure(state, "ember"), true)
  assert.equal(state.merits.ember?.history.length, 2)
  assert.equal(state.merits.ember?.history[0].structural, false)
})

test("stopping an invitation keeps exactly one postcard across repeats and re-invites", () => {
  const first = stop(start())
  assert.equal(first.games.ember, "backlog")
  assert.equal(first.remnants.ember, FINISH)
  assert.equal(stop(first), first)
  const again = start(first, "ember", REPLAY)
  assert.equal(again.remnants.ember, FINISH)
  const stoppedAgain = stop(again, "ember", REFINISH)
  assert.deepEqual(stoppedAgain.remnants, first.remnants)
  const deleted = act(stoppedAgain, { type: "delete-remnant", gameId: "ember" })
  assert.deepEqual(deleted.remnants, {})
  assert.equal(act(deleted, { type: "delete-remnant", gameId: "ember" }), deleted)
  assert.equal(stop(deleted), deleted, "A repeated stop cannot recreate a deleted postcard")
  const returned = start(first, "ember", REPLAY)
  const arrived = confirm(returned, "stamp", "ember", REFINISH)
  assert.equal(arrived.remnants.ember, undefined)
  assert.equal(residentsFor(arrived).filter(resident => resident.gameId === "ember").length, 1)
})

test("replay and stopping after arrival preserve resident, contribution, notes and first arrival", () => {
  let state = confirm(confirm(start()), "tier-2")
  state = act(state, { type: "place", gameId: "ember", site: "plot" })
  state = act(state, { type: "note", gameId: "ember", text: "The lantern scene." })
  const replay = start(state, "ember", REPLAY)
  assert.deepEqual(residentsFor(replay), residentsFor(state))
  const stopped = stop(replay, "ember", REFINISH)
  assert.deepEqual(stopped.placements, state.placements)
  assert.deepEqual(stopped.completions, state.completions)
  assert.equal(stopped.notes.ember, "The lantern scene.")
  assert.equal(stopped.remnants.ember, undefined)
  assert.equal(stopped.games.ember, "completed")
})

test("ended replays round-trip with their latest start after the permanent arrival", () => {
  const arrived = confirm(start())
  const stopped = stop(start(arrived, "ember", REPLAY), "ember", REFINISH)
  assert.ok(Date.parse(stopped.completions.ember!) < Date.parse(stopped.started.ember!))
  assert.deepEqual(value(parseDemoSave(JSON.stringify(stopped))), stopped)

  const old = legacy()
  old.games.mosslight = "playing"
  old.started.mosslight = REPLAY
  const migrated = value(parseDemoSave(JSON.stringify(old)))
  const migratedStopped = stop(migrated, "mosslight", REFINISH)
  assert.ok(Date.parse(migratedStopped.completions.mosslight!) < Date.parse(migratedStopped.started.mosslight!))
  assert.deepEqual(value(parseDemoSave(JSON.stringify(migratedStopped))), migratedStopped)
})

test("one active invitation includes replays; invalid dates are rejected", () => {
  const state = start()
  for (const id of ["tide", "mosslight", "paper"] as const) rejected(reduceDemoState(state, { type: "start", gameId: id, at: START }))
  rejected(reduceDemoState(createDemoState(), { type: "confirm", gameId: "ember", target: "stamp", at: FINISH }))
  rejected(reduceDemoState(state, { type: "confirm", gameId: "ember", target: "stamp", at: "2026-09-04T00:00:00Z" }))
  rejected(reduceDemoState(state, { type: "stop", gameId: "ember", at: "2026-09-04T00:00:00Z" }))
  rejected(reduceDemoState(confirm(state), { type: "start", gameId: "ember", at: START }))
  assert.equal(confirm(state, "stamp", "ember", START).completions.ember, START)
  assert.equal(start(createDemoState(), "ember", "2028-02-29T12:00:00Z").started.ember, "2028-02-29T12:00:00Z")
})

test("all six contributions fit beside a preserved legacy home without dropping earned additions", () => {
  const old = legacy()
  old.builtHouse = true
  old.homes.paper = "plot"
  let state = value(parseDemoSave(JSON.stringify(old)))
  for (const [index, game] of GAMES.entries()) {
    if (!state.completions[game.id]) state = confirm(start(state, game.id), "stamp", game.id)
    state = confirm(state, "tier-2", game.id)
    state = act(state, { type: "place", gameId: game.id, site: SITE_IDS[index + 1] })
  }
  assert.equal(Object.keys(state.placements).length, 6)
  assert.equal(residentsFor(state).length, 6)
  assert.equal(state.homes.paper, "plot")
  assert.equal(state.builtHouse, true)
  assert.equal(new Set(Object.values(state.placements)).size, 6)
})

test("v1 migration preserves notes, arrivals, replay, revision and built-home history", () => {
  const old = legacy()
  old.revision = 42
  old.builtHouse = true
  old.games.mosslight = "playing"
  old.started.mosslight = REPLAY
  old.homes.mosslight = "plot"
  old.notes.mosslight = "  Keep my words.\n🌿"
  old.notes.ember = "A possibility"
  const migrated = value(parseDemoSave(JSON.stringify(old)))
  assert.equal(migrated.version, 2)
  assert.equal(migrated.migratedFrom, 1)
  for (const key of ["revision", "builtHouse", "games", "started", "completions", "homes", "notes"] as const) assert.deepEqual(migrated[key], old[key])
  assert.equal(migrated.merits.mosslight, undefined, "Do not invent historical telemetry")
  assert.equal(residentsFor(migrated).length, 2)
  const edited = act(migrated, { type: "rules", gameId: null, rules: { ...defaultRules(), stamp: "Earn 100%" } })
  assert.deepEqual(edited.completions, old.completions)
  const moved = act(edited, { type: "move", gameId: "mosslight", home: "grove" })
  assert.equal(moved.homes.mosslight, "grove")
  rejected(reduceDemoState(confirm(confirm(start()), "tier-2"), { type: "move", gameId: "ember", home: "plot" }))
  rejected(reduceDemoState(createDemoState(), { type: "build" } as unknown as DemoAction))
})

test("v1's active unarrived visitor migrates to an outside invitation, never a resident", () => {
  const old = legacy()
  old.games.ember = "playing"
  old.started.ember = START
  const migrated = value(parseDemoSave(JSON.stringify(old)))
  assert.equal(migrated.games.ember, "playing")
  assert.ok(!residentsFor(migrated).some(resident => resident.gameId === "ember"))
})

test("notes support any known game, retain exact text, enforce limits and clear selectively", () => {
  const initial = createDemoState()
  const text = "  A quiet moment.\n".padEnd(500, "x")
  assert.equal(act(initial, { type: "note", gameId: "ember", text: "" }), initial)
  const noted = act(initial, { type: "note", gameId: "ember", text })
  assert.equal(noted.notes.ember, text)
  assert.equal(act(noted, { type: "note", gameId: "ember", text }), noted)
  rejected(reduceDemoState(noted, { type: "note", gameId: "ember", text: text + "x" }))
  assert.deepEqual(act(noted, { type: "note", gameId: "ember", text: "" }).notes, {})
})

const badActions: [string, unknown][] = [
  ["null", null], ["array", []], ["unsupported free build", { type: "build" }],
  ["unknown type", { type: "reset" }], ["prototype type", { type: "toString" }],
  ["unknown game", { type: "start", gameId: "unknown", at: START }],
  ["prototype game", { type: "note", gameId: "__proto__", text: "hello" }],
  ["missing date", { type: "start", gameId: "ember" }],
  ["numeric date", { type: "start", gameId: "ember", at: 1 }],
  ["non-ISO date", { type: "start", gameId: "ember", at: "September 5, 2026" }],
  ["impossible date", { type: "start", gameId: "ember", at: "2026-02-30T12:00:00Z" }],
  ["non-leap date", { type: "start", gameId: "ember", at: "2026-02-29T12:00:00Z" }],
  ["invalid time", { type: "start", gameId: "ember", at: "2026-09-05T24:00:00Z" }],
  ["local time", { type: "start", gameId: "ember", at: "2026-09-05T18:00:00" }],
  ["invalid target", { type: "confirm", gameId: "ember", target: "platinum", at: FINISH }],
  ["invalid site", { type: "place", gameId: "ember", site: "anywhere" }],
  ["non-string note", { type: "note", gameId: "ember", text: 42 }],
  ["oversized note", { type: "note", gameId: "ember", text: "x".repeat(501) }],
  ["extra fields", { type: "start", gameId: "ember", at: START, verified: true }],
  ["invalid home", { type: "move", gameId: "mosslight", home: "lodge" }],
  ["null defaults", { type: "rules", gameId: null, rules: null }],
  ["no tiers", { type: "rules", gameId: null, rules: { stamp: "Enough", tiers: [] } }],
  ["empty stamp", { type: "rules", gameId: null, rules: { ...defaultRules(), stamp: " " } }],
  ["too many tiers", { type: "rules", gameId: null, rules: { stamp: "Enough", tiers: Array(6).fill(defaultRules().tiers[0]) } }],
  ["duplicate tier ids", { type: "rules", gameId: null, rules: { stamp: "Enough", tiers: Array(2).fill(defaultRules().tiers[0]) } }],
  ["inherited fields", Object.create({ type: "start", gameId: "ember", at: START })],
]
for (const [name, action] of badActions) test(`runtime validation rejects ${name} without mutation`, () => {
  const state = freeze(createDemoState()), before = JSON.stringify(state)
  rejected(reduceDemoState(state, action as DemoAction))
  assert.equal(JSON.stringify(state), before)
})

const base = createDemoState()
const corruptSaves: [string, unknown][] = [
  ["null", null], ["array", []], ["number", 7],
  ["unsupported version", { ...base, version: 3 }],
  ["string version", { ...base, version: "2" }],
  ["missing field", { ...base, rules: undefined }],
  ["unknown field", { ...base, residents: [] }],
  ["negative revision", { ...base, revision: -1 }],
  ["fractional revision", { ...base, revision: 1.5 }],
  ["unsafe revision", { ...base, revision: Number.MAX_SAFE_INTEGER + 1 }],
  ["invalid legacy flag", { ...base, migratedFrom: 2 }],
  ["unearned free house", { ...base, builtHouse: true }],
  ["invalid house flag", { ...base, builtHouse: "true" }],
  ["missing game", { ...base, games: { ...base.games, ember: undefined } }],
  ["unknown game key", { ...base, games: { ...base.games, counterfeit: "backlog" } }],
  ["invalid status", { ...base, games: { ...base.games, ember: "finished" } }],
  ["array map", { ...base, notes: [] }],
  ["unknown date key", { ...base, started: { ...base.started, counterfeit: START } }],
  ["invalid start", { ...base, started: { ...base.started, mosslight: "yesterday" } }],
  ["invalid arrival date", { ...base, completions: { ...base.completions, paper: "2026-02-30T10:00:00Z" } }],
  ["missing start", { ...base, started: {} }],
  ["arrival without date", { ...base, completions: {} }],
  ["arrival without home", { ...base, homes: {} }],
  ["home without arrival", { ...base, homes: { ...base.homes, ember: "grove" } }],
  ["backlog with arrival", { ...base, games: { ...base.games, mosslight: "backlog" } }],
  ["playing without start", { ...base, games: { ...base.games, ember: "playing" } }],
  ["multiple active", { ...base, games: { ...base.games, ember: "playing", tide: "playing" }, started: { ...base.started, ember: START, tide: START } }],
  ["replay before arrival", { ...base, games: { ...base.games, mosslight: "playing" } }],
  ["unbuilt legacy home", { ...base, homes: { ...base.homes, mosslight: "plot" } }],
  ["invalid home", { ...base, homes: { ...base.homes, mosslight: "lodge" } }],
  ["unknown home", { ...base, homes: { ...base.homes, stranger: "grove" } }],
  ["non-string note", { ...base, notes: { ember: 5 } }],
  ["oversized note", { ...base, notes: { ember: "x".repeat(501) } }],
  ["prototype key", { ...base, notes: { ["__proto__"]: "hello" } }],
  ["rules map unknown game", { ...base, rules: { defaults: defaultRules(), games: { stranger: defaultRules() } } }],
  ["unknown tier fields", { ...base, rules: { defaults: { ...defaultRules(), tiers: [{ ...defaultRules().tiers[0], telemetry: true }] }, games: {} } }],
  ["invalid merit", { ...base, merits: { mosslight: { depth: 1, structural: true, history: [] } } }],
  ["invalid remnant date", { ...base, remnants: { ember: "yesterday" } }],
  ["remnant without invitation", { ...base, remnants: { ember: FINISH } }],
  ["resident remnant", { ...base, remnants: { paper: FINISH } }],
  ["unearned placement", { ...base, placements: { paper: "crown" } }],
  ["unsupported site", { ...base, placements: { paper: "freeform" } }],
]
for (const [name, save] of corruptSaves) test(`save validation rejects ${name} rather than resetting`, () => rejected(parseDemoSave(JSON.stringify(save))))

test("invalid legacy saves stay blocked instead of being migrated as fresh worlds", () => {
  const old = legacy()
  for (const save of [
    { ...old, notes: undefined }, { ...old, unknown: true },
    { ...old, homes: { ...old.homes, paper: "plot" } },
    { ...old, games: { ...old.games, ember: "playing" } },
    { ...old, started: { ...old.started, ember: START } },
    { ...old, completions: {} },
  ]) rejected(parseDemoSave(JSON.stringify(save)))
})

test("tampered history and duplicate occupied sites are rejected", () => {
  const earned = confirm(confirm(start()), "tier-2")
  const copy = structuredClone(earned)
  copy.merits.ember!.history.push(copy.merits.ember!.history[0])
  rejected(parseDemoSave(JSON.stringify(copy)))
  const placed = act(earned, { type: "place", gameId: "ember", site: "plot" })
  const another = confirm(placed, "tier-2", "paper")
  rejected(reduceDemoState(another, { type: "place", gameId: "paper", site: "plot" }))
  rejected(parseDemoSave(JSON.stringify({ ...another, placements: { ember: "plot", paper: "plot" } })))
})

test("malformed JSON and runtime states are rejected", () => {
  for (const raw of ["", "{", "undefined", '{"version":1,}', "[] trailing"]) rejected(parseDemoSave(raw))
  rejected(parseDemoSave(null as unknown as string))
  rejected(reduceDemoState(null as unknown as DemoState, { type: "note", gameId: "ember", text: "" }))
})

test("save observations detect same-revision replacements, deletion and corrupt-save changes", () => {
  const state = createDemoState(), raw = JSON.stringify(state), observed = observeDemoSave(raw)
  assert.equal(matchesObservedDemoSave(observed, raw), true)
  assert.equal(matchesObservedDemoSave(observed, null), false)
  assert.equal(matchesObservedDemoSave(observed, JSON.stringify({ ...state, notes: { ember: "Elsewhere" } })), false)
  assert.equal(matchesObservedDemoSave(observeDemoSave(null), null), true)
  assert.equal(matchesObservedDemoSave(observeDemoSave(null), raw), false)
  assert.equal(matchesObservedDemoSave(observeDemoSave("{bad json"), "{bad json"), true)
  assert.equal(matchesObservedDemoSave(observeDemoSave("{bad json"), "{other bad json"), false)
})

test("revision overflow blocks mutations but not idempotent actions", () => {
  const state = { ...createDemoState(), revision: Number.MAX_SAFE_INTEGER }
  rejected(reduceDemoState(state, { type: "start", gameId: "ember", at: START }))
  assert.equal(act(state, { type: "note", gameId: "ember", text: "" }), state)
})

test("fresh worlds share no mutable game or rule objects", () => {
  const first = createDemoState(), second = createDemoState()
  first.rules.defaults.tiers[0].name = "Changed"
  first.notes.ember = "Changed"
  assert.deepEqual(second, createDemoState())
  assert.deepEqual(freeze(second), createDemoState(), "Time and rendering cannot implicitly change proofs")
})
