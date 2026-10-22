import assert from "node:assert/strict"
import { test } from "node:test"
import { EMOTES, EMOTE_LINES, isEmote, pickEmoteLine } from "./emotes"

test("the same resident and emote always give the same line", () => {
  for (const emote of EMOTES) {
    const first = pickEmoteLine("game-1", emote)
    for (let i = 0; i < 20; i++) assert.equal(pickEmoteLine("game-1", emote), first)
    assert.ok(EMOTE_LINES[emote].includes(first))
  }
})

test("every emote has lines, and only the four are accepted", () => {
  for (const emote of EMOTES) assert.ok(EMOTE_LINES[emote].length >= 3)
  assert.equal(isEmote("wave"), true)
  assert.equal(isEmote("dance"), false)
})
