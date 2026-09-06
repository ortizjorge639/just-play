import type { DemoAction, DemoState, Result } from "./contracts"
import {
  matchesObservedDemoSave, observeDemoSave, reduceDemoState, SAVE_KEY,
  type DemoSaveObservation,
} from "./state"

export const SAVE_LOCK_NAME = `${SAVE_KEY}:mutation`

export type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
export type DemoLockManager = {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>
}

export type SaveMutation =
  | { status: "saved"; world: DemoState; observed: DemoSaveObservation }
  | { status: "unchanged"; world: DemoState; observed: DemoSaveObservation }
  | { status: "conflict"; world: DemoState; observed: DemoSaveObservation }
  | { status: "rejected"; error: string }

export type ResetMutation =
  | { status: "removed"; observed: DemoSaveObservation }
  | { status: "conflict"; observed: DemoSaveObservation }

export function getDemoLockManager(): DemoLockManager | null {
  if (typeof navigator === "undefined" || !navigator.locks) return null
  return navigator.locks
}

export function mutateDemoSave(
  storage: DemoStorage,
  locks: DemoLockManager,
  observed: DemoSaveObservation,
  world: DemoState,
  action: DemoAction,
): Promise<SaveMutation> {
  return locks.request(SAVE_LOCK_NAME, () => {
    const currentRaw = storage.getItem(SAVE_KEY)
    const result: Result<DemoState> = reduceDemoState(world, action)
    if (!result.ok) return { status: "rejected", error: result.error }
    if (!matchesObservedDemoSave(observed, currentRaw)) {
      return { status: "conflict", world: result.value, observed }
    }
    if (result.value === world) return { status: "unchanged", world, observed }
    const serialized = JSON.stringify(result.value)
    storage.setItem(SAVE_KEY, serialized)
    return { status: "saved", world: result.value, observed: observeDemoSave(serialized) }
  })
}

export function resetDemoSave(
  storage: DemoStorage,
  locks: DemoLockManager,
  observed: DemoSaveObservation,
): Promise<ResetMutation> {
  return locks.request(SAVE_LOCK_NAME, () => {
    const currentRaw = storage.getItem(SAVE_KEY)
    if (!matchesObservedDemoSave(observed, currentRaw)) return { status: "conflict", observed }
    storage.removeItem(SAVE_KEY)
    return { status: "removed", observed: observeDemoSave(null) }
  })
}
