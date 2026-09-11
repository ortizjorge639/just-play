import type { DemoState, GameId, LocationId, SiteId, WorldLocation } from "./contracts"
import { CONTRIBUTIONS, SITE_IDS } from "./state"

export type WorldLayout = boolean | Pick<DemoState, "builtHouse" | "placements">

export const LOCATIONS: readonly WorldLocation[] = [
  { id: "plaza", title: "The gathering tree", subtitle: "A little world, made of the games that stay with you.", x: 0, y: 0, z: 0, radius: 10, arrival: [1, 0, 6] },
  { id: "trailhead", title: "The next adventure", subtitle: "Every journey begins with a little curiosity.", x: -6, y: -1, z: 22, radius: 6, arrival: [-6, -1, 24] },
  { id: "lodge", title: "Travelers' lodge", subtitle: "An old shelter on the canopy path. Invitations travel beyond the tree.", x: -21, y: 2, z: -2, radius: 7, arrival: [-20, 2, 2] },
  { id: "grove", title: "The resident grove", subtitle: "Some adventures end. Their people stay.", x: 20, y: 3, z: -5, radius: 8, arrival: [19, 3, 0] },
  { id: "lookout", title: "A moment above it all", subtitle: "Nothing to finish. Just something to admire.", x: 0, y: 5, z: -25, radius: 6, arrival: [0, 5, -23] },
  { id: "plot", title: "Fern House", subtitle: "Another branch. Another place to belong.", x: 37, y: 4, z: 10, radius: 6, arrival: [36, 4, 13] },
  { id: "brook", title: "Brook branch", subtitle: "An eastern branch beside the grove.", x: 30, y: 4, z: -23, radius: 5, arrival: [30, 4, -21] },
  { id: "crown", title: "Crown branch", subtitle: "A high branch beyond the lookout.", x: 12, y: 6, z: -40, radius: 5, arrival: [12, 6, -38] },
  { id: "fern", title: "Fern branch", subtitle: "A quiet branch west of the lookout.", x: -18, y: 5, z: -29, radius: 5, arrival: [-18, 5, -27] },
  { id: "dusk", title: "Dusk branch", subtitle: "An evening perch beyond the lodge.", x: -39, y: 3, z: -7, radius: 5, arrival: [-39, 3, -5] },
  { id: "meadow", title: "Meadow branch", subtitle: "A sheltered branch south of the lodge.", x: -27, y: 1, z: 17, radius: 5, arrival: [-27, 1, 19] },
  { id: "sunrise", title: "Sunrise branch", subtitle: "A bright branch near the trailhead.", x: 12, y: 0, z: 25, radius: 5, arrival: [12, 0, 27] },
]

export const CONNECTIONS: readonly (readonly [LocationId, LocationId])[] = [
  ["plaza", "trailhead"], ["plaza", "lodge"], ["plaza", "grove"],
  ["plaza", "lookout"], ["grove", "plot"],
  ["grove", "brook"], ["lookout", "crown"], ["lookout", "fern"],
  ["lodge", "dusk"], ["lodge", "meadow"], ["trailhead", "sunrise"],
]

export const LOCATION_BY_ID = Object.fromEntries(
  LOCATIONS.map(location => [location.id, location]),
) as Record<LocationId, WorldLocation>

export const DOOR: readonly [number, number, number] = [17, 3, -3.1]
export const INTERIOR_CENTER = 190
export const SPAWN = LOCATION_BY_ID.plaza.arrival

export interface Obstacle { x: number; z: number; radius?: number; halfX?: number; halfZ?: number }
export const OBSTACLES: readonly Obstacle[] = [
  { x: -3, z: -2, radius: 1.8 },
  { x: -23, z: -4, halfX: 2.5, halfZ: 2.2 },
  { x: -19, z: -6, radius: 0.9 },
  { x: 17, z: -6.5, halfX: 2.4, halfZ: 2.2 },
  { x: 24, z: -6.5, halfX: 1.8, halfZ: 1.8 },
  { x: 22, z: -10, radius: 1.1 },
  { x: -3, z: -27, radius: 0.9 },
  { x: -9, z: 23, radius: 0.6 },
]
const EXPANDED_OBSTACLES: readonly Obstacle[] = [
  ...OBSTACLES,
  { x: 38, z: 8, halfX: 2.3, halfZ: 2.1 },
  { x: 40, z: 7, radius: 0.75 },
]

export function legacyBuilt(layout: WorldLayout) {
  return typeof layout === "boolean" ? layout : layout.builtHouse
}

