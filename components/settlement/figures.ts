import {
  AnimationAction, AnimationClip, AnimationMixer, Color, LoopOnce, Mesh, MeshStandardMaterial, type Group, type Material, type Object3D,
} from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { clone } from "three/addons/utils/SkeletonUtils.js"

// The starter companion's rig doubles as every resident's body. Only the shell colour changes per game.
export const FIGURE_URL = "/canopy/r1-4f33b632.glb"
export const FIGURE_HEIGHT = 1.21

export interface FigureSource { scene: Group; clips: Map<string, AnimationClip> }

export async function loadFigureSource(signal: AbortSignal): Promise<FigureSource> {
  const response = await fetch(FIGURE_URL, { signal })
  if (!response.ok) throw new Error(`${FIGURE_URL} could not load (HTTP ${response.status}).`)
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "")
  return { scene: gltf.scene, clips: new Map(gltf.animations.map((clip) => [clip.name.replace(/^R1_/, "").toLowerCase(), clip])) }
}

export interface Figure {
  object: Object3D
  update: (seconds: number, now: number) => void
  // Plays a one-off clip (look, jump, land, emotes, greeting) over the idle loop.
  play: (name: string) => void
  dispose: () => void
}

// Body tracks ease; the face keeps the stepped blinks and glances it was authored with.
const split = (clip: AnimationClip, name: string) => {
  const face = new AnimationClip(`${name}:face`, clip.duration, clip.tracks.filter((t) => t.name.startsWith("Face")))
  const body = new AnimationClip(`${name}:body`, clip.duration, clip.tracks.filter((t) => !t.name.startsWith("Face")))
  return [body, face]
}

export function createFigure(source: FigureSource, shell: string, phase: number): Figure {
  const object = clone(source.scene)
  const owned = new Set<Material>()
  object.traverse((o) => {
    if (!(o instanceof Mesh)) return
    o.frustumCulled = false
    const m = o.material as Material
    if (!(m instanceof MeshStandardMaterial) || !/^ochre/.test(m.name)) return
    const copy = m.clone()
    const tint = new Color(shell)
    copy.color.copy(m.name === "ochre_dark" ? tint.multiplyScalar(0.55) : tint)
    owned.add(copy)
    o.material = copy
  })

  const mixer = new AnimationMixer(object)
  const idle = source.clips.get("idle")
  const idleActions = idle ? split(idle, "idle").map((clip) => mixer.clipAction(clip)) : []
  idleActions.forEach((action) => { action.play(); action.time = phase % (idle?.duration ?? 1) })
  const once = new Map<string, AnimationAction[]>()
  const current: AnimationAction[] = []
  const finished = (event: { action: AnimationAction }) => {
    if (!current.includes(event.action)) return
    current.splice(0).forEach((action) => action.fadeOut(0.25))
    idleActions.forEach((action) => action.reset().fadeIn(0.25).play())
  }
  mixer.addEventListener("finished", finished as never)

  let nextLook = 3 + (phase * 7) % 6
  return {
    object,
    update(seconds, now) {
      if (!current.length && now / 1000 >= nextLook) {
        nextLook = now / 1000 + 6 + Math.random() * 8
        this.play("look")
      }
      mixer.update(seconds)
    },
    play(name) {
      const clip = source.clips.get(name)
      if (!clip) return
      let actions = once.get(name)
      if (!actions) {
        actions = split(clip, name).map((c) => { const a = mixer.clipAction(c); a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; return a })
        once.set(name, actions)
      }
      current.splice(0).forEach((action) => action.stop())
      idleActions.forEach((action) => action.fadeOut(0.25))
      actions.forEach((action) => { action.reset().fadeIn(0.25).play(); current.push(action) })
    },
    dispose() {
      mixer.removeEventListener("finished", finished as never)
      mixer.stopAllAction()
      owned.forEach((m) => m.dispose())
    },
  }
}
