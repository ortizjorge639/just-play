import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry,
  DodecahedronGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion,
  SphereGeometry, SRGBColorSpace, Vector3,
} from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import { bridgeEndpoints, INTERIOR_CENTER, LOCATION_BY_ID, visibleConnections, visibleLocations } from "@/lib/demo/world"

const COLORS = {
  wood: "#93644a", woodLight: "#b9895b", woodDark: "#493f36", endgrain: "#c1a276",
  bark: "#625342", barkLight: "#80654a", root: "#4c5140",
  roof: "#546d60", roofLight: "#738170", roofDark: "#384f49",
  clay: "#b46e50", plaster: "#d6c5a0", stone: "#727a69", stoneDark: "#4a6056",
  moss: "#829164", grass: "#9bab72", leaf: "#708b65", leafLight: "#96a777", leafDeep: "#496f60",
  autumn: "#c1a369", rope: "#c6ae83", brass: "#b6a26d", window: "#f4cd83",
  paper: "#eddaad", water: "#6caaa1", blue: "#769fa6", flower: "#e3b694",
}
type MaterialName = keyof typeof COLORS
const BOX = new BoxGeometry(1, 1, 1)
const CYLINDER = new CylinderGeometry(1, 1, 1, 9)
const SPHERE = new SphereGeometry(1, 10, 7)
const LEAVES = new DodecahedronGeometry(1, 1)
const UP = new Vector3(0, 1, 0)

export const seeded = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

class VillageBuilder {
  private parts = new Map<MaterialName, BufferGeometry[]>()
  readonly decorations = new Group()
  private matrix = new Matrix4()
  private rotation = new Quaternion()

  add(shape: BufferGeometry, material: MaterialName, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, yaw = 0) {
    this.rotation.setFromAxisAngle(UP, yaw)
    this.matrix.compose(new Vector3(x, y, z), this.rotation, new Vector3(sx, sy, sz))
    const geometry = shape.clone().applyMatrix4(this.matrix)
    const parts = this.parts.get(material) ?? []
    parts.push(geometry)
    this.parts.set(material, parts)
  }

  box(material: MaterialName, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) {
    this.add(BOX, material, x, y, z, w, h, d, yaw)
  }

  ball(material: MaterialName, x: number, y: number, z: number, rx: number, ry = rx, rz = rx) {
    this.add(SPHERE, material, x, y, z, rx, ry, rz)
  }

  beam(material: MaterialName, from: Vector3, to: Vector3, width: number, endWidth = width) {
    const direction = to.clone().sub(from)
    const geometry = new CylinderGeometry(endWidth, width, direction.length(), 7)
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(UP, direction.normalize()))
    geometry.translate(...from.clone().add(to).multiplyScalar(0.5).toArray())
    const parts = this.parts.get(material) ?? []
    parts.push(geometry)
    this.parts.set(material, parts)
  }

  finish() {
    const group = new Group()
    for (const [name, parts] of this.parts) {
      const normalized = parts.map(part => part.index ? part.toNonIndexed() : part)
      const geometry = mergeGeometries(normalized, false)
      new Set([...parts, ...normalized]).forEach(part => part.dispose())
      if (!geometry) throw new Error(`Could not assemble ${name} world geometry.`)
      const material = new MeshStandardMaterial({
        color: COLORS[name], roughness: 0.92, flatShading: true,
        ...(name === "window" ? { emissive: new Color("#f8bc64"), emissiveIntensity: 0.65 } : {}),
        ...(name === "brass" ? { metalness: 0.25, roughness: 0.55 } : {}),
      })
      const mesh = new Mesh(geometry, material)
      mesh.castShadow = !["leafLight", "window", "flower"].includes(name)
      mesh.receiveShadow = true
      group.add(mesh)
    }
    group.add(this.decorations)
    return group
  }
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

