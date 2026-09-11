import test from "node:test"
import assert from "node:assert/strict"
import { Mesh } from "three"
import type { DemoState, GameId, SiteId } from "./contracts"
import { createDemoState, GAMES, SITE_IDS } from "./state"
import { buildContributions, buildVillage, disposeVillage } from "../../components/demo/geometry"
import {
  availableSites, bridgeEndpoints, canWalk, contributionObstacle, groundHeight, LOCATION_BY_ID,
  routeBetween, visibleConnections, visibleLocations,
} from "./world"
import { clearSegment, findWorldPath } from "./navigation"
import { unobstructedCamera } from "./camera"

function placed(site: SiteId): DemoState {
  return { ...createDemoState(), placements: { ember: site } }
}

test("every authored site activates geometry topology, path, obstacles and map only upon placement", () => {
  for (const site of SITE_IDS) {
    const base = createDemoState(), world = placed(site)
    const destination = LOCATION_BY_ID[site]
    assert.ok(availableSites(base).includes(site))
    assert.ok(!visibleLocations(base).some(location => location.id === site))
    assert.deepEqual(routeBetween("plaza", site, base), [])
    assert.equal(canWalk(destination.arrival[0], destination.arrival[2], base), false)
    assert.ok(!availableSites(world).includes(site))
    assert.ok(visibleLocations(world).some(location => location.id === site))
    assert.equal(visibleConnections(world).length, 5)
    assert.ok(routeBetween("plaza", site, world).length > 1)
    assert.ok(canWalk(destination.arrival[0], destination.arrival[2], world))
    const obstruction = contributionObstacle(site)
    assert.equal(canWalk(obstruction.x, obstruction.z, world), false, `${site}: themed furniture needs collision`)
    const focus = { x: obstruction.x, y: destination.y + 1.5, z: obstruction.z + 3 }
    const desired = { ...focus, z: obstruction.z - 4 }
    assert.ok(unobstructedCamera(focus, desired, world, false).z > desired.z, `${site}: camera must honor furniture`)
    for (const [a, b] of visibleConnections(world)) {
      const { start, end, length } = bridgeEndpoints(LOCATION_BY_ID[a], LOCATION_BY_ID[b])
      for (let d = -0.35; d <= length + 0.35; d += 0.1) {
        const x = start.x + (end.x - start.x) * d / length, z = start.z + (end.z - start.z) * d / length
        assert.notEqual(groundHeight(x, z, world), null, `${a}→${b}: disconnected deck join`)
        assert.ok(canWalk(x, z, world), `${a}→${b}: collision on bridge at ${x},${z}`)
      }
    }
    const [x, y, z] = LOCATION_BY_ID.plaza.arrival
    const [tx, ty, tz] = destination.arrival
    const path = findWorldPath({ x, y, z }, { x: tx, y: ty, z: tz }, world)
    assert.ok(path.length > 1, `Missing navigation to ${site}`)
    for (let i = 1; i < path.length; i++) assert.ok(clearSegment(path[i - 1], path[i], world), `${site}: unsafe A* segment`)
  }
})

test("legacy home and all six additions remain connected with one vacancy per earned placement", () => {
  const world: DemoState = {
    ...createDemoState(), builtHouse: true, migratedFrom: 1,
    placements: Object.fromEntries(GAMES.map((game, index) => [game.id, SITE_IDS[index + 1]])),
  }
  assert.equal(availableSites(world).length, 0)
  assert.equal(visibleLocations(world).length, 12)
  assert.equal(visibleConnections(world).length, 11)
  for (const site of SITE_IDS) assert.ok(routeBetween("trailhead", site, world).length > 1)
})

test("six authored themes, postcards and full settlement stay finite and within explicit batched budgets", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document")
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) },
  })
  try {
    const world: DemoState = {
      ...createDemoState(), builtHouse: true, migratedFrom: 1,
      completions: Object.fromEntries(GAMES.map(game => [game.id, "2026-09-10T18:00:00Z"])),
      merits: Object.fromEntries(GAMES.map(game => [game.id, { depth: 5, structural: true, history: [] }])),
      placements: Object.fromEntries(GAMES.map((game, index) => [game.id, SITE_IDS[index + 1]])),
    }
    const groups = [buildVillage(world), buildContributions(world)]
    let meshes = 0, triangles = 0
    for (const group of groups) group.traverse(object => {
      if (!(object instanceof Mesh)) return
      meshes++
      const positions = object.geometry.getAttribute("position")
      triangles += (object.geometry.index?.count ?? positions.count) / 3
      for (const coordinate of positions.array) assert.ok(Number.isFinite(coordinate))
    })
    assert.ok(meshes <= 80, `Full settlement with six contributions: ${meshes} meshes, budget 80`)
    assert.ok(triangles <= 180_000, `Full settlement with six contributions: ${triangles} triangles, budget 180,000`)
    groups.forEach(disposeVillage)
    const signatures = new Set<string>()
    for (const game of GAMES) {
      const group = buildContributions({ ...world, completions: { [game.id]: "2026-09-10T18:00:00Z" }, placements: { [game.id]: "brook" } })
      const counts: number[] = []
      group.traverse(object => { if (object instanceof Mesh) counts.push(object.geometry.getAttribute("position").count) })
      signatures.add(JSON.stringify(counts))
      disposeVillage(group)
    }
    assert.equal(signatures.size, 6, "Each game needs visibly distinct authored geometry")
    const postcards = buildContributions({
      completions: {}, placements: {}, merits: {},
      remnants: Object.fromEntries(GAMES.map(game => [game.id, "2026-09-10T18:00:00Z"])) as Record<GameId, string>,
    })
    assert.ok(postcards.children.length > 0)
    disposeVillage(postcards)
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous)
    else Reflect.deleteProperty(globalThis, "document")
  }
})
