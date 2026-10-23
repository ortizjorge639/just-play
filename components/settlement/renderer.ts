import {
  ACESFilmicToneMapping, Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh,
  MeshStandardMaterial, OrthographicCamera, Scene, SphereGeometry, SRGBColorSpace,
  Vector3, WebGLRenderer, type BufferGeometry, type Material, type Object3D,
} from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import type { Layout } from "@/lib/settlement/types"
import { PARTS } from "@/lib/settlement/catalog"
import { DECK_CAPACITY } from "@/lib/settlement/layout"
import { deckOrigin, slotOffset } from "@/lib/settlement/transforms"

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

// The exported deck sits at its own site in the old world. Recentre it on x/z and rest it on y = 0.
function recentre(group: Group): Group {
  const box = new Box3().setFromObject(group)
  const centre = box.getCenter(new Vector3())
  const holder = new Group()
  group.position.set(-centre.x, -box.max.y, -centre.z)
  holder.add(group)
  return holder
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

export async function mountSettlement(host: HTMLElement, layout: Layout, signal: AbortSignal) {
  const scene = new Scene()
  scene.background = new Color("#cdd9c4")
  scene.add(new HemisphereLight("#fff0d5", "#716451", 2.1))
  const sun = new DirectionalLight("#ffe1a3", 2.4)
  sun.position.set(-8, 14, 6)
  scene.add(sun)

  const deckSource = await loadGroup(DECK_URL, signal)
  const deckTemplate = recentre(deckSource)

  const assetUrls = [...new Set(PARTS.map((p) => p.asset).filter((a): a is string => !!a))]
  const assetTemplates = new Map<string, Group>()
  await Promise.all(assetUrls.map(async (url) => {
    assetTemplates.set(url, await loadGroup(url, signal))
  }))
  if (signal.aborted) throw new DOMException("Aborted", "AbortError")

  const standIn = new SphereGeometry(0.4, 16, 12)
  const standInMaterials = new Map<string, MeshStandardMaterial>()
  const partById = new Map(PARTS.map((p) => [p.id, p]))

  for (const deck of layout.decks) {
    const origin = deckOrigin(deck.index)
    const deckGroup = deckTemplate.clone(true)
    deckGroup.position.set(origin.x, 0, origin.z)
    scene.add(deckGroup)
  }
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
  }

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "low-power" })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.domElement.setAttribute("aria-hidden", "true")
  host.appendChild(renderer.domElement)

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 500)
  const origins = layout.decks.map((d) => deckOrigin(d.index))
  const reach = 11
  const minX = Math.min(...origins.map((o) => o.x)) - reach, maxX = Math.max(...origins.map((o) => o.x)) + reach
  const minZ = Math.min(...origins.map((o) => o.z)) - reach, maxZ = Math.max(...origins.map((o) => o.z)) + reach
  const centreX = (minX + maxX) / 2, centreZ = (minZ + maxZ) / 2
  // The camera looks along (-1, -1.5, -1), so both axes spread across the screen width.
  const halfWidth = ((maxX - minX) + (maxZ - minZ)) * 0.36
  const halfHeight = ((maxZ - minZ) * 0.55 + (maxX - minX) * 0.3) / 2 + 4
  const resize = () => {
    const { width, height } = host.getBoundingClientRect()
    if (!width || !height) return
    const aspect = width / height
    const half = Math.max(halfWidth / aspect, halfHeight)
    camera.left = -half * aspect; camera.right = half * aspect
    camera.top = half; camera.bottom = -half
    camera.position.set(centreX + 40, 60, centreZ + 40)
    camera.lookAt(centreX, 0, centreZ)
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
    renderer.setSize(width, height)
    renderer.render(scene, camera)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
    signal.removeEventListener("abort", dispose)
    disposeTree(scene)
    standIn.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    scene.clear()
  }
  signal.addEventListener("abort", dispose, { once: true })
  return dispose
}