function tree(b: VillageBuilder, x: number, y: number, z: number, height: number, width: number, seed: number) {
  b.beam("bark", v(x, y - 6, z), v(x + width * 0.4, y + height * 0.76, z - width * 0.2), width, width * 0.42)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const r = width * (2.4 + seeded(seed + i))
    b.beam("root", v(x + Math.cos(a) * r, y - 0.15, z + Math.sin(a) * r), v(x, y + 2.4, z), width * 0.15, width * 0.35)
    b.beam("barkLight", v(x + Math.cos(a) * width * 0.92, y + 0.5, z + Math.sin(a) * width * 0.92), v(x + Math.cos(a) * width * 0.46, y + height * 0.58, z + Math.sin(a) * width * 0.46), 0.025)
  }
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4 + seed
    const reach = height * (0.25 + seeded(seed + i * 7) * 0.15)
    const top = y + height * (0.72 + seeded(seed + i * 4) * 0.28)
    const end = v(x + Math.cos(a) * reach, top, z + Math.sin(a) * reach)
    b.beam("bark", v(x, y + height * 0.43, z), end, width * 0.44, 0.16)
    for (let j = 0; j < 3; j++) {
      const r = height * (0.17 + seeded(seed + i * 11 + j) * 0.04)
      b.add(LEAVES, (["leaf", "leafLight", "leafDeep"] as const)[(i + j) % 3],
        end.x + (j - 1) * r * 0.6, top + r * 0.25 + j * 0.3, end.z + Math.sin(j * 3) * r,
        r * 1.25, r * 0.6, r, a)
    }
  }
}

function lantern(b: VillageBuilder, x: number, y: number, z: number, post = true) {
  if (post) {
    b.box("woodDark", x, y + 0.95, z, 0.13, 1.9, 0.13)
    b.box("stone", x, y + 0.1, z, 0.35, 0.2, 0.35)
    y += 1.75
  }
  b.box("window", x, y + 0.3, z, 0.28, 0.48, 0.28)
  b.box("woodDark", x, y + 0.02, z, 0.4, 0.1, 0.4)
  b.box("roofDark", x, y + 0.61, z, 0.46, 0.1, 0.46)
  for (const dx of [-0.16, 0.16]) for (const dz of [-0.16, 0.16]) {
    b.box("woodDark", x + dx, y + 0.3, z + dz, 0.035, 0.5, 0.035)
  }
}

function bench(b: VillageBuilder, x: number, y: number, z: number, yaw = 0) {
  const forward = v(Math.sin(yaw), 0, Math.cos(yaw)), side = v(Math.cos(yaw), 0, -Math.sin(yaw))
  for (let i = -1; i <= 1; i++) b.box("woodLight", x + forward.x * i * 0.16, y + 0.65, z + forward.z * i * 0.16, 1.75, 0.12, 0.13, yaw)
  b.box("wood", x - forward.x * 0.32, y + 1.07, z - forward.z * 0.32, 1.75, 0.4, 0.1, yaw)
  for (const direction of [-1, 1]) {
    b.box("woodDark", x + side.x * direction * 0.64, y + 0.34, z + side.z * direction * 0.64, 0.13, 0.65, 0.5, yaw)
  }
}

function sign(b: VillageBuilder, x: number, y: number, z: number, label: string, small = false) {
  const width = small ? 1.5 : 2.3
  b.box("woodDark", x, y + 1.2, z, 0.12, 2.4, 0.12)
  b.box("woodDark", x, y + 2, z + 0.03, width + 0.15, 0.85, 0.14)
  const canvas = document.createElement("canvas")
  canvas.width = 512; canvas.height = 160
  const context = canvas.getContext("2d")
  if (!context) throw new Error("This browser could not draw the world signs.")
  context.fillStyle = "#364b3e"; context.fillRect(0, 0, 512, 160)
  context.strokeStyle = "#bdab7f"; context.lineWidth = 3; context.strokeRect(12, 12, 488, 136)
  context.fillStyle = "#f4e5bf"; context.textAlign = "center"; context.textBaseline = "middle"
  context.font = "30px Georgia, serif"; context.fillText(label, 256, 82)
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace
  const material = new MeshStandardMaterial({ map: texture, roughness: 0.95 })
  const mesh = new Mesh(new BoxGeometry(width, 0.7, 0.02), material)
  mesh.position.set(x, y + 2, z + 0.115)
  b.decorations.add(mesh)
}

