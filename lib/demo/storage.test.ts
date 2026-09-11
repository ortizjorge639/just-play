import test from "node:test"
import assert from "node:assert/strict"
import { createDemoState, observeDemoSave, SAVE_KEY } from "./state"
import {
  mutateDemoSave, resetDemoSave, SAVE_LOCK_NAME, type DemoLockManager, type DemoStorage,
} from "./storage"

class MemoryStorage implements DemoStorage {
  value: string | null

  constructor(value: string | null) {
    this.value = value
  }

  getItem(key: string) {
    assert.equal(key, SAVE_KEY)
    return this.value
  }

  setItem(key: string, value: string) {
    assert.equal(key, SAVE_KEY)
    this.value = value
  }

  removeItem(key: string) {
    assert.equal(key, SAVE_KEY)
    this.value = null
  }
}

class QueuedLocks implements DemoLockManager {
  private tail = Promise.resolve()

  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T> {
    assert.equal(name, SAVE_LOCK_NAME)
    const result = this.tail.then(callback)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
}

test("interleaved writers serialize and the stale writer cannot overwrite the winner", async () => {
  const initial = createDemoState()
  const raw = JSON.stringify(initial)
  const storage = new MemoryStorage(raw)
  const locks = new QueuedLocks()
  const observed = observeDemoSave(raw)

  const first = mutateDemoSave(storage, locks, observed, initial, {
    type: "note", gameId: "ember", text: "First tab",
  })
  const second = mutateDemoSave(storage, locks, observed, initial, {
    type: "note", gameId: "ember", text: "Second tab",
  })
  const [saved, conflicted] = await Promise.all([first, second])

  assert.equal(saved.status, "saved")
  assert.equal(conflicted.status, "conflict")
  assert.equal(conflicted.status === "conflict" && conflicted.world.notes.ember, "Second tab")
  assert.equal(JSON.parse(storage.value!).notes.ember, "First tab")
})

test("serial actions use the latest committed world and observation", async () => {
  const initial = createDemoState()
  const raw = JSON.stringify(initial)
  const storage = new MemoryStorage(raw)
  const locks = new QueuedLocks()
  const first = await mutateDemoSave(storage, locks, observeDemoSave(raw), initial, {
    type: "note", gameId: "ember", text: "Remember this",
  })
  assert.equal(first.status, "saved")
  if (first.status !== "saved") return

  const second = await mutateDemoSave(storage, locks, first.observed, first.world, { type: "start", gameId: "ember", at: "2026-09-10T18:00:00.000Z" })
  assert.equal(second.status, "saved")
  if (second.status !== "saved") return
  assert.equal(second.world.notes.ember, "Remember this")
  assert.equal(second.world.games.ember, "playing")
  assert.equal(second.world.revision, 2)
})

test("reset removes the exact corrupt save after continuing session-only", async () => {
  const storage = new MemoryStorage("{bad json")
  const result = await resetDemoSave(storage, new QueuedLocks(), observeDemoSave(storage.value))

  assert.equal(result.status, "removed")
  assert.equal(storage.value, null)
})

test("reset from conflict mode preserves a different persisted save", async () => {
  const initial = createDemoState()
  const original = JSON.stringify(initial)
  const newer = JSON.stringify({ ...initial, notes: { ember: "Other tab" } })
  const storage = new MemoryStorage(newer)
  const result = await resetDemoSave(storage, new QueuedLocks(), observeDemoSave(original))

  assert.equal(result.status, "conflict")
  assert.equal(storage.value, newer)
})
