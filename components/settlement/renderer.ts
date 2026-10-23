import {
  ACESFilmicToneMapping, Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh,
  MeshStandardMaterial, OrthographicCamera, Scene, SphereGeometry, SRGBColorSpace,
  BoxGeometry, ConeGeometry, DoubleSide, RingGeometry, Vector3, WebGLRenderer, type BufferGeometry, type Material, type Object3D,
} from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import type { Resident, SettlementPiece } from "@/lib/types"
import type { Layout } from "@/lib/settlement/types"
import { PARTS } from "@/lib/settlement/catalog"
import { DECK_CAPACITY } from "@/lib/settlement/layout"
import { anchorOffset, deckOrigin, slotOffset } from "@/lib/settlement/transforms"

export const DECK_URL = "/canopy/hearth-deck-64bdc8e0.glb"

const FAMILY_COLOUR: Record<string, string> = {
  cozy: "#e8b46a", fantasy: "#a98bd6", puzzle: "#7fb6dc", action: "#dc7f86", other: "#b9b0a2",
}

async function loadGroup(url: string, signal: AbortSignal): Promise<Group> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`${url} could not load (HTTP ${response.status}).`)
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "")
  return gltf.scene
}

// The exported deck sits at the old world's plot site (the ATTACH_plot marker). Move that site to
// the origin, with the floor at y = 0, and find where the bridge reaches out.
const PLOT = new Vector3(37, 4, 10)
const PLATFORM_RADIUS = 6

function recentre(group: Group): { holder: Group; tipAngle: number; tipLength: number } {
  group.updateMatrixWorld(true)
  const point = new Vector3()
  let tipLength = 0, tipAngle = 0
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const position = object.geometry.getAttribute("position")
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld)
      const dx = point.x - PLOT.x, dz = point.z - PLOT.z
      const length = Math.hypot(dx, dz)
      if (length > tipLength) { tipLength = length; tipAngle = Math.atan2(dz, dx) }
    }
  })
  const holder = new Group()
  group.position.sub(PLOT)
  holder.add(group)
  return { holder, tipAngle, tipLength }
}

function disposeTree(root: Object3D) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>()
  root.traverse((object) => {
    if (object instanceof Mesh) {
      geometries.add(object.geometry)
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m)
    }
  })
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
}