function house(b: VillageBuilder, x: number, y: number, z: number, scale: number, kind: "lodge" | "home" | "fern", seed: number) {
  const w = 4.2 * scale, d = 3.8 * scale, h = 3.2 * scale
  const front = z + d / 2
  b.box("woodDark", x, y + 0.25, z, w + 0.6, 0.5, d + 0.55)
  b.box("plaster", x, y + h / 2 + 0.35, z, w, h, d)
  for (let i = 0; i < 9; i++) {
    b.box(i % 3 === 0 ? "woodLight" : "wood", x, y + 0.5 + i * 0.14, front + 0.01, w, 0.1, 0.05)
  }
  for (const dx of [-w / 2, 0, w / 2]) {
    b.box("woodDark", x + dx, y + h / 2 + 0.35, front + 0.05, 0.15, h + 0.15, 0.17)
    b.box("woodDark", x + dx, y + h / 2 + 0.35, z - d / 2, 0.15, h + 0.15, 0.17)
  }
  for (const side of [-1, 1]) {
    b.box("woodDark", x + side * w / 2, y + h / 2 + 0.35, z, 0.12, 0.12, d)
    b.box("woodDark", x, y + h + 0.35, z + side * d / 2, w + 0.15, 0.15, 0.15)
  }
  b.box("woodDark", x, y + 1.13 * scale, front + 0.08, 0.92 * scale, 1.9 * scale, 0.12)
  b.box("wood", x, y + 1.1 * scale, front + 0.15, 0.71 * scale, 1.65 * scale, 0.07)
  b.ball("brass", x + 0.23 * scale, y + 1.04 * scale, front + 0.23, 0.045)
  for (const side of [-1, 1]) {
    const wx = x + side * w * 0.3
    b.box("woodDark", wx, y + 2.05 * scale, front + 0.08, 1.02 * scale, 1.34 * scale, 0.13)
    b.box("window", wx, y + 2.05 * scale, front + 0.16, 0.87 * scale, 1.18 * scale, 0.04)
    b.box("woodDark", wx, y + 2.05 * scale, front + 0.19, 0.055, 1.2 * scale, 0.05)
    b.box("woodDark", wx, y + 2.1 * scale, front + 0.19, 0.87 * scale, 0.05, 0.05)
    b.box("woodDark", wx, y + 1.37 * scale, front + 0.3, 1.15 * scale, 0.12, 0.4)
    b.box("clay", wx, y + 1.52 * scale, front + 0.45, 0.94 * scale, 0.2, 0.3)
    for (let f = -1; f <= 1; f++) b.ball(f === 0 ? "flower" : "moss", wx + f * 0.27, y + 1.7 * scale, front + 0.45, 0.17, 0.17, 0.15)
  }
  const peak = y + h + 2.0 * scale, eave = y + h + 0.05
  for (const side of [-1, 1]) {
    const gable = new BufferGeometry()
    gable.setAttribute("position", new Float32BufferAttribute([
      -w / 2, 0, 0, w / 2, 0, 0, 0, peak - eave, 0,
      w / 2, 0, 0, -w / 2, 0, 0, 0, peak - eave, 0,
    ], 3))
    gable.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 1, 0, 0, 0, 0.5, 1], 2))
    gable.computeVertexNormals()
    b.add(gable, "wood", x, eave, z + side * d / 2)
    gable.dispose()
  }
  for (const side of [-1, 1]) {
    for (let row = 0; row < 7; row++) {
      const t = (row + 0.5) / 7
      const xx = x + side * t * (w / 2 + 0.55)
      const yy = peak + (eave - peak) * t
      const slope = Math.atan2((w / 2 + 0.55), peak - eave)
      const shape = new BoxGeometry((w / 2 + 0.65) / 7 / Math.sin(slope), 0.14, d + 1)
      shape.rotateZ(-side * (Math.PI / 2 - slope))
      for (let tile = 0; tile < 6; tile++) {
        const tileGeometry = shape.clone()
        tileGeometry.scale(1, 1, 1 / 6)
        b.add(tileGeometry, kind === "fern" ? (row % 3 === 0 ? "roofLight" : "roof") : (row % 3 === 0 ? "roof" : "roofDark"),
          xx, yy, z + (tile - 2.5) * (d + 1) / 6 + (row % 2 ? 0.04 : 0))
        tileGeometry.dispose()
      }
      shape.dispose()
    }
  }
  b.beam("woodDark", v(x - w / 2 - 0.55, eave, front + 0.57), v(x, peak, front + 0.57), 0.09)
  b.beam("woodDark", v(x + w / 2 + 0.55, eave, front + 0.57), v(x, peak, front + 0.57), 0.09)
  b.box("woodDark", x, peak + 0.04, z, 0.18, 0.17, d + 1.1)
  b.box("window", x, y + h + 0.66, front + 0.09, 0.55, 0.7, 0.07)
  b.box("woodDark", x, y + h + 0.68, front + 0.17, 0.06, 0.75, 0.04)
  b.box("stone", x + w * 0.26, y + h + 1.7, z - d * 0.15, 0.55, 1.8, 0.6)
  b.box("stoneDark", x + w * 0.26, y + h + 2.65, z - d * 0.15, 0.75, 0.16, 0.78)
  for (let i = 0; i < 5; i++) b.box("woodLight", x, y + 0.06, front + 0.45 + i * 0.28, w + 0.7, 0.13, 0.24)
  for (const side of [-1, 1]) {
    b.box("woodDark", x + side * (w / 2 + 0.2), y + 0.5, front + 1.38, 0.13, 1, 0.13)
    b.box("wood", x + side * (w / 2 + 0.2), y + 0.8, front + 0.8, 0.07, 0.07, 1.15)
  }
  lantern(b, x - w / 2 + 0.3, y + 1.6, front + 0.5, false)
  if (kind === "lodge") sign(b, x, y + 0.7, front + 0.33, "THE TRAVELERS' LODGE", true)
  for (let i = 0; i < 4; i++) {
    b.ball("stone", x - w / 2 - 0.35 - seeded(seed + i), y + 0.18, z + (i - 1.5) * 0.8, 0.35, 0.25, 0.28)
  }
}

