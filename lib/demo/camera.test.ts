import test from "node:test"
import assert from "node:assert/strict"
import { unobstructedCamera } from "./camera"
import { INTERIOR_CENTER } from "./world"

test("the camera stays on the near side of an intervening house", () => {
  const focus = { x: 17, y: 4.5, z: 0 }
  const camera = unobstructedCamera(focus, { x: 17, y: 7, z: -15 }, false, false)
  assert.ok(camera.z > -4, "Camera went through the grove house")
})

test("unobstructed camera views are unchanged", () => {
  const desired = { x: 8, y: 17, z: 30 }
  assert.deepEqual(unobstructedCamera({ x: 1, y: 2, z: 6 }, desired, false, false), desired)
})

test("the room camera cannot drift through the side walls", () => {
  const camera = unobstructedCamera({ x: INTERIOR_CENTER, y: 1, z: 0 }, { x: INTERIOR_CENTER + 20, y: 7, z: -12 }, false, true)
  assert.equal(camera.x, INTERIOR_CENTER + 4.7)
  assert.equal(camera.z, -4.7)
})
