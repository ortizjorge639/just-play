import { canWalk, groundHeight } from "./world"

export interface WorldPoint { x: number; y: number; z: number }
const STEP = 0.6
const MIN_X = -31, MAX_X = 46, MIN_Z = -34, MAX_Z = 30
const key = (x: number, z: number) => `${x},${z}`

function nearestCell(point: Pick<WorldPoint, "x" | "z">, built: boolean) {
  const x = Math.round(point.x / STEP), z = Math.round(point.z / STEP)
  for (let radius = 0; radius <= 4; radius++) {
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue
      if (clearSegment(point, { x: (x + dx) * STEP, z: (z + dz) * STEP }, built)) {
        return { x: x + dx, z: z + dz }
      }
    }
  }
  return null
}

export function clearSegment(from: Pick<WorldPoint, "x" | "z">, to: Pick<WorldPoint, "x" | "z">, built: boolean) {
  const count = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.18)
  for (let i = 0; i <= count; i++) {
    const t = count ? i / count : 0
    if (!canWalk(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, built)) return false
  }
  return true
}

/** A small grid over the authored surfaces keeps residents on the same paths as the player. */
export function findWorldPath(from: WorldPoint, to: WorldPoint, built: boolean): WorldPoint[] {
  if (!canWalk(from.x, from.z, built) || !canWalk(to.x, to.z, built)) return []
  const start = nearestCell(from, built), goal = nearestCell(to, built)
  if (!start || !goal) return []
  type Cell = { x: number; z: number; score: number; cost: number }
  const open: Cell[] = [{ ...start, score: 0, cost: 0 }]
  const parent = new Map<string, string>()
  const costs = new Map<string, number>([[key(start.x, start.z), 0]])
  const closed = new Set<string>()
  while (open.length) {
    open.sort((a, b) => b.score - a.score)
    const current = open.pop()!
    const currentKey = key(current.x, current.z)
    if (closed.has(currentKey)) continue
    if (current.x === goal.x && current.z === goal.z) {
      const path: WorldPoint[] = []
      let cursor: string | undefined = currentKey
      while (cursor) {
        const [cx, cz] = cursor.split(",").map(Number)
        path.unshift({ x: cx * STEP, y: groundHeight(cx * STEP, cz * STEP, built) ?? from.y, z: cz * STEP })
        cursor = parent.get(cursor)
      }
      path.unshift(from)
      path.push(to)
      const simplified: WorldPoint[] = [from]
      let index = 0
      while (index < path.length - 1) {
        let next = path.length - 1
        while (next > index + 1 && !clearSegment(path[index], path[next], built)) next--
        simplified.push(path[next])
        index = next
      }
      return simplified
    }
    closed.add(currentKey)
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue
      const nx = current.x + dx, nz = current.z + dz
      if (nx * STEP < MIN_X || nx * STEP > MAX_X || nz * STEP < MIN_Z || nz * STEP > MAX_Z) continue
      const nextKey = key(nx, nz)
      if (closed.has(nextKey) || !canWalk(nx * STEP, nz * STEP, built)) continue
      if (dx && dz && (!canWalk(current.x * STEP, nz * STEP, built) || !canWalk(nx * STEP, current.z * STEP, built))) continue
      const cost = current.cost + Math.hypot(dx, dz)
      if (cost >= (costs.get(nextKey) ?? Infinity)) continue
      costs.set(nextKey, cost)
      parent.set(nextKey, currentKey)
      open.push({ x: nx, z: nz, cost, score: cost + Math.hypot(goal.x - nx, goal.z - nz) })
    }
  }
  return []
}
