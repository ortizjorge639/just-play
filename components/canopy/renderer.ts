import {
  ACESFilmicToneMapping, AnimationClip, AnimationMixer, Color, DirectionalLight,
  Fog, HemisphereLight, Mesh, OrthographicCamera, PCFShadowMap, Scene, SkinnedMesh,
  SRGBColorSpace, WebGLRenderer, type Material, type Object3D, type Texture,
} from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { createRoom } from "./room"
import manifest from "@/art/canopy/robot-motion-v001/manifest.json"

export const R1_URL = "/canopy/r1-4f33b632.glb"

function disposeTree(root: Object3D) {
  const materials = new Set<Material>(), textures = new Set<Texture>()
  const geometries = new Set<Mesh["geometry"]>(), skeletons = new Set<SkinnedMesh["skeleton"]>()
  root.traverse(object => {
    if (object instanceof Mesh) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material)
        for (const value of Object.values(material)) if (value && typeof value === "object" && "isTexture" in value) textures.add(value as Texture)
      }
    }
    if (object instanceof SkinnedMesh) skeletons.add(object.skeleton)
    if (object instanceof DirectionalLight) object.shadow.dispose()
  })
  skeletons.forEach(skeleton => skeleton.dispose())
  geometries.forEach(geometry => geometry.dispose())
  textures.forEach(texture => texture.dispose())
  materials.forEach(material => material.dispose())
}

export async function mountNook(host: HTMLElement, signal: AbortSignal, onError: (cause: unknown) => void) {
  const scene = new Scene()
  let renderer: WebGLRenderer | undefined
  let mixer: AnimationMixer | undefined
  let observer: ResizeObserver | undefined
  let frame = 0, disposed = false, lastFrame = 0
  let animationTime: number | null = null
  const motion = matchMedia("(prefers-reduced-motion: reduce)")
  const request = new AbortController()
  const dispose = () => {
    if (disposed) return
    disposed = true
    request.abort()
    cancelAnimationFrame(frame)
    observer?.disconnect()
    motion.removeEventListener("change", visibility)
    document.removeEventListener("visibilitychange", visibility)
    signal.removeEventListener("abort", dispose)
    renderer?.domElement.removeEventListener("webglcontextlost", contextLost)
    mixer?.stopAllAction()
    if (mixer) mixer.uncacheRoot(mixer.getRoot())
    disposeTree(scene)
    renderer?.dispose()
    renderer?.forceContextLoss()
    renderer?.domElement.remove()
    scene.clear()
  }
  function contextLost(event: Event) {
    event.preventDefault()
    dispose()
    onError(new Error("WebGL context lost; switched to game artwork."))
  }
  const camera = new OrthographicCamera(-5, 5, 4, -4, .1, 80)
  camera.position.set(8.7, 7.0, 11.8)
  camera.lookAt(0, 1.25, -.3)
  function render() {
    if (disposed || document.visibilityState === "hidden") return
    try { renderer?.render(scene, camera) }
    catch (cause) { dispose(); onError(cause) }
  }
  function tick(time: number) {
    if (disposed) return
    frame = requestAnimationFrame(tick)
    if (time - lastFrame < 1000 / 24) return
    const delta = animationTime === null ? 0 : Math.max(0, Math.min((time - animationTime) / 1000, .08))
    lastFrame = time
    animationTime = time
    mixer?.update(delta * 1.25)
    render()
  }
  function visibility() {
    cancelAnimationFrame(frame)
    if (disposed || !renderer) return
    const hidden = document.visibilityState === "hidden"
    renderer.domElement.dataset.renderState = hidden ? "hidden" : motion.matches ? "reduced-motion" : "running"
    animationTime = null
    lastFrame = 0
    if (hidden) return
    render()
    if (!motion.matches) frame = requestAnimationFrame(tick)
  }
  try {
    if (signal.aborted) return dispose
    renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    renderer.domElement.setAttribute("aria-hidden", "true")
    renderer.domElement.addEventListener("webglcontextlost", contextLost)
    host.appendChild(renderer.domElement)
    signal.addEventListener("abort", dispose, { once: true })
    scene.background = new Color("#cdd9c4")
    scene.fog = new Fog("#cdd9c4", 18, 42)
    scene.add(new HemisphereLight("#fff0d5", "#716451", 2.1))
    const sun = new DirectionalLight("#ffe1a3", 2.6)
    sun.position.set(-3, 8, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -6; sun.shadow.camera.right = 6
    sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6
    sun.shadow.normalBias = .035
    sun.shadow.bias = -.0003
    sun.shadow.radius = 3
    scene.add(sun)
    scene.add(createRoom())
    const response = await fetch(R1_URL, { signal: request.signal })
    if (!response.ok) throw new Error(`R1 could not load (HTTP ${response.status}).`)
    const bytes = await response.arrayBuffer()
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("")
    if (bytes.byteLength !== manifest.asset.bytes || hash !== manifest.asset.sha256) throw new Error("R1 art verification failed.")
    if (disposed) return dispose
    const gltf = await new GLTFLoader().parseAsync(bytes, "")
    if (disposed) { disposeTree(gltf.scene); return dispose }
    scene.add(gltf.scene)
    gltf.scene.position.set(1.56, .07, 1.15)
    gltf.scene.rotation.y = .4
    gltf.scene.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true } })
    const idle = gltf.animations.find(clip => clip.name === "R1_Idle")
    if (!idle || !idle.tracks.some(track => track.name.startsWith("Face"))) throw new Error("R1's body/face Idle contract is missing.")
    mixer = new AnimationMixer(gltf.scene)
    // Body is smooth; facial tracks retain the original GLB's STEP interpolation.
    for (const [name, facial] of [["body", false], ["face", true]] as const) {
      const clip = new AnimationClip(`nook:${name}`, idle.duration, idle.tracks.filter(track => track.name.startsWith("Face") === facial))
      mixer.clipAction(clip).play()
    }
    mixer.update(.75)
    const resize = () => {
      if (disposed || !renderer) return
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      const aspect = width / height
      const halfHeight = Math.max(3.5, 4.25 / aspect)
      camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect
      camera.top = halfHeight; camera.bottom = -halfHeight
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1_700_000 / (width * height))))
      renderer.setSize(width, height)
      render()
    }
    observer = new ResizeObserver(resize)
    observer.observe(host)
    motion.addEventListener("change", visibility)
    document.addEventListener("visibilitychange", visibility)
    resize()
    visibility()
    if (disposed) throw new Error("Canopy rendering stopped. Use artwork view or retry the nook.")
    return dispose
  } catch (cause) {
    dispose()
    throw cause
  }
}