function platform(b: VillageBuilder, x: number, y: number, z: number, radius: number, seed: number) {
  const base = new CylinderGeometry(radius * 0.97, radius * 0.55, 2.3, 16)
  b.add(base, "root", x, y - 1.25, z); base.dispose()
  const soil = new CylinderGeometry(radius, radius * 0.96, 0.55, 24)
  b.add(soil, "moss", x, y - 0.29, z); soil.dispose()
  for (let i = -Math.floor(radius / 0.48); i <= Math.floor(radius / 0.48); i++) {
    const zz = i * 0.48
    const half = Math.sqrt(Math.max(0, (radius - 0.22) ** 2 - zz ** 2))
    if (half < 0.2) continue
    b.box(i % 5 === 0 ? "woodLight" : "wood", x, y - 0.04, z + zz, half * 2, 0.12, 0.445)
  }
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, r = radius * 0.94
    b.beam("woodDark", v(x + Math.cos(a) * r, y - 0.32, z + Math.sin(a) * r),
      v(x + Math.cos(a + Math.PI / 9) * r, y - 0.32, z + Math.sin(a + Math.PI / 9) * r), 0.17)
    const rr = radius * (0.72 + seeded(seed + i) * 0.15)
    b.beam("root", v(x + Math.cos(a) * rr, y - 1, z + Math.sin(a) * rr),
      v(x + Math.cos(a + 0.3) * rr * 0.45, y - 4 - seeded(i + seed) * 2, z + Math.sin(a + 0.3) * rr * 0.45), 0.2, 0.05)
    if (i % 3 === 0) b.ball("leafDeep", x + Math.cos(a) * radius, y - 1, z + Math.sin(a) * radius, 1.2, 0.55, 1.2)
  }
}

