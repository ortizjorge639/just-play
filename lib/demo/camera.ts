import { INTERIOR_CENTER, visibleObstacles, groundHeight, type WorldLayout } from "./world"
import type { WorldPoint } from "./navigation"

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
    const halfX = (obstacle.radius ?? obstacle.halfX ?? 0) + 0.35
    const halfZ = (obstacle.radius ?? obstacle.halfZ ?? 0) + 0.35
    const min = [obstacle.x - halfX, base - 0.5, obstacle.z - halfZ]
    const max = [obstacle.x + halfX, base + (obstacle.radius ? 17 : 7), obstacle.z + halfZ]
    const origin = [focus.x, focus.y, focus.z], delta = [dx, dy, dz]
    let enter = 0, exit = 1
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(delta[axis]) < 0.00001) {
        if (origin[axis] < min[axis] || origin[axis] > max[axis]) { enter = 2; break }
      } else {
        const a = (min[axis] - origin[axis]) / delta[axis], b = (max[axis] - origin[axis]) / delta[axis]
        enter = Math.max(enter, Math.min(a, b))
        exit = Math.min(exit, Math.max(a, b))
      }
    }
    if (enter > 0 && enter < exit && enter < fraction) fraction = Math.max(0.08, enter - 0.025)
  }
  return { x: focus.x + dx * fraction, y: focus.y + dy * fraction, z: focus.z + dz * fraction }
}
