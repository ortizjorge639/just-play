import * as THREE from "three"
import marketingArtwork from "../../public/media/game-art/artwork.json"

// THESIS: A crowded shelf becomes one invitation, not a feature-grid slideshow.
// OWN-WORLD: Just Play's forest ink, amber, ivory, licensed real-game artwork.
// STORY: Too many choices → mood/energy/time → one game → a remembered session.
// FIRST VIEWPORT: Large silent-readable hook; a physical river of game cards.
// FORM: Brief-pinned 20-second cinematic flow; portrait and landscape reframing.
const width = window.innerWidth
const height = window.innerHeight
const portrait = height > width
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(width, height)
renderer.setPixelRatio(1)
renderer.setClearColor("#141714")
renderer.outputColorSpace = THREE.SRGBColorSpace
document.querySelector("#scene").append(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(portrait ? 48 : 40, width / height, .1, 100)
camera.position.set(0, 0, portrait ? 13 : 11)
scene.add(new THREE.AmbientLight(0xffffff, 2))
const light = new THREE.DirectionalLight(0xffe1a5, 3)
light.position.set(-4, 6, 8)
scene.add(light)
const loader = new THREE.TextureLoader()
await document.fonts.ready
const textures = await Promise.all(marketingArtwork.map(async artwork => {
  const source = await loader.loadAsync(artwork.image)
  const canvas = document.createElement("canvas")
  canvas.width = 800
  canvas.height = 600
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Cover composition requires a 2D canvas")
  const image = source.image
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
  context.fillStyle = "#141714"
  context.fillRect(0, 0, 800, 600)
  context.drawImage(image, (800 - image.width * scale) / 2, (600 - image.height * scale) / 2, image.width * scale, image.height * scale)
  const shade = context.createLinearGradient(0, 360, 0, 600)
  shade.addColorStop(0, "transparent")
  shade.addColorStop(1, "#141714")
  context.fillStyle = shade
  context.fillRect(0, 360, 800, 240)
  context.fillStyle = "#f3efe3"
  context.font = "700 60px system-ui"
  context.fillText(artwork.name, 36, 552)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  source.dispose()
  return texture
}))
const screenTextures = await Promise.all(["now-playing", "standby", "home"].map(async name => {
  const texture = await loader.loadAsync(`/media/${name}.png`)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}))
const cards = Array.from({ length: 28 }, (_, i) => {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.08, 1.58, .065),
    new THREE.MeshStandardMaterial({ color: i % 4 === 0 ? "#e2b56c" : "#3a3d35", roughness: .6, metalness: .12 }),
  )
  const coverIndex = i === 1 ? 0 : i === 0 ? 1 : i % textures.length
  const image = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), new THREE.MeshBasicMaterial({ map: textures[coverIndex] }))
  image.position.z = .038
  group.add(body, image)
  scene.add(group)
  return group
})
const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4), new THREE.MeshBasicMaterial({ map: screenTextures[0], transparent: true }))
scene.add(screen)
const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(6.48, 4.08, .07), new THREE.MeshStandardMaterial({ color: "#3a3d35", roughness: .7 }))
scene.add(screenFrame)
const heading = document.querySelector("#heading")
const subheading = document.querySelector("#subheading")
const footer = document.querySelector("#footer")
const caption = document.querySelector("#caption")
const titleBeats = [
  [0, "So many games.", "And somehow, nothing to play."],
  [3.5, "What fits tonight?", "Mood. Energy. Time."],
  [7, "One good choice.", "Less deciding. More playing."],
  [10, "Settle in.", "Your game. Your pace."],
  [14, "Keep your journey.", "Every session has a place."],
  [17, "Just Play.", "Flow through your backlog."],
]
const clamp = value => Math.min(1, Math.max(0, value))
const ease = value => 1 - (1 - clamp(value)) ** 4
const mix = (a, b, value) => a + (b - a) * value
const copy = { time: -1 }
window.renderFrame = time => {
  if (!Number.isFinite(time) || time < 0 || time > 20) throw new Error("Frame time must be between 0 and 20 seconds")
  const beat = titleBeats.findLastIndex(([start]) => time >= start)
  if (copy.time !== beat) {
    heading.textContent = titleBeats[beat][1]
    subheading.textContent = titleBeats[beat][2]
    copy.time = beat
  }
  const beatAge = time - titleBeats[beat][0]
  heading.style.transform = `translateY(${mix(12, 0, ease(beatAge / .55))}px)`
  heading.style.opacity = String(mix(.65, 1, ease(beatAge / .4)))
  subheading.style.opacity = String(mix(.6, 1, ease(beatAge / .7)))
  document.body.dataset.beat = String(beat)
  footer.style.opacity = time >= 17 ? "1" : "0"
  caption.textContent = time >= 10 && time < 17 ? "Actual app · staged demo data" : time >= 17
    ? "Art: Wildfire Games · Endless Sky · Freedoom\nCC BY-SA 4.0 media · credits: /media/artwork-credits.txt"
    : "Real-game artwork · no publisher endorsement"

  const converge = ease((time - 3.5) / 2.8)
  const choose = ease((time - 7) / 1.5)
  const toScreen = ease((time - 9.4) / .8)
  const outro = ease((time - 16.4) / .7)
  cards.forEach((card, i) => {
    const angle = i * 2.399 + time * .16
    const radius = 1.9 + Math.sqrt(i) * .59
    const driftX = Math.sin(angle) * radius * (portrait ? .59 : 1.2)
    const driftY = Math.cos(angle) * radius * (portrait ? .65 : .46) + (portrait ? -1.4 : -1.65)
    const driftZ = -2 - i * .12 + Math.sin(i + time * .5) * .6
    const selected = i < 3
    const selectedX = (i - 1) * (portrait ? 1.18 : 2.7)
    const selectedY = portrait ? -1.2 - Math.abs(i - 1) * .6 : -.4
    card.visible = time < 10 || time >= 17
    if (time >= 17) {
      const fan = ease((time - 17) / .8)
      card.visible = i < 4
      card.position.set((i - 1.5) * (portrait ? .95 : 1.6), portrait ? -1.7 : -1.3, -.2)
      card.rotation.set(0, (i - 1.5) * .11, (i - 1.5) * -.12)
      card.scale.setScalar(mix(.1, portrait ? .73 : .85, fan))
      return
    }
    card.position.set(
      mix(driftX, selected ? selectedX : driftX * 3.5, converge),
      mix(driftY, selected ? selectedY : driftY * 3.5, converge),
      mix(driftZ, selected ? .3 : -14, converge),
    )
    card.rotation.set(mix(Math.sin(i) * .3, 0, converge), mix(Math.cos(i) * .6, (i - 1) * -.12, converge), mix(Math.sin(i * 4) * .45, (i - 1) * -.06, converge))
    card.scale.setScalar(mix(1, selected ? (portrait ? .74 : 1.02) : .01, converge))
    if (selected && choose > 0) {
      card.position.x = mix(selectedX, i === 1 ? 0 : selectedX * 5, choose)
      card.position.y = mix(selectedY, portrait ? -1.4 : -.5, choose)
      card.rotation.y *= 1 - choose
      card.rotation.z *= 1 - choose
      card.scale.setScalar(mix(portrait ? .74 : 1.02, i === 1 ? (portrait ? 1.8 : 2.3) * (1 - toScreen) : .01, choose))
    }
  })
  screen.visible = time >= 9.4 && time < 17
  screenFrame.visible = screen.visible
  screen.material.map = time >= 14 ? screenTextures[2] : time >= 11.5 ? screenTextures[1] : screenTextures[0]
  screen.material.opacity = toScreen * (1 - outro)
  const shotScale = portrait ? .66 : 1.04
  screen.scale.setScalar(shotScale * mix(.92, 1, ease((time - 10) / 6)))
  screen.position.set(0, portrait ? -1.65 : -.55, .2)
  screen.rotation.set(.025 * Math.sin(time), .06 * Math.sin(time * .6), -.018 * Math.sin(time))
  screenFrame.position.copy(screen.position)
  screenFrame.position.z -= .05
  screenFrame.rotation.copy(screen.rotation)
  screenFrame.scale.copy(screen.scale)
  screenFrame.scale.multiplyScalar(1 - outro)
  renderer.render(scene, camera)
  const center = new THREE.Vector3().setFromMatrixPosition(cards[1].matrixWorld).project(camera)
  const pixel = new Uint8Array(4)
  if (time >= 7.5 && time <= 9) {
    renderer.getContext().readPixels(
      Math.round((center.x + 1) * width / 2),
      Math.round((center.y + 1) * height / 2),
      1, 1, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, pixel,
    )
  }
  window.frameEvidence = { time, beat, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, artworkPixel: Array.from(pixel), coverDimensions: textures.map(texture => [texture.image.width, texture.image.height]) }
}
await document.fonts.ready
window.renderFrame(0)
window.reelReady = true
document.querySelector("#preview").addEventListener("click", () => {
  const started = performance.now()
  const tick = now => {
    const time = Math.min(20, (now - started) / 1000)
    window.renderFrame(time)
    if (time < 20) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
