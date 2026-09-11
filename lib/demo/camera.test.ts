import test from "node:test"
import assert from "node:assert/strict"
import { unobstructedCamera } from "./camera"
import { canWalk, INTERIOR_CENTER } from "./world"

test("the camera stays on the near side of an intervening house", () => {
  const focus = { x: 17, y: 4.5, z: 0 }
  const camera = unobstructedCamera(focus, { x: 17, y: 7, z: -15 }, false, false)
  assert.ok(camera.z > -4, "Camera went through the grove house")
})

test("unobstructed camera views are unchanged", () => {
  const desired = { x: 8, y: 17, z: 30 }
  assert.deepEqual(unobstructedCamera({ x: 1, y: 2, z: 6 }, desired, false, false), desired)
})

test("a legal focus inside a trunk proxy cannot send the camera through the trunk", () => {
  const focus = { x: -0.875, y: 2.4, z: -2 }
  const desired = { x: -6, y: 3, z: -2 }
  assert.equal(canWalk(focus.x, focus.z, false), true)
  assert.ok(Math.hypot(focus.x + 3, focus.z + 2) < 1.8 + 0.35)

  const camera = unobstructedCamera(focus, desired, false, false)
  assert.notDeepEqual(camera, desired)

  const dx = camera.x - focus.x
  const dz = camera.z - focus.z
  const lengthSquared = dx * dx + dz * dz
  const closest = Math.max(0, Math.min(1, ((-3 - focus.x) * dx + (-2 - focus.z) * dz) / lengthSquared))
  assert.ok(Math.hypot(focus.x + dx * closest + 3, focus.z + dz * closest + 2) >= 1.8)
  assert.ok(Math.hypot(camera.x + 3, camera.z + 2) >= 1.8)

  const outward = { x: 2, y: 3, z: -2 }
  assert.deepEqual(unobstructedCamera(focus, outward, false, false), outward)
})

test("the room camera cannot drift through the side walls", () => {
  const camera = unobstructedCamera({ x: INTERIOR_CENTER, y: 1, z: 0 }, { x: INTERIOR_CENTER + 20, y: 7, z: -12 }, false, true)
  assert.equal(camera.x, INTERIOR_CENTER + 4.7)
  assert.equal(camera.z, -4.7)
})