export function isLocationVisible(id: LocationId, layout: WorldLayout) {
  if (!SITE_IDS.includes(id as SiteId)) return true
  return id === "plot" && legacyBuilt(layout) ||
    typeof layout !== "boolean" && Object.values(layout.placements).includes(id as SiteId)
}

export function contributionObstacle(site: SiteId): Obstacle {
  const point = LOCATION_BY_ID[site]
  return { x: point.x, z: point.z - 1.7, halfX: 1.65, halfZ: 1.15 }
}

export function visibleObstacles(layout: WorldLayout) {
  return [
    ...(legacyBuilt(layout) ? EXPANDED_OBSTACLES : OBSTACLES),
    ...(typeof layout === "boolean" ? [] : Object.values(layout.placements).map(contributionObstacle)),
  ]
}

export function visibleLocations(layout: WorldLayout) {
  return LOCATIONS.filter(location => isLocationVisible(location.id, layout))
}

export function visibleConnections(layout: WorldLayout) {
  return CONNECTIONS.filter(([a, b]) => isLocationVisible(a, layout) && isLocationVisible(b, layout))
}

export function availableSites(layout: DemoState) {
  return SITE_IDS.filter(site => !isLocationVisible(site, layout))
}

export function locationTitle(id: LocationId, layout: WorldLayout) {
  const game = typeof layout === "boolean" ? undefined :
    (Object.entries(layout.placements) as [GameId, SiteId][]).find(([, site]) => site === id)?.[0]
  return game ? `${CONTRIBUTIONS[game].structure} · ${id === "plot" ? "Grove branch" : LOCATION_BY_ID[id].title}` : LOCATION_BY_ID[id].title
}

export function bridgeEndpoints(a: WorldLocation, b: WorldLocation) {
  const dx = b.x - a.x, dz = b.z - a.z
  const length = Math.hypot(dx, dz)
  const ux = dx / length, uz = dz / length
  const start = { x: a.x + ux * (a.radius - 1), y: a.y, z: a.z + uz * (a.radius - 1) }
  const end = { x: b.x - ux * (b.radius - 1), y: b.y, z: b.z - uz * (b.radius - 1) }
  return { start, end, length: Math.hypot(end.x - start.x, end.z - start.z) }
}

export function groundHeight(x: number, z: number, built: WorldLayout): number | null {
  for (const location of visibleLocations(built)) {
    if (Math.hypot(x - location.x, z - location.z) < location.radius - 0.55) return location.y
  }
  for (const [from, to] of visibleConnections(built)) {
    const { start, end } = bridgeEndpoints(LOCATION_BY_ID[from], LOCATION_BY_ID[to])
    const dx = end.x - start.x, dz = end.z - start.z
    const lengthSquared = dx * dx + dz * dz
    const t = ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared
    const distance = Math.abs((x - start.x) * dz - (z - start.z) * dx) / Math.sqrt(lengthSquared)
    if (t >= -0.08 && t <= 1.08 && distance < 1.02) {
      const progress = Math.max(0, Math.min(1, t))
      return start.y + (end.y - start.y) * progress + Math.sin(progress * Math.PI) * 0.35
    }
  }
  return null
}

export function canWalk(x: number, z: number, built: WorldLayout) {
  if (groundHeight(x, z, built) === null) return false
  return !visibleObstacles(built).some(obstacle => obstacle.radius
    ? Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + 0.3
    : Math.abs(x - obstacle.x) < (obstacle.halfX ?? 0) + 0.3 && Math.abs(z - obstacle.z) < (obstacle.halfZ ?? 0) + 0.3)
}

export function nearestLocation(x: number, z: number, built: WorldLayout): WorldLocation {
  return visibleLocations(built).reduce((nearest, location) =>
    Math.hypot(location.x - x, location.z - z) < Math.hypot(nearest.x - x, nearest.z - z) ? location : nearest)
}

export function routeBetween(from: LocationId, to: LocationId, built: WorldLayout): LocationId[] {
  if (!isLocationVisible(from, built) || !isLocationVisible(to, built)) return []
  const queue: LocationId[][] = [[from]]
  const visited = new Set<LocationId>([from])
  const connections = visibleConnections(built)
  while (queue.length) {
    const path = queue.shift()!
    const current = path[path.length - 1]
    if (current === to) return path
    for (const [a, b] of connections) {
      const next = a === current ? b : b === current ? a : null
      if (next && !visited.has(next)) {
        visited.add(next)
        queue.push([...path, next])
      }
    }
  }
  return []
}
