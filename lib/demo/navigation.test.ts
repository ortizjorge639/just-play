import test from "node:test"
import assert from "node:assert/strict"
import { clearSegment, findWorldPath } from "./navigation"
import { canWalk, LOCATION_BY_ID, visibleLocations } from "./world"

test("residents can reach every built neighborhood over actual walkable surfaces", () => {
  const [x, y, z] = LOCATION_BY_ID.plaza.arrival
  for (const location of visibleLocations(true)) {
    const [tx, ty, tz] = location.arrival
    const path = findWorldPath({ x, y, z }, { x: tx, y: ty, z: tz }, true)
    assert.ok(path.length > 0, `No route to ${location.id}`)
    for (let i = 1; i < path.length; i++) {
      assert.ok(clearSegment(path[i - 1], path[i], true), `Unsafe route segment to ${location.id}`)
      assert.ok(canWalk(path[i].x, path[i].z, true))
    }
  }
})

test("residents cannot route to the unbuilt branch", () => {
  const [x, y, z] = LOCATION_BY_ID.plaza.arrival
  const [tx, ty, tz] = LOCATION_BY_ID.plot.arrival
  assert.deepEqual(findWorldPath({ x, y, z }, { x: tx, y: ty, z: tz }, false), [])
})

test("a segment through the central trunk is not accepted as a shortcut", () => {
  assert.equal(clearSegment({ x: -6, z: -2 }, { x: 1, z: -2 }, false), false)
})

test("off-grid positions beside the trunk do not cut through it when joining a route", () => {
  const [x, y, z] = LOCATION_BY_ID.lodge.arrival
  for (let i = 0; i < 40; i++) {
    const angle = i * Math.PI / 20
    const from = { x: -3 + Math.cos(angle) * 2.15, y: 0, z: -2 + Math.sin(angle) * 2.15 }
    const path = findWorldPath(from, { x, y, z }, false)
    assert.ok(path.length > 1)
    assert.deepEqual(path[0], from)
    for (let j = 1; j < path.length; j++) {
      assert.ok(clearSegment(path[j - 1], path[j], false), `Trunk clipping from angle ${angle}`)
    }
  }
})
