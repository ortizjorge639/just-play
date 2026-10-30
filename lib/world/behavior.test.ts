import assert from "node:assert/strict"
import test from "node:test"
import { ambientBehavior } from "./behavior"
import { tierFor } from "../settlement/tiers"

test("resident behavior is repeatable and individually phased", () => {
  const sample = ambientBehavior("game-a", 83.5, 3)
  assert.deepEqual(sample, ambientBehavior("game-a", 83.5, 3))
  const a = Array.from({ length: 240 }, (_, t) => ambientBehavior("game-a", t, 3))
  const b = Array.from({ length: 240 }, (_, t) => ambientBehavior("game-b", t, 3))
  assert.notDeepEqual(a, b)
  assert.ok(a.some((pose) => pose.activity === "stroll"))
  assert.ok(a.some((pose) => pose.activity === "greeting"))
})
