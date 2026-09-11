import { INTERIOR_CENTER, visibleObstacles, groundHeight, type WorldLayout } from "./world"
import type { WorldPoint } from "./navigation"

function axisInterval(origin: number, delta: number, min: number, max: number): [number, number] | null {
  if (Math.abs(delta) < 0.00001) return origin < min || origin > max ? null : [-Infinity, Infinity]
  const a = (min - origin) / delta
  const b = (max - origin) / delta
  return [Math.min(a, b), Math.max(a, b)]
}

function boxIntersection(
  origin: readonly number[],
  delta: readonly number[],
  min: readonly number[],
  max: readonly number[],
): [number, number] | null {
  let enter = 0
  let exit = 1
  for (let axis = 0; axis < 3; axis++) {
    const interval = axisInterval(origin[axis], delta[axis], min[axis], max[axis])
    if (!interval) return null
    enter = Math.max(enter, interval[0])
    exit = Math.min(exit, interval[1])
  }
  return enter < exit ? [enter, exit] : null
}

function trunkIntersection(
  focus: WorldPoint,
  delta: WorldPoint,
  x: number,
  z: number,
  radius: number,
  minY: number,
  maxY: number,
): [number, number] | null {
  const ox = focus.x - x
  const oz = focus.z - z
  const a = delta.x * delta.x + delta.z * delta.z
  if (a < 0.00001) return null
  const b = 2 * (ox * delta.x + oz * delta.z)
  const c = ox * ox + oz * oz - radius * radius
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  const root = Math.sqrt(discriminant)
  const radial: [number, number] = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
  const vertical = axisInterval(focus.y, delta.y, minY, maxY)
  if (!vertical) return null
  const enter = Math.max(0, radial[0], vertical[0])
  const exit = Math.min(1, radial[1], vertical[1])
  return enter < exit ? [enter, exit] : null
}

/** Pull the camera in before a building or trunk obscures its subject. */
export function unobstructedCamera(focus: WorldPoint, desired: WorldPoint, built: WorldLayout, inside: boolean): WorldPoint {
  if (inside) return {
    x: Math.max(INTERIOR_CENTER - 4.7, Math.min(INTERIOR_CENTER + 4.7, desired.x)),
    y: Math.max(1.5, desired.y),
    z: Math.max(-4.7, desired.z),
  }
  const dx = desired.x - focus.x, dy = desired.y - focus.y, dz = desired.z - focus.z
  let fraction = 1
  for (const obstacle of visibleObstacles(built)) {
    const base = groundHeight(obstacle.x, obstacle.z, built) ?? 0
    const intersection = obstacle.radius
      ? trunkIntersection(focus, { x: dx, y: dy, z: dz }, obstacle.x, obstacle.z, obstacle.radius + 0.35, base - 0.5, base + 17)
      : boxIntersection(
        [focus.x, focus.y, focus.z],
        [dx, dy, dz],
        [obstacle.x - (obstacle.halfX ?? 0) - 0.35, base - 0.5, obstacle.z - (obstacle.halfZ ?? 0) - 0.35],
        [obstacle.x + (obstacle.halfX ?? 0) + 0.35, base + 7, obstacle.z + (obstacle.halfZ ?? 0) + 0.35],
      )
    if (intersection && intersection[0] > 0 && intersection[0] < fraction) {
      fraction = Math.max(0.08, intersection[0] - 0.025)
    }
  }
  return { x: focus.x + dx * fraction, y: focus.y + dy * fraction, z: focus.z + dz * fraction }
}