function bridges(b: VillageBuilder, built: boolean) {
  for (const [a, c] of visibleConnections(built)) {
    const { start, end, length } = bridgeEndpoints(LOCATION_BY_ID[a], LOCATION_BY_ID[c])
    const dx = end.x - start.x, dz = end.z - start.z
    const side = v(-dz / length, 0, dx / length)
    const steps = Math.ceil(length / 0.35)
    const point = (t: number) => v(start.x + dx * t, start.y + (end.y - start.y) * t + Math.sin(t * Math.PI) * 0.35, start.z + dz * t)
    const yaw = Math.atan2(-dz, dx)
    for (let i = 0; i <= steps; i++) {
      const p = point(i / steps)
      b.box(i % 4 === 0 ? "woodLight" : "wood", p.x, p.y - 0.04, p.z, 0.31, 0.17, 2.5, yaw)
    }
    for (const s of [-1, 1]) {
      const divisions = Math.ceil(length / 1.55)
      for (let i = 0; i <= divisions; i++) {
        const p = point(i / divisions).addScaledVector(side, s * 1.14)
        b.box("woodDark", p.x, p.y + 0.59, p.z, 0.13, 1.38, 0.13)
        b.ball("brass", p.x, p.y + 1.3, p.z, 0.1)
        if (i < divisions) {
          const next = point((i + 1) / divisions).addScaledVector(side, s * 1.14)
          for (const rise of [0.52, 1.12]) {
            b.beam("rope", p.clone().add(v(0, rise, 0)), next.clone().add(v(0, rise, 0)), 0.035)
          }
        }
        if (i % 4 === 0 && s === -1) lantern(b, p.x, p.y + 0.95, p.z, false)
      }
    }
  }
}

function interior(b: VillageBuilder) {
  const x = INTERIOR_CENTER
  for (let i = 0; i < 22; i++) b.box(i % 4 ? "wood" : "woodLight", x, -0.04, -5 + i * 0.46, 10, 0.15, 0.42)
  b.box("plaster", x, 2.2, -5, 10.2, 4.5, 0.2)
  for (const side of [-1, 1]) {
    b.box("plaster", x + side * 5, 2.2, 0, 0.2, 4.5, 10)
    for (let i = 0; i < 4; i++) b.box("woodDark", x + side * 4.85, 2, -4 + i * 2.5, 0.13, 4.2, 0.13)
  }
  for (let i = -2; i <= 2; i++) b.box("woodDark", x + i * 2.35, 2.2, -4.82, 0.17, 4.5, 0.18)
  b.box("woodDark", x, 3.95, -4.82, 10, 0.18, 0.22)
  b.box("window", x, 2.6, -4.8, 2, 1.9, 0.05)
  b.box("woodDark", x, 2.6, -4.7, 0.08, 2, 0.08)
  b.box("woodDark", x, 2.6, -4.7, 2, 0.08, 0.08)
  b.box("roof", x, 0.03, 0.2, 4.5, 0.035, 3.2)
  b.box("endgrain", x, 0.05, 0.2, 4.1, 0.035, 2.8)
  b.box("roof", x, 0.07, 0.2, 3.8, 0.035, 2.5)
  b.box("woodDark", x - 3.4, 0.55, -1.2, 2.1, 1, 3.8)
  b.box("paper", x - 3.4, 1.12, -1.2, 1.95, 0.25, 3.55)
  b.box("roofLight", x - 3.4, 1.3, -0.6, 2, 0.1, 2.2)
  b.box("paper", x - 3.4, 1.38, -2.45, 1.35, 0.2, 0.55)
  b.box("woodDark", x + 3.5, 1.55, -3.3, 2.1, 3, 0.5)
  for (let shelf = 0; shelf < 3; shelf++) {
    b.box("woodLight", x + 3.5, 0.7 + shelf * 0.8, -3, 2.1, 0.1, 0.65)
    for (let book = 0; book < 8; book++) {
      const material = (["clay", "roof", "blue", "paper"] as const)[(book + shelf) % 4]
      b.box(material, x + 2.65 + book * 0.23, 0.99 + shelf * 0.8, -3, 0.17, 0.42 + seeded(book + shelf * 13) * 0.2, 0.35)
    }
  }
  b.box("wood", x + 2.2, 0.8, 1.1, 1.7, 0.13, 1.2)
  for (const xx of [-0.65, 0.65]) for (const zz of [-0.42, 0.42]) b.box("woodDark", x + 2.2 + xx, 0.4, 1.1 + zz, 0.1, 0.8, 0.1)
  b.box("paper", x + 2.2, 0.9, 1.1, 0.65, 0.035, 0.45)
  b.ball("clay", x + 2.75, 1.02, 1.15, 0.1, 0.13, 0.1)
  bench(b, x + 2.2, 0, 2.4)
  lantern(b, x - 1.9, 0, -3.4)
  sign(b, x, 0, 4.6, "BACK TO THE GROVE", true)
}

