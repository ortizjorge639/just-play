import {
  CanvasTexture, Color, CylinderGeometry, DoubleSide,
  Group, Mesh, MeshStandardMaterial, RepeatWrapping, SphereGeometry, SRGBColorSpace,
  TorusGeometry, Vector3,
} from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

// Original, deterministic geometry. The recovered mood image is not a runtime asset.
export function createRoom() {
  const room = new Group()
  const grain = document.createElement("canvas")
  grain.width = 128; grain.height = 512
  const ctx = grain.getContext("2d")
  if (!ctx) throw new Error("Canopy's material canvas is unavailable.")
  ctx.fillStyle = "#b58b59"; ctx.fillRect(0, 0, 128, 512)
  for (let i = 0; i < 85; i++) {
    ctx.strokeStyle = i % 3 ? "rgba(66,38,19,.10)" : "rgba(255,233,178,.16)"
    ctx.lineWidth = i % 4 ? 1 : 2
    ctx.beginPath()
    for (let y = 0; y <= 512; y += 8) {
      const x = (i * 17.31) % 128 + Math.sin(y * .016 + i) * 2.5
      if (!y) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  const woodTexture = new CanvasTexture(grain)
  woodTexture.colorSpace = SRGBColorSpace
  woodTexture.wrapS = woodTexture.wrapT = RepeatWrapping
  const material = (color: string, roughness = .88) => new MeshStandardMaterial({ color, roughness })
  const wood = new MeshStandardMaterial({ color: "#d9c4a0", map: woodTexture, roughness: .88 })
  const darkWood = new MeshStandardMaterial({ color: "#89785b", map: woodTexture, roughness: .94 })
  const trim = material("#855b39"), moss = material("#68764b"), sage = material("#899568")
  const cream = material("#e8d8ae"), clay = material("#b87953"), soil = material("#3b3526")
  const leaf = [material("#536c3c"), material("#769054"), material("#99a365"), material("#3c6247")]
  const brass = material("#b89a56", .47), teal = material("#527d75"), paper = material("#e2cfa5")
  const bark = material("#705039")
  const geometries = new Map<string, RoundedBoxGeometry>()
  function add<T extends Mesh>(mesh: T, x: number, y: number, z: number, parent = room) {
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh)
    return mesh
  }
  function box(x: number, y: number, z: number, w: number, h: number, d: number, mat = wood, radius = .035, parent = room) {
    const key = [w, h, d, radius].join(":")
    let geometry = geometries.get(key)
    if (!geometry) { geometry = new RoundedBoxGeometry(w, h, d, 2, radius); geometries.set(key, geometry) }
    return add(new Mesh(geometry, mat), x, y, z, parent)
  }
  function cylinder(x: number, y: number, z: number, top: number, bottom: number, height: number, mat = wood, segments = 16) {
    return add(new Mesh(new CylinderGeometry(top, bottom, height, segments), mat), x, y, z)
  }
  function branch(from: number[], to: number[], radius: number, mat = bark) {
    const a = new Vector3(...from), b = new Vector3(...to), delta = b.clone().sub(a)
    const mesh = cylinder(...a.clone().add(b).multiplyScalar(.5).toArray() as [number, number, number], radius * .8, radius, delta.length(), mat, 10)
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize())
    return mesh
  }
  function book(x: number, y: number, z: number, color: MeshStandardMaterial, angle = 0) {
    const group = new Group(); group.position.set(x, y, z); group.rotation.y = angle; room.add(group)
    box(0, .035, 0, .34, .055, .46, paper, .008, group)
    box(0, .004, 0, .37, .018, .49, color, .006, group)
    box(0, .07, 0, .37, .018, .49, color, .006, group)
    box(-.174, .035, 0, .025, .07, .49, color, .004, group)
  }
  function plant(x: number, y: number, z: number, scale = 1) {
    cylinder(x, y + .16 * scale, z, .22 * scale, .16 * scale, .32 * scale, clay)
    cylinder(x, y + .32 * scale, z, .235 * scale, .235 * scale, .055 * scale, clay)
    cylinder(x, y + .35 * scale, z, .20 * scale, .20 * scale, .015 * scale, soil)
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4, height = (.37 + (i % 4) * .09) * scale
      const end = [x + Math.cos(angle) * .3 * scale, y + .35 * scale + height, z + Math.sin(angle) * .3 * scale]
      branch([x, y + .3 * scale, z], end, .012 * scale, leaf[0])
      const mesh = add(new Mesh(new SphereGeometry(1, 7, 5), leaf[i % 4]), end[0], end[1], end[2])
      mesh.scale.set(.15 * scale, .24 * scale, .04 * scale)
      mesh.rotation.set(.7 * Math.sin(angle), 0, -Math.cos(angle) * .95)
    }
  }
  // Thick plank floor, open balcony, and a small loft at the back.
  box(0, -.18, 0, 6.8, .32, 5.4, darkWood, .09)
  for (let i = 0; i < 19; i++) box(-3.21 + i * .356, .008, 0, .342, .09, 5.3, wood, .014)
  box(0, .07, 2.67, 6.9, .18, .15, trim)
  box(-3.32, .75, -.75, .14, 1.5, 3.8, darkWood)
  for (let i = 0; i < 10; i++) box(-3.22, 1.1, -2.35 + i * .35, .15, 2.2, .335, wood, .012)
  for (let i = 0; i < 18; i++) box(-3.12 + i * .355, 1.05, -2.57, .34, 2.1, .15, wood, .012)
  box(-1.66, 2.34, -1.91, 3.4, .19, 1.45, darkWood)
  for (let i = 0; i < 10; i++) box(-3.13 + i * .33, 2.46, -1.91, .32, .09, 1.4, wood)
  box(-1.7, 2.64, -2.04, 1.95, .29, .92, sage, .12)
  box(-2.35, 2.86, -2.07, .45, .2, .65, cream, .08)
  box(-1.15, 2.81, -2.04, .78, .14, .96, moss, .04)
  // Visible fold lines, not a featureless bed block.
  for (let i = 0; i < 5; i++) box(-1.45 + i * .13, 2.888, -2.04, .025, .012, .93, sage, .004)
  for (const x of [-3.28, -.02]) box(x, 1.57, -1.27, .15, 3.15, .18, darkWood)
  box(-1.65, 3.14, -1.27, 3.55, .18, .18, darkWood)
  const ladder = new Group(); ladder.position.set(-.08, 0, -.35); ladder.rotation.x = -.19; room.add(ladder)
  for (const x of [-.26, .26]) box(x, 1.23, 0, .065, 2.65, .09, trim, .02, ladder)
  for (let i = 0; i < 8; i++) box(0, .22 + i * .30, .01, .56, .065, .11, wood, .02, ladder)
  // Sofa: exposed timber, separate seat/back cushions, stitched throw and pillows.
  for (const x of [-2.88, -1.05]) for (const z of [-.69, .55]) box(x, .23, z, .14, .44, .14, darkWood)
  box(-1.98, .48, -.02, 2.28, .18, 1.43, trim, .07)
  box(-1.98, 1.04, -.68, 2.35, 1.06, .21, darkWood, .07)
  for (const x of [-2.55, -1.43]) {
    box(x, .69, .0, 1.07, .29, 1.19, moss, .13)
    const back = box(x, 1.17, -.5, 1.05, .76, .3, sage, .14); back.rotation.x = -.11
  }
  for (const x of [-3.11, -.85]) box(x, .86, -.03, .15, .25, 1.48, wood, .055)
  const pillow = box(-2.65, 1.03, -.07, .51, .52, .21, cream, .12); pillow.rotation.z = .18; pillow.rotation.x = -.22
  const pillow2 = box(-1.35, 1.04, -.16, .46, .47, .22, teal, .10); pillow2.rotation.z = -.17
  box(-1.02, .87, .25, .39, .09, .84, cream, .025)
  for (let i = 0; i < 6; i++) box(-1.18 + i * .06, .72, .68, .016, .23, .03, cream, .006)
  // Woven round rug with concentric borders.
  const rug = cylinder(.40, .081, .87, 1.67, 1.67, .025, sage, 80)
  rug.scale.z = .84
  for (const [r, mat] of [[1.58, cream], [1.52, moss], [1.37, cream]] as const) {
    const ring = add(new Mesh(new TorusGeometry(r, .012, 4, 96), mat), .4, .10, .87)
    ring.rotation.x = Math.PI / 2; ring.scale.y = .84
  }
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * Math.PI * 2
    const stitch = box(.4 + Math.cos(a) * 1.63, .099, .87 + Math.sin(a) * 1.37, .045, .012, .012, cream, .003)
    stitch.rotation.y = -a
  }
  // Low, rounded timber table. Ceramic tea, a tiny plant, and two books.
  for (const x of [-.18, .68]) for (const z of [.48, 1.19]) box(x, .29, z, .16, .4, .16, darkWood)
  const top = cylinder(.25, .54, .84, .81, .84, .17, wood, 48); top.scale.z = .83
  const edge = add(new Mesh(new TorusGeometry(.78, .014, 5, 64), darkWood), .25, .632, .84)
  edge.rotation.x = Math.PI / 2; edge.scale.y = .83
  book(.04, .64, .93, teal, -.2); book(.03, .73, .96, clay, -.06)
  plant(.62, .64, .54, .46)
  cylinder(.62, .66, 1.05, .15, .15, .023, cream)
  cylinder(.62, .75, 1.05, .09, .075, .16, cream, 24)
  cylinder(.62, .835, 1.05, .072, .072, .008, darkWood, 24)
  const handle = add(new Mesh(new TorusGeometry(.056, .018, 7, 14), cream), .73, .76, 1.05)
  handle.rotation.y = Math.PI / 2
  // Reading shelf and little original botanical picture.
  box(-3.04, 1.28, -1.85, .4, .09, 1.05, trim)
  plant(-3.01, 1.33, -2.1, .53)
  for (let i = 0; i < 5; i++) box(-2.99, 1.52, -1.7 + i * .085, .26, .34 + (i % 2) * .08, .066, [teal, clay, cream][i % 3], .008)
  box(-2.10, 1.47, -2.43, .59, .67, .055, darkWood, .02)
  box(-2.10, 1.47, -2.39, .48, .56, .018, paper, .01)
  branch([-2.1, 1.24, -2.365], [-2.1, 1.65, -2.365], .01, moss)
  for (let i = 0; i < 4; i++) {
    const mesh = add(new Mesh(new SphereGeometry(.07, 7, 5), leaf[i]), -2.1 + (i % 2 ? .07 : -.07), 1.32 + i * .08, -2.35)
    mesh.scale.set(1, .5, .08); mesh.rotation.z = i % 2 ? .6 : -.6
  }
  // A real tree anchors the room; the right side opens to the forest.
  branch([2.62, -.2, -1.75], [2.45, 3.7, -1.95], .35)
  branch([2.48, 2.25, -1.9], [1.35, 3.8, -2.1], .21)
  branch([2.5, 2.6, -1.9], [3.42, 3.75, -1.35], .17)
  for (let i = 0; i < 7; i++) branch([2.63 + Math.cos(i) * .24, 0, -1.7 + Math.sin(i) * .24], [2.52 + Math.cos(i) * .27, 2.5, -1.9 + Math.sin(i) * .27], .018, darkWood)
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4
    const crown = add(new Mesh(new SphereGeometry(1, 7, 5), leaf[i % 4]), 2.3 + Math.cos(a) * 1.3, 3.62 + Math.sin(i * 5) * .32, -1.9 + Math.sin(a) * .9)
    crown.scale.set(.75, .33, .52); crown.rotation.y = a
  }
  for (const x of [.42, 1.25, 2.08, 2.91, 3.35]) box(x, .64, -2.43, .065, 1.2, .08, trim)
  box(1.88, 1.24, -2.43, 3.1, .10, .14, wood)
  for (const z of [-1.63, -.79, .05, .89, 1.73]) box(3.3, .64, z, .08, 1.2, .065, trim)
  box(3.3, 1.24, -.25, .14, .1, 4.45, wood)
  plant(2.98, .05, -.62, 1.05)
  plant(.7, .05, -2.02, 1.1)
  plant(-3.0, .05, 1.84, .84)
  // Pendant, reading side table and soft amber lamp.
  box(-1.24, 3.15, -.14, .025, .77, .025, brass, .005)
  const shade = cylinder(-1.24, 2.69, -.14, .08, .30, .18, teal, 32)
  shade.material.side = DoubleSide
  const glow = material("#ffdf9c")
  glow.emissive = new Color("#ffca73"); glow.emissiveIntensity = .8
  add(new Mesh(new SphereGeometry(.075, 12, 8), glow), -1.24, 2.59, -.14)
  cylinder(-2.87, .44, 1.16, .36, .32, .1)
  cylinder(-2.87, .23, 1.16, .065, .12, .41, darkWood)
  book(-2.87, .5, 1.16, clay, .2)
  // Distant, softly layered green ridges and treetops, not a second settlement.
  const distant = new Group(); room.add(distant)
  for (let row = 0; row < 3; row++) {
    const mat = material(["#a5b6a0", "#7e9e87", "#527e67"][row])
    for (let i = 0; i < 14; i++) {
      const hill = new Mesh(new SphereGeometry(1, 24, 12), mat)
      hill.position.set(-16 + i * 3.2, -3.5 + row * .1, -24 + row * 4)
      hill.scale.set(4, 1.9 + Math.sin(i * 2 + row) * .7, 2.7)
      distant.add(hill)
    }
  }
  const forest = new Mesh(new SphereGeometry(1, 32, 16), material("#728f74"))
  forest.position.set(0, -6, -12); forest.scale.set(24, 3.4, 4); distant.add(forest)
  for (let i = 0; i < 32; i++) {
    const treetop = new Mesh(new SphereGeometry(1, 10, 7), leaf[i % 4])
    treetop.position.set(-12 + i * .82, -3.2 + Math.sin(i * 1.8) * .2, -12 - i % 3)
    treetop.scale.set(.9, .65, 1.1); distant.add(treetop)
  }
  // Trailing leaves soften the loft post.
  for (let i = 0; i < 11; i++) {
    const x = -3.16 + Math.sin(i * 1.4) * .10
    const sprig = new Mesh(new SphereGeometry(1, 7, 5), leaf[i % 4])
    sprig.position.set(x, 2.45 - i * .105, -1.12)
    sprig.scale.set(.11, .15, .035); sprig.rotation.z = i % 2 ? .7 : -.7; room.add(sprig)
  }
  // This camera has no interactive furniture. Batch static pieces by material
  // and shadow contract instead of paying a draw call for every plank/leaf.
  const batches = new Map<string, Mesh[]>()
  const originals = new Set<Mesh["geometry"]>()
  room.updateMatrixWorld(true)
  room.traverse(object => {
    if (!(object instanceof Mesh)) return
    if (Array.isArray(object.material)) throw new Error("Canopy static pieces need one material.")
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`
    const batch = batches.get(key) || []
    batch.push(object); batches.set(key, batch)
    originals.add(object.geometry)
  })
  const result = new Group()
  for (const pieces of batches.values()) {
    const transformed = pieces.map(piece => {
      const geometry = piece.geometry.index ? piece.geometry.toNonIndexed() : piece.geometry.clone()
      return geometry.applyMatrix4(piece.matrixWorld)
    })
    const geometry = mergeGeometries(transformed)
    transformed.forEach(piece => piece.dispose())
    if (!geometry) throw new Error("Canopy furniture batching failed.")
    const mesh = new Mesh(geometry, pieces[0].material)
    mesh.castShadow = pieces[0].castShadow; mesh.receiveShadow = pieces[0].receiveShadow
    result.add(mesh)
  }
  originals.forEach(geometry => geometry.dispose())
  room.clear()
  return result
}
