import test from "node:test"
import assert from "node:assert/strict"
import { DemoInteractionGuard } from "./interaction"
import { createDemoState, observeDemoSave, SAVE_KEY } from "./state"
import { mutateDemoSave, type DemoLockManager } from "./storage"

class HeldLock implements DemoLockManager {
  release: () => void = () => {}
  request<T>(_name: string, callback: () => T | PromiseLike<T>): Promise<T> {
    return new Promise<void>(resolve => { this.release = resolve }).then(callback)
  }
}

for (const choice of ["Back", "Skip", "End tour", "Escape", "modal close", "open another panel"]) {
  test(`${choice} while a save waits for a held lock cannot revive tour navigation`, async () => {
    const guard = new DemoInteractionGuard(), locks = new HeldLock()
    const world = createDemoState()
    let raw: string | null = JSON.stringify(world)
    const storage = {
      getItem: (key: string) => { assert.equal(key, SAVE_KEY); return raw },
      setItem: (_key: string, value: string) => { raw = value },
      removeItem: () => { raw = null },
    }
    const token = guard.capture()
    assert.equal(guard.beginMutation(), true)
    let resumed = false
    const pending = mutateDemoSave(storage, locks, observeDemoSave(raw), world, {
      type: "start", gameId: "ember", at: "2026-09-10T18:00:00Z",
    }).then(result => {
      guard.endMutation()
      if (guard.isCurrent(token)) resumed = true
      return result
    })
    guard.navigate()
    assert.equal(guard.pending, true)
    assert.equal(guard.beginMutation(), false, "A second save must not use a stale same-tab world")
    locks.release()
    assert.equal((await pending).status, "saved")
    assert.equal(resumed, false)
    assert.equal(JSON.parse(raw!).games.ember, "playing", "An authorized save may still finish")
    assert.equal(guard.pending, false)
  })
}

test("conflict recovery choices stay blocked until a held-lock mutation has settled", async () => {
  const guard = new DemoInteractionGuard(), locks = new HeldLock(), world = createDemoState()
  const initial = JSON.stringify(world)
  let raw = initial
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value }, removeItem() {} }
  guard.beginMutation()
  const pending = mutateDemoSave(storage, locks, observeDemoSave(initial), world, { type: "note", gameId: "ember", text: "Held tab" })
  raw = JSON.stringify({ ...world, notes: { ember: "Other tab" } })
  let loaded = false, sessionOnly = false
  const load = () => { if (!guard.pending) loaded = true }
  const keep = () => { if (!guard.pending) sessionOnly = true }
  load(); keep()
  assert.equal(loaded, false)
  assert.equal(sessionOnly, false)
  locks.release()
  const result = await pending
  assert.equal(result.status, "conflict")
  assert.equal(JSON.parse(raw).notes.ember, "Other tab")
  guard.endMutation()
  load()
  assert.equal(loaded, true)
})
