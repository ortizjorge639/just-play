import {
  AnimationAction, AnimationClip, AnimationMixer, Color, LoopOnce, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Group, type Material, type Object3D,
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
  // Plays clips back to back, then settles into idle again.
  chain: (names: string[]) => void
  busy: () => boolean
  // Sit down (or stand up) with a short ease. Clips that move the whole body stand the figure up while they play.
  sit: (on: boolean) => void
  seated: () => boolean
  dispose: () => void
}

// Body tracks ease; the face keeps the stepped blinks and glances it was authored with.
const split = (clip: AnimationClip, name: string) => {
  const face = new AnimationClip(`${name}:face`, clip.duration, clip.tracks.filter((t) => t.name.startsWith("Face")))
  const body = new AnimationClip(`${name}:body`, clip.duration, clip.tracks.filter((t) => !t.name.startsWith("Face")))
  return [body, face]
}

const FORWARD = new Vector3(0, -0.1, 1).normalize()
const DOWN = new Vector3(0, -1, 0)

// The rig has no sitting clip, so the legs are bent by hand: thighs point forward, shins drop to the floor.
function makeSeat(object: Object3D) {
  const get = (name: string) => object.getObjectByName(name)
  const pelvis = get("Pelvis")
  const legs = (["L", "R"] as const).flatMap((side) => {
    const thigh = get(`Thigh${side}`), shin = get(`Shin${side}`), foot = get(`Foot${side}`)
    return thigh && shin && foot ? [{ thigh, shin, foot }] : []
  })
  if (!pelvis || legs.length !== 2) return null
  const rest = pelvis.position.y
  const drop = legs[0].shin.position.length()
  const dir = new Vector3(), aim = new Quaternion(), seatThigh = new Quaternion(), seatShin = new Quaternion(), inverse = new Quaternion()
  return (weight: number) => {
    pelvis.position.y = rest - drop * weight
    for (const { thigh, shin, foot } of legs) {
      const thighNow = thigh.quaternion.clone(), shinNow = shin.quaternion.clone()
      dir.copy(shin.position).applyQuaternion(thighNow).normalize()
      seatThigh.copy(aim.setFromUnitVectors(dir, FORWARD)).multiply(thighNow)
      dir.copy(foot.position).applyQuaternion(shinNow).applyQuaternion(seatThigh).normalize()
      inverse.copy(seatThigh).invert()
      seatShin.copy(inverse).multiply(aim.setFromUnitVectors(dir, DOWN)).multiply(seatThigh).multiply(shinNow)
      thigh.quaternion.copy(thighNow).slerp(seatThigh, weight)
      shin.quaternion.copy(shinNow).slerp(seatShin, weight)
    }
  }
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
  const queue: string[] = []
  const finished = (event: { action: AnimationAction }) => {
    if (!current.includes(event.action)) return
    const next = queue.shift()
    if (next) { start(next); return }
    current.splice(0).forEach((action) => action.fadeOut(0.25))
    playing = null
    idleActions.forEach((action) => action.reset().fadeIn(0.25).play())
  }
  const start = (name: string) => {
    const clip = source.clips.get(name)
    playing = name
    if (!clip) { const next = queue.shift(); if (next) start(next); return }
    let actions = once.get(name)
    if (!actions) {
      actions = split(clip, name).map((c) => { const a = mixer.clipAction(c); a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; return a })
      once.set(name, actions)
    }
    current.splice(0).forEach((action) => action.stop())
    idleActions.forEach((action) => action.fadeOut(0.25))
    actions.forEach((action) => { action.reset().fadeIn(0.15).play(); current.push(action) })
  }
  mixer.addEventListener("finished", finished as never)

  const pose = makeSeat(object)
  let wantSit = false, sitWeight = 0
  let playing: string | null = null

  let nextLook = 3 + (phase * 7) % 6
  return {
    object,
    update(seconds, now) {
      if (!current.length && now / 1000 >= nextLook) {
        nextLook = now / 1000 + 6 + Math.random() * 8
        this.play("look")
      }
      mixer.update(seconds)
      if (!pose) return
      const target = wantSit && (playing === null || playing === "look") ? 1 : 0
      sitWeight += (target - sitWeight) * Math.min(1, 6 * seconds)
      if (Math.abs(target - sitWeight) < 0.01) sitWeight = target
      if (sitWeight > 0) pose(sitWeight)
    },
    sit(on) { wantSit = on },
    seated: () => sitWeight > 0.5,
    busy: () => current.length > 0,
    play(name) { queue.length = 0; start(name) },
    chain(names) { queue.length = 0; queue.push(...names.slice(1)); start(names[0]) },
    dispose() {
      mixer.removeEventListener("finished", finished as never)
      mixer.stopAllAction()
      owned.forEach((m) => m.dispose())
    },
  }
}