/** Original modular scenery is merged by material so detail does not multiply draw calls. */
export function buildVillage(built: boolean) {
  const b = new VillageBuilder()
  for (const location of visibleLocations(built)) platform(b, location.x, location.y, location.z, location.radius, location.x + 100)
  bridges(b, built)
  tree(b, -3, 0, -2, 19, 1.65, 5)
  tree(b, -19, 2, -6, 13, 0.88, 14)
  tree(b, 22, 3, -10, 16, 1.06, 24)
  tree(b, -3, 5, -27, 10, 0.7, 35)
  tree(b, -9, -1, 23, 8, 0.6, 44)
  house(b, -23, 2, -4, 1.12, "lodge", 4)
  house(b, 17, 3, -6.5, 1, "home", 11)
  house(b, 24, 3, -6.5, 0.76, "fern", 18)
  if (built) {
    tree(b, 40, 4, 7, 12, 0.75, 53)
    house(b, 38, 4, 8, 1, "fern", 61)
    sign(b, 34, 4, 12, "FERN HOUSE", true)
    bench(b, 34.5, 4, 8.5, Math.PI / 2)
  }
  sign(b, -5.5, -1, 21, "THE NEXT ADVENTURE")
  b.box("woodDark", -5.5, 1.15, 20.96, 2.7, 2.1, 0.18)
  for (let i = 0; i < 3; i++) {
    b.box(i === 1 ? "blue" : "paper", -6.35 + i * 0.85, 1.2 + (i % 2) * 0.1, 21.08, 0.61, 0.87, 0.03)
    b.ball("brass", -6.35 + i * 0.85, 1.5, 21.12, 0.045)
  }
  sign(b, 3.4, 0, 3, "THE GATHERING TREE")
  sign(b, 20.5, 3, -1.5, "STORIES THAT STAY", true)
  bench(b, -5.2, 0, 3.3, -0.35)
  bench(b, 4.2, 0, -2, Math.PI / 2)
  bench(b, -1, 5, -28, Math.PI)
  bench(b, -18, 2, -1, Math.PI / 2)
  b.add(CYLINDER, "woodDark", -2, 0.55, 4.5, 0.75, 1, 0.75)
  b.add(CYLINDER, "endgrain", -2, 1.05, 4.5, 1.15, 0.14, 1.15)
  b.ball("clay", -2.1, 1.23, 4.5, 0.13, 0.18, 0.13)
  b.box("paper", -1.5, 1.14, 4.55, 0.45, 0.02, 0.3)
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2
    const from = v(-3, 9, -2)
    const end = v(Math.cos(a) * 7.5, 2.8, Math.sin(a) * 7.5)
    b.box("woodDark", end.x, 1.4, end.z, 0.12, 2.8, 0.12)
    b.beam("rope", from, end, 0.022)
    for (let j = 1; j <= 4; j++) {
      const p = from.clone().lerp(end, j / 5)
      b.ball("window", p.x, p.y - 0.14, p.z, 0.105, 0.16, 0.105)
    }
  }
  for (const location of visibleLocations(built)) {
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4 + location.x
      const x = location.x + Math.cos(a) * (location.radius - 1.5)
      const z = location.z + Math.sin(a) * (location.radius - 1.5)
      if (i % 2 === 0) lantern(b, x, location.y, z)
      else {
        b.add(CYLINDER, "clay", x, location.y + 0.2, z, 0.28, 0.4, 0.28)
        b.ball("leaf", x, location.y + 0.6, z, 0.5, 0.4, 0.5)
        b.ball("flower", x + 0.2, location.y + 0.92, z, 0.1)
      }
    }
  }
  // Distant trees establish a forest horizon without pretending to be destinations.
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4
    const r = 65 + seeded(i + 67) * 40
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    tree(b, x, -15 - seeded(i) * 4, z, 24 + seeded(i + 2) * 20, 2, i + 70)
  }
  interior(b)
  return b.finish()
}

