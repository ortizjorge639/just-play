import test from "node:test"
import assert from "node:assert/strict"
import {
  CONNECTIONS, LOCATIONS, LOCATION_BY_ID, OBSTACLES, SPAWN,
  bridgeEndpoints, canWalk, groundHeight, nearestLocation, routeBetween,
  visibleConnections, visibleLocations,
} from "./world"

test("every platform has its advertised height and a walkable arrival", () => {
  for (const built of [false, true]) {
    for (const location of visibleLocations(built)) {
      assert.equal(groundHeight(location.x, location.z, built), location.y, location.id)
      const [x, y, z] = location.arrival
      assert.equal(groundHeight(x, z, built), y, `${location.id} arrival height`)
      assert.equal(canWalk(x, z, built), true, `${location.id} arrival is blocked`)
      assert.equal(nearestLocation(x, z, built).id, location.id)
    }
  }
  assert.deepEqual(SPAWN, LOCATION_BY_ID.plaza.arrival)
  assert.equal(canWalk(SPAWN[0], SPAWN[2], false), true)
})

test("bridge endpoints overlap both platforms and every point between them is walkable", () => {
  for (const built of [false, true]) {
    for (const [from, to] of visibleConnections(built)) {
      const a = LOCATION_BY_ID[from]
      const b = LOCATION_BY_ID[to]
      const { start, end, length } = bridgeEndpoints(a, b)
      assert.ok(length > 0 && Number.isFinite(length))
      assert.ok(Math.abs(Math.hypot(start.x - a.x, start.z - a.z) - (a.radius - 1)) < 1e-10)
      assert.ok(Math.abs(Math.hypot(end.x - b.x, end.z - b.z) - (b.radius - 1)) < 1e-10)
      assert.equal(groundHeight(start.x, start.z, built), a.y)
      assert.equal(groundHeight(end.x, end.z, built), b.y)
      const ux = (end.x - start.x) / length
      const uz = (end.z - start.z) / length
      // Include the joins on each deck, not only the suspended bridge's middle.
      for (let distance = -0.4; distance <= length + 0.4; distance += 0.05) {
        const x = start.x + ux * distance
        const z = start.z + uz * distance
        const label = `${from} → ${to}, distance ${distance.toFixed(2)}, built=${built}`
        assert.notEqual(groundHeight(x, z, built), null, `Fall-through at ${label}`)
        assert.equal(canWalk(x, z, built), true, `Blocked crossing at ${label}`)
      }
    }
  }
})

test("the suspended bridge follows its elevation profile and has bounded walkable width", () => {
  for (const [from, to] of CONNECTIONS) {
    const { start, end, length } = bridgeEndpoints(LOCATION_BY_ID[from], LOCATION_BY_ID[to])
    const x = (start.x + end.x) / 2
    const z = (start.z + end.z) / 2
    assert.ok(Math.abs(groundHeight(x, z, true)! - ((start.y + end.y) / 2 + 0.35)) < 1e-10)
    const normalX = -(end.z - start.z) / length
    const normalZ = (end.x - start.x) / length
    assert.equal(canWalk(x + normalX, z + normalZ, true), true, `${from} → ${to} inner edge`)
    assert.equal(groundHeight(x + normalX * 1.1, z + normalZ * 1.1, true), null, `${from} → ${to} outer edge`)
  }
})

test("the unbuilt plot and its bridge are absent and inaccessible", () => {
  assert.equal(visibleLocations(false).length, LOCATIONS.length - 1)
  assert.ok(visibleLocations(false).every(location => location.id !== "plot"))
  assert.ok(visibleConnections(false).every(connection => !connection.includes("plot")))
  const plot = LOCATION_BY_ID.plot
  assert.equal(groundHeight(plot.x, plot.z, false), null)
  assert.equal(canWalk(plot.arrival[0], plot.arrival[2], false), false)
  assert.notEqual(nearestLocation(plot.x, plot.z, false).id, "plot")
  const { start, end } = bridgeEndpoints(LOCATION_BY_ID.grove, plot)
  assert.equal(groundHeight((start.x + end.x) / 2, (start.z + end.z) / 2, false), null)
  for (const location of visibleLocations(false)) {
    assert.deepEqual(routeBetween(location.id, "plot", false), [])
    assert.deepEqual(routeBetween("plot", location.id, false), [])
  }
  assert.deepEqual(routeBetween("plot", "plot", false), [])
})

test("the visible graph connects every pair and building adds exactly one branch", () => {
  for (const built of [false, true]) {
    const locations = visibleLocations(built)
    const connections = visibleConnections(built)
    assert.equal(connections.length, locations.length - 1)
    for (const from of locations) {
      for (const to of locations) {
        const route = routeBetween(from.id, to.id, built)
        assert.equal(route[0], from.id)
        assert.equal(route.at(-1), to.id)
        assert.equal(new Set(route).size, route.length, "Routes cannot contain cycles")
        for (let i = 1; i < route.length; i++) {
          assert.ok(connections.some(([a, b]) =>
            (a === route[i - 1] && b === route[i]) || (b === route[i - 1] && a === route[i])))
        }
      }
    }
  }
  assert.equal(visibleLocations(true).length, LOCATIONS.length)
  assert.equal(visibleConnections(true).length, CONNECTIONS.length)
  assert.deepEqual(routeBetween("lodge", "plot", true), ["lodge", "plaza", "grove", "plot"])
  assert.deepEqual(routeBetween("trailhead", "lookout", false), ["trailhead", "plaza", "lookout"])
})

test("trees and buildings block their footprints plus the player's clearance", () => {
  for (const obstacle of OBSTACLES) {
    assert.notEqual(groundHeight(obstacle.x, obstacle.z, true), null)
    for (const built of [false, true]) {
      assert.equal(canWalk(obstacle.x, obstacle.z, built), false)
      const radius = obstacle.radius ?? obstacle.halfX!
      assert.equal(canWalk(obstacle.x + radius + 0.29, obstacle.z, built), false)
      assert.equal(canWalk(obstacle.x + radius + 0.31, obstacle.z, built), true)
    }
  }
  assert.equal(canWalk(38, 8, true), false, "Fern House needs its own obstacle")
  assert.equal(canWalk(40.59, 8, true), false, "Fern House includes player clearance")
  assert.equal(canWalk(40.61, 8, true), true, "Open deck beside Fern House stays walkable")
  assert.equal(canWalk(40.8, 7, true), false, "The expansion tree also blocks movement")
})

test("empty space and non-finite coordinates never become walkable ground", () => {
  for (const built of [false, true]) {
    for (const [x, z] of [[1000, 1000], [-1000, -1000], [NaN, 0], [0, Infinity], [-Infinity, 0]]) {
      assert.equal(groundHeight(x, z, built), null)
      assert.equal(canWalk(x, z, built), false)
    }
  }
})