export async function mountSettlement(
  host: HTMLElement,
  layout: Layout,
  signal: AbortSignal,
  onSelect?: (gameId: Resident["game_id"]) => void,
  pieces: readonly SettlementPiece[] = [],
) {
  const scene = new Scene()
  scene.background = new Color("#cdd9c4")
  scene.add(new HemisphereLight("#fff0d5", "#716451", 2.1))
  const sun = new DirectionalLight("#ffe1a3", 2.4)
  sun.position.set(-8, 14, 6)
  scene.add(sun)

  const deckSource = await loadGroup(DECK_URL, signal)
  const { holder: deckTemplate, tipAngle, tipLength } = recentre(deckSource)

  const assetUrls = [...new Set(PARTS.map((p) => p.asset).filter((a): a is string => !!a))]
  const assetTemplates = new Map<string, Group>()
  await Promise.all(assetUrls.map(async (url) => {
    assetTemplates.set(url, await loadGroup(url, signal))
  }))
  if (signal.aborted) throw new DOMException("Aborted", "AbortError")

  const standIn = new SphereGeometry(0.4, 16, 12)
  const standInMaterials = new Map<string, MeshStandardMaterial>()
  const partById = new Map(PARTS.map((p) => [p.id, p]))

  const plank = new BoxGeometry(1, 0.25, 1)
  const plankMaterial = new MeshStandardMaterial({ color: "#b98a4e", roughness: 0.85 })
  for (const deck of layout.decks) {
    const origin = deckOrigin(deck.index)
    const deckGroup = deckTemplate.clone(true)
    deckGroup.position.set(origin.x, 0, origin.z)
    if (deck.parent !== null) {
      // Turn the deck so its own bridge points at the deck it hangs from, then lay planks across the gap.
      const parent = deckOrigin(deck.parent)
      const toParent = Math.atan2(parent.z - origin.z, parent.x - origin.x)
      deckGroup.rotation.y = tipAngle - toParent
      const tip = { x: origin.x + Math.cos(toParent) * tipLength, z: origin.z + Math.sin(toParent) * tipLength }
      const edge = { x: parent.x - Math.cos(toParent) * PLATFORM_RADIUS, z: parent.z - Math.sin(toParent) * PLATFORM_RADIUS }
      const length = Math.hypot(edge.x - tip.x, edge.z - tip.z)
      if (length > 0.5) {
        const walkway = new Mesh(plank, plankMaterial)
        walkway.scale.set(length, 1, 2)
        walkway.position.set((tip.x + edge.x) / 2, -0.12, (tip.z + edge.z) / 2)
        walkway.rotation.y = -Math.atan2(edge.z - tip.z, edge.x - tip.x)
        scene.add(walkway)
      }
    }
    scene.add(deckGroup)
  }
  const companionShape = new SphereGeometry(0.2, 12, 8)
  const companionMaterials = new Map<string, MeshStandardMaterial>()
  let companions = 0
  const homes: { gameId: Resident["game_id"]; position: Vector3 }[] = []
  for (const placement of layout.placements) {
    const part = partById.get(placement.partId)
    const origin = deckOrigin(placement.deck)
    const offset = slotOffset(placement.slot, DECK_CAPACITY)
    const template = part?.asset ? assetTemplates.get(part.asset) : undefined
    let object: Object3D
    if (template) {
      object = template.clone(true)
    } else {
      const family = part?.family ?? "other"
      let material = standInMaterials.get(family)
      if (!material) {
        material = new MeshStandardMaterial({ color: FAMILY_COLOUR[family], roughness: 0.8 })
        standInMaterials.set(family, material)
      }
      object = new Mesh(standIn, material)
    }
    object.position.set(origin.x + offset.x, 0.4, origin.z + offset.z)
    scene.add(object)
    homes.push({ gameId: placement.gameId, position: object.position.clone() })
    for (let k = 0; k < placement.tier; k++) {
      const angle = k * 2.1 + placement.slot
      let material = companionMaterials.get(part?.family ?? "other")
      if (!material) {
        material = new MeshStandardMaterial({ color: FAMILY_COLOUR[part?.family ?? "other"], roughness: 0.7 })
        companionMaterials.set(part?.family ?? "other", material)
      }
      const companion = new Mesh(companionShape, material)
      companion.position.set(object.position.x + Math.cos(angle) * 0.9, 0.25, object.position.z + Math.sin(angle) * 0.9)
      scene.add(companion)
      companions++
    }
  }

  // Placeholder loft: a small house on its rim spot, until the approved art exists.
  const loftBody = new BoxGeometry(1.4, 1.1, 1.4)
  const loftRoof = new ConeGeometry(1.2, 0.8, 4)
  const loftWall = new MeshStandardMaterial({ color: "#d9b98a", roughness: 0.85 })
  const loftTop = new MeshStandardMaterial({ color: "#a8613f", roughness: 0.8 })
  const ghostWall = new MeshStandardMaterial({ color: "#fff3c4", roughness: 0.9, transparent: true, opacity: 0.8 })
  const ghostTop = new MeshStandardMaterial({ color: "#ffb43c", roughness: 0.9, transparent: true, opacity: 0.8 })
  const puffShape = new SphereGeometry(0.4, 8, 6)
  const makeLoft = (wall: Material, top: Material) => {
    const loft = new Group()
    const body = new Mesh(loftBody, wall)
    body.position.y = 0.55
    const roof = new Mesh(loftRoof, top)
    roof.position.y = 1.5
    roof.rotation.y = Math.PI / 4
    loft.add(body, roof)
    return loft
  }
  const spotPosition = (deck: number, anchor: number) => {
    const origin = deckOrigin(deck)
    const offset = anchorOffset(anchor)
    return new Vector3(origin.x + offset.x, 0.2, origin.z + offset.z)
  }
  const loftGroup = new Group()
  scene.add(loftGroup)
  host.dataset.companions = String(companions)
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "low-power" })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.domElement.setAttribute("aria-hidden", "true")
  host.appendChild(renderer.domElement)

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 500)
  const origins = layout.decks.map((d) => deckOrigin(d.index))
  const reach = 12
  const minX = Math.min(...origins.map((o) => o.x)) - reach, maxX = Math.max(...origins.map((o) => o.x)) + reach
  const minZ = Math.min(...origins.map((o) => o.z)) - reach, maxZ = Math.max(...origins.map((o) => o.z)) + reach
  const bounds = { minX, maxX, minZ, maxZ }
  const target = new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2)
  const home = target.clone()
  // The camera looks along (-1, -1.5, -1), so both axes spread across the screen width.
  const fitWidth = ((maxX - minX) + (maxZ - minZ)) * 0.36
  const fitHeight = ((maxZ - minZ) * 0.55 + (maxX - minX) * 0.3) / 2 + 4
  let zoom = 1, aspect = 1

  const render = () => {
    const half = Math.max(fitWidth / aspect, fitHeight) / zoom
    camera.left = -half * aspect; camera.right = half * aspect
    camera.top = half; camera.bottom = -half
    camera.position.set(target.x + 40, 60, target.z + 40)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    host.dataset.zoom = zoom.toFixed(3)
    host.dataset.pan = `${target.x.toFixed(2)},${target.z.toFixed(2)}`
  }

  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
  const tasks = new Set<(now: number) => boolean>()
  let frame = 0
  const tick = (now: number) => {
    frame = 0
    if (disposed) return
    for (const task of [...tasks]) if (!task(now)) tasks.delete(task)
    render()
    if (tasks.size) frame = requestAnimationFrame(tick)
  }
  const run = (task: (now: number) => boolean) => {
    tasks.add(task)
    if (!frame) frame = requestAnimationFrame(tick)
  }

  // A loft drops in, squashes a little on landing and kicks up a few puffs of dust.
  const playDrop = (loft: Group) => {
    if (reduced) return
    const base = loft.position.y
    const started = performance.now()
    const puffs: Mesh[] = []
    let spawned = false
    loft.position.y = base + 4
    run((now) => {
      const t = Math.max(0, (now - started) / 1000)
      if (t < 0.35) {
        const k = t / 0.35
        loft.position.y = base + 4 * (1 - k * k)
        return true
      }
      loft.position.y = base
      const s = t - 0.35
      if (!spawned) {
        spawned = true
        for (let i = 0; i < 7; i++) {
          const puff = new Mesh(puffShape, new MeshStandardMaterial({ color: "#f3e6cc", transparent: true, opacity: 0.7, roughness: 1 }))
          puff.userData.angle = (i / 7) * Math.PI * 2
          puffs.push(puff)
          loftGroup.add(puff)
        }
      }
      const squash = s < 0.25 ? Math.sin((s / 0.25) * Math.PI) : 0
      loft.scale.set(1 + 0.18 * squash, 1 - 0.22 * squash, 1 + 0.18 * squash)
      const k = Math.min(1, s / 0.6)
      for (const puff of puffs) {
        const angle = puff.userData.angle as number
        puff.position.set(loft.position.x + Math.cos(angle) * (0.9 + k * 0.9), base + 0.3 + k * 0.4, loft.position.z + Math.sin(angle) * (0.9 + k * 0.9))
        puff.scale.setScalar(0.5 + k * 0.9)
        ;(puff.material as MeshStandardMaterial).opacity = 0.7 * (1 - k)
      }
      if (k >= 1) {
        for (const puff of puffs) { loftGroup.remove(puff); (puff.material as Material).dispose() }
        loft.scale.set(1, 1, 1)
        return false
      }
      return true
    })
  }

  const placed = new Map<string, { key: string; loft: Group }>()
  const syncPieces = (list: readonly SettlementPiece[], animate: boolean) => {
    const seen = new Set<string>()
    for (const piece of list) {
      if (piece.piece !== "loft" || piece.deck >= layout.decks.length) continue
      seen.add(piece.game_id)
      const key = `${piece.deck}:${piece.anchor}`
      const current = placed.get(piece.game_id)
      if (current?.key === key) continue
      if (current) loftGroup.remove(current.loft)
      const loft = makeLoft(loftWall, loftTop)
      loft.position.copy(spotPosition(piece.deck, piece.anchor))
      loftGroup.add(loft)
      placed.set(piece.game_id, { key, loft })
      if (animate) playDrop(loft)
    }
    for (const [id, current] of placed) {
      if (!seen.has(id)) { loftGroup.remove(current.loft); placed.delete(id) }
    }
    host.dataset.pieces = String(placed.size)
    render()
  }
  syncPieces(pieces, false)

  const glideTo = (x: number, z: number) => {
    const toX = Math.min(bounds.maxX, Math.max(bounds.minX, x))
    const toZ = Math.min(bounds.maxZ, Math.max(bounds.minZ, z))
    const toZoom = Math.min(4, Math.max(zoom, 1.8))
    if (reduced) { target.set(toX, 0, toZ); zoom = toZoom; render(); return }
    const from = target.clone(), fromZoom = zoom, started = performance.now()
    run((now) => {
      const k = Math.min(1, Math.max(0, (now - started) / 450))
      const e = 1 - Math.pow(1 - k, 3)
      target.set(from.x + (toX - from.x) * e, 0, from.z + (toZ - from.z) * e)
      zoom = fromZoom + (toZoom - fromZoom) * e
      return k < 1
    })
  }

  // Free rim spots shown while the player is choosing one, with a see-through loft on the chosen spot.
  // Updated by event so the camera and scene stay put.
  const hintRing = new RingGeometry(0.9, 1.25, 32)
  hintRing.rotateX(-Math.PI / 2)
  const hintIdle = new MeshStandardMaterial({ color: "#fff3c4", emissive: "#fff3c4", emissiveIntensity: 0.5, side: DoubleSide, transparent: true, opacity: 0.8 })
  const hintActive = new MeshStandardMaterial({ color: "#ffb43c", emissive: "#ffb43c", emissiveIntensity: 0.9, side: DoubleSide })
  const hintGroup = new Group()
  scene.add(hintGroup)
  type Spot = { deck: number; anchor: number }
  let hintSpots: Spot[] = []
  let ghost: Group | null = null
  let ghostDeck = -1
  const onHints = (event: Event) => {
    const detail = (event as CustomEvent<{ spots: Spot[]; active: Spot | null }>).detail
    hintSpots = detail.spots.filter((spot) => spot.deck < layout.decks.length)
    hintGroup.clear()
    for (const spot of hintSpots) {
      const isActive = detail.active?.deck === spot.deck && detail.active?.anchor === spot.anchor
      const ring = new Mesh(hintRing, isActive ? hintActive : hintIdle)
      const at = spotPosition(spot.deck, spot.anchor)
      ring.position.set(at.x, 0.3, at.z)
      if (isActive) ring.scale.setScalar(1.35)
      hintGroup.add(ring)
    }
    host.dataset.hints = String(hintGroup.children.length)
    if (ghost) { loftGroup.remove(ghost); ghost = null }
    const active = detail.active && detail.active.deck < layout.decks.length ? detail.active : null
    host.dataset.ghost = active ? `${active.deck}:${active.anchor}` : ""
    if (active) {
      const at = spotPosition(active.deck, active.anchor)
      const mine = makeLoft(ghostWall, ghostTop)
      mine.position.copy(at)
      loftGroup.add(mine)
      ghost = mine
      if (!reduced) run((now) => {
        if (ghost !== mine) return false
        mine.position.y = at.y + 0.3 + 0.18 * Math.sin(now / 260)
        return true
      })
      if (active.deck !== ghostDeck) glideTo(at.x, at.z)
      ghostDeck = active.deck
    } else {
      ghostDeck = -1
    }
    render()
  }
  host.addEventListener("settlement-hints", onHints)
  const onPieces = (event: Event) => syncPieces((event as CustomEvent<SettlementPiece[]>).detail, true)
  host.addEventListener("settlement-pieces", onPieces)
  const resize = () => {
    const { width, height } = host.getBoundingClientRect()
    if (!width || !height) return
    aspect = width / height
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
    renderer.setSize(width, height)
    render()
  }
  const clampTarget = () => {
    target.x = Math.min(bounds.maxX, Math.max(bounds.minX, target.x))
    target.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, target.z))
  }
  // Move the view by a screen-space amount, in pixels.
  const pan = (dx: number, dy: number) => {
    const { width } = host.getBoundingClientRect()
    if (!width) return
    const perPixel = (camera.right - camera.left) / width
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    target.addScaledVector(right, -dx * perPixel).addScaledVector(up, dy * perPixel)
    target.y = 0
    clampTarget()
    render()
  }
  const setZoom = (next: number) => {
    zoom = Math.min(4, Math.max(0.6, next))
    render()
  }

  const pointers = new Map<number, { x: number; y: number }>()
  const downAt = new Map<number, { x: number; y: number }>()
  let pinch = 0
  let pinched = false
  const onDown = (event: PointerEvent) => {
    host.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    downAt.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2) { pinch = distance(); pinched = true }
  }
  const distance = () => {
    const [a, b] = [...pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const onMove = (event: PointerEvent) => {
    const last = pointers.get(event.pointerId)
    if (!last) return
    const dx = event.clientX - last.x, dy = event.clientY - last.y
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2) {
      const now = distance()
      if (pinch > 0) setZoom(zoom * (now / pinch))
      pinch = now
    } else {
      pan(dx, dy)
    }
  }
  const onUp = (event: PointerEvent) => {
    const start = downAt.get(event.pointerId)
    const wasTap = pointers.size === 1 && !pinched && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6
    pointers.delete(event.pointerId)
    downAt.delete(event.pointerId)
    pinch = 0
    if (pointers.size === 0) pinched = false
    if (wasTap && event.type === "pointerup") select(event.clientX, event.clientY)
  }
  // A tap picks the home nearest to the finger, within a thumb's width.
  const select = (clientX: number, clientY: number) => {
    const rect = host.getBoundingClientRect()
    let nearSpot: { spot: Spot; d: number } | null = null
    for (const spot of hintSpots) {
      const p = spotPosition(spot.deck, spot.anchor).project(camera)
      const d = Math.hypot(rect.left + ((p.x + 1) / 2) * rect.width - clientX, rect.top + ((1 - p.y) / 2) * rect.height - clientY)
      if (d <= 44 && (!nearSpot || d < nearSpot.d)) nearSpot = { spot, d }
    }
    if (nearSpot) {
      host.dispatchEvent(new CustomEvent("settlement-spot", { detail: nearSpot.spot }))
      return
    }
    if (!onSelect) return
    let best: { gameId: Resident["game_id"]; d: number } | null = null
    for (const home of homes) {
      const p = home.position.clone().project(camera)
      const d = Math.hypot(rect.left + ((p.x + 1) / 2) * rect.width - clientX, rect.top + ((1 - p.y) / 2) * rect.height - clientY)
      if (d <= 32 && (!best || d < best.d)) best = { gameId: home.gameId, d }
    }
    if (best) onSelect(best.gameId)
  }
  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    setZoom(zoom * Math.exp(-event.deltaY * 0.0015))
  }
  const onKey = (event: KeyboardEvent) => {
    const step = 40
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    }
    if (moves[event.key]) { event.preventDefault(); pan(...moves[event.key]) }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoom(zoom * 1.25) }
    else if (event.key === "-") { event.preventDefault(); setZoom(zoom / 1.25) }
    else if (event.key === "0") { event.preventDefault(); zoom = 1; target.copy(home); render() }
  }
  host.addEventListener("pointerdown", onDown)
  host.addEventListener("pointermove", onMove)
  host.addEventListener("pointerup", onUp)
  host.addEventListener("pointercancel", onUp)
  host.addEventListener("wheel", onWheel, { passive: false })
  host.addEventListener("keydown", onKey)

  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
    host.removeEventListener("pointerdown", onDown)
    host.removeEventListener("pointermove", onMove)
    host.removeEventListener("pointerup", onUp)
    host.removeEventListener("pointercancel", onUp)
    host.removeEventListener("wheel", onWheel)
    host.removeEventListener("keydown", onKey)
    host.removeEventListener("settlement-hints", onHints)
    host.removeEventListener("settlement-pieces", onPieces)
    if (frame) cancelAnimationFrame(frame)
    tasks.clear()
    signal.removeEventListener("abort", dispose)
    disposeTree(scene)
    standIn.dispose()
    companionShape.dispose()
    loftBody.dispose()
    hintRing.dispose()
    puffShape.dispose()
    ghostWall.dispose()
    ghostTop.dispose()
    loftWall.dispose()
    loftTop.dispose()
    hintIdle.dispose()
    hintActive.dispose()
    loftRoof.dispose()
    plank.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    scene.clear()
  }
  signal.addEventListener("abort", dispose, { once: true })
  return dispose
}