export function disposeVillage(group: Group) {
  group.traverse(object => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach(material => {
      if (material instanceof MeshStandardMaterial) material.map?.dispose()
      material.dispose()
    })
  })
}

export function buildCharacter(color: string, variant = 0) {
  const group = new Group()
  const materials = {
    coat: new MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }),
    skin: new MeshStandardMaterial({ color: ["#dfbc91", "#bd8f6d", "#efd4aa"][variant % 3], roughness: 1 }),
    dark: new MeshStandardMaterial({ color: "#354a43", roughness: 1 }),
    hair: new MeshStandardMaterial({ color: ["#483d35", "#735440", "#484642"][variant % 3], roughness: 1 }),
    light: new MeshStandardMaterial({ color: "#e8dbb6", roughness: 1 }),
  }
  function part(geometry: BufferGeometry, material: keyof typeof materials, x: number, y: number, z: number) {
    const mesh = new Mesh(geometry, materials[material])
    mesh.position.set(x, y, z); mesh.castShadow = true
    group.add(mesh); return mesh
  }
  part(new CylinderGeometry(0.2, 0.29, 0.65, 8), "coat", 0, 0.88, 0)
  part(new SphereGeometry(0.25, 10, 8), "skin", 0, 1.46, 0)
  part(new SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), "hair", 0, 1.48, -0.015)
  part(new BoxGeometry(0.035, 0.035, 0.025), "dark", -0.085, 1.46, 0.235)
  part(new BoxGeometry(0.035, 0.035, 0.025), "dark", 0.085, 1.46, 0.235)
  part(new BoxGeometry(0.27, 0.35, 0.16), "light", 0, 0.97, -0.24)
  const limbs: Mesh[] = []
  for (const side of [-1, 1]) {
    const leg = part(new BoxGeometry(0.15, 0.47, 0.17), "dark", side * 0.14, 0.3, 0)
    leg.geometry.translate(0, -0.2, 0); leg.position.y = 0.5
    const arm = part(new CylinderGeometry(0.075, 0.07, 0.48, 7), "coat", side * 0.31, 1.08, 0)
    arm.geometry.translate(0, -0.19, 0)
    limbs.push(leg, arm)
    part(new BoxGeometry(0.17, 0.12, 0.26), "hair", side * 0.14, 0.08, 0.045)
  }
  if (variant % 2 === 0) {
    part(new CylinderGeometry(0.32, 0.34, 0.05, 12), "coat", 0, 1.67, 0)
    part(new ConeGeometry(0.23, 0.21, 10), "coat", 0, 1.79, 0)
  } else {
    part(new BoxGeometry(0.45, 0.12, 0.39), "light", 0, 1.19, 0.025)
    part(new BoxGeometry(0.1, 0.32, 0.06), "light", 0.17, 1.03, 0.25)
  }
  return { group, limbs, materials }
}
