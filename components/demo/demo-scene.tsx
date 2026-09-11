"use client"

import { Component, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode, type RefObject } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  ACESFilmicToneMapping, BackSide, Color, Group, Mesh, MeshStandardMaterial,
  ShaderMaterial, Vector3,
} from "three"
import type { DemoSceneProps, GameId, Resident, SceneSnapshot } from "@/lib/demo/contracts"
import { GAME_BY_ID, residentsFor } from "@/lib/demo/state"
import { canWalk, DOOR, groundHeight, INTERIOR_CENTER, isLocationVisible, LOCATION_BY_ID, nearestLocation, SPAWN, type WorldLayout } from "@/lib/demo/world"
import { findWorldPath, type WorldPoint } from "@/lib/demo/navigation"
import { unobstructedCamera } from "@/lib/demo/camera"
import { buildCharacter, buildContributions, buildVillage, disposeVillage, seeded } from "./geometry"

type ResidentPosition = SceneSnapshot["residents"][number]
const TEMP = new Vector3()
const ignoredTarget = (target: EventTarget | null) => target instanceof HTMLElement &&
  !!target.closest("input,textarea,select,button,a,dialog,[role=dialog],[contenteditable=true]")

class SceneBoundary extends Component<{ onError: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Canopy scene failed", error, info.componentStack)
    this.props.onError("The 3D world could not open. Your journal and demo controls are still available.")
  }
  render() { return this.state.failed ? null : this.props.children }
}

function FrameClock({ ambient, paused, quality }: { ambient: boolean; paused: boolean; quality: DemoSceneProps["preferences"]["quality"] }) {
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    invalidate()
    if (paused) return
    let frame = 0, last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (document.hidden || now - last < (ambient || quality === "low" ? 1000 / 30 : 1000 / 60)) return
      last = now
      invalidate()
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ambient, paused, quality, invalidate])
  return null
}

function Sky({ night }: { night: boolean }) {
  const material = useMemo(() => new ShaderMaterial({
    side: BackSide, depthWrite: false,
    uniforms: { top: { value: new Color("#86a6a1") }, bottom: { value: new Color("#e3caa6") } },
    vertexShader: "varying vec3 vPosition; void main(){ vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "varying vec3 vPosition; uniform vec3 top; uniform vec3 bottom; void main(){ float h=clamp(normalize(vPosition).y*.9+.15,0.,1.); gl_FragColor=vec4(mix(bottom,top,pow(h,.65)),1.); #include <tonemapping_fragment> #include <colorspace_fragment> }".replaceAll(" #include", "\n#include").replace(" }", "\n}"),
  }), [])
  useEffect(() => {
    material.uniforms.top.value.set(night ? "#173541" : "#86a6a1")
    material.uniforms.bottom.value.set(night ? "#78908a" : "#e3caa6")
  }, [material, night])
  useEffect(() => () => material.dispose(), [material])
  return <mesh material={material} renderOrder={-1}><sphereGeometry args={[220, 24, 16]} /></mesh>
}

function Village({ world, night }: { world: DemoSceneProps["world"]; night: boolean }) {
  const { builtHouse, placements, completions, merits, remnants } = world
  const village = useMemo(() => buildVillage({ builtHouse, placements }), [builtHouse, placements])
  const contributions = useMemo(() => buildContributions({ placements, completions, merits, remnants }), [placements, completions, merits, remnants])
  useEffect(() => {
    village.traverse(object => {
      if (object instanceof Mesh && object.material instanceof MeshStandardMaterial && object.material.emissiveIntensity) {
        object.material.emissiveIntensity = night ? 1.35 : 0.65
      }
    })
  }, [village, night])
  useEffect(() => () => disposeVillage(village), [village])
  useEffect(() => () => disposeVillage(contributions), [contributions])
  return <><primitive object={village} /><primitive object={contributions} /></>
}

function Clouds({ reducedMotion, night }: { reducedMotion: boolean; night: boolean }) {
  const group = useRef<Group>(null)
  const cloudData = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    x: (seeded(i + 90) - 0.5) * 190, y: -9 - seeded(i + 40) * 8,
    z: (seeded(i + 18) - 0.5) * 160, scale: 8 + seeded(i + 3) * 12,
  })), [])
  useFrame(({ clock }) => {
    if (group.current) group.current.position.x = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.012) * 3
  })
  return <group ref={group}>{cloudData.map((cloud, index) =>
    <mesh key={index} position={[cloud.x, cloud.y, cloud.z]} scale={[cloud.scale, 2.6, cloud.scale * 0.55]}>
      <sphereGeometry args={[1, 10, 6]} />
      <meshBasicMaterial color={night ? "#688580" : "#ddd5ba"} transparent opacity={0.2} depthWrite={false} />
    </mesh>,
  )}</group>
}

function ResidentActor({ resident, built, paused, reducedMotion, positions }: {
  resident: Resident; built: WorldLayout; paused: boolean; reducedMotion: boolean
  positions: RefObject<Map<GameId, ResidentPosition>>
}) {
  const game = GAME_BY_ID[resident.gameId]
  const index = ["mosslight", "ember", "paper", "tide", "orbit", "rain"].indexOf(game.id)
  const character = useMemo(() => buildCharacter(game.color, index), [game.color, index])
  const position = useRef(new Vector3())
  const route = useRef<WorldPoint[]>([])
  const wait = useRef(1 + index)
  const cycle = useRef(0)
  const phase = useRef(index * 4.3)
  const activity = useRef("Taking in the view")
  const initialized = useRef(false)
  const builtRef = useRef(built)
  useEffect(() => {
    builtRef.current = built
    if (!initialized.current || !canWalk(position.current.x, position.current.z, built)) {
      const arrival = LOCATION_BY_ID[resident.home].arrival
      position.current.set(arrival[0] + (index % 2 ? -0.7 : 0.7), arrival[1], arrival[2] + index * 0.22)
      initialized.current = true
    }
    route.current = []
    wait.current = 0.5
    cycle.current = 0
  }, [resident.home, resident.kind, built, index])
  useEffect(() => {
    const registry = positions.current
    return () => {
      registry.delete(game.id)
      disposeVillage(character.group)
    }
  }, [character, game.id, positions])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (!initialized.current) return
    if (!paused) {
      phase.current += dt
      if (!route.current.length) {
        wait.current -= dt
        if (wait.current <= 0) {
          const stops = [resident.home, "plaza", "lookout", resident.home] as const
          const next = stops[cycle.current++ % stops.length]
          const [x, y, z] = LOCATION_BY_ID[next].arrival
          const target = { x: x + (index % 2 ? -0.5 : 0.5), y, z: z + (index % 3) * 0.35 }
          route.current = findWorldPath(position.current, target, builtRef.current).slice(1)
          activity.current = `Walking to ${LOCATION_BY_ID[next].title.toLowerCase()}`
          if (!route.current.length) wait.current = 4
        }
      }
      const target = route.current[0]
      if (target) {
        const dx = target.x - position.current.x, dz = target.z - position.current.z
        const distance = Math.hypot(dx, dz), step = dt * (0.82 + index * 0.035)
        if (distance < step + 0.05) {
          position.current.set(target.x, groundHeight(target.x, target.z, built) ?? target.y, target.z)
          route.current.shift()
          if (!route.current.length) {
            wait.current = 7 + seeded(cycle.current + index) * 10
            activity.current = ["Watching the canopy", "Enjoying a quiet moment", "Remembering an adventure"][index % 3]
          }
        } else {
          position.current.x += dx / distance * step
          position.current.z += dz / distance * step
          position.current.y = groundHeight(position.current.x, position.current.z, built) ?? position.current.y
          const yaw = Math.atan2(dx, dz)
          const angle = Math.atan2(Math.sin(yaw - character.group.rotation.y), Math.cos(yaw - character.group.rotation.y))
          character.group.rotateY(angle * Math.min(1, dt * 8))
        }
      }
    }
    const walking = route.current.length > 0 && !paused
    const bob = !reducedMotion && !paused ? Math.sin(phase.current * (walking ? 7 : 1.7)) * (walking ? 0.045 : 0.018) : 0
    character.group.position.set(position.current.x, position.current.y + bob, position.current.z)
    character.limbs.forEach((limb, limbIndex) => {
      limb.rotation.set(walking ? Math.sin(phase.current * 7 + (limbIndex < 2 ? 0 : Math.PI)) * (limbIndex % 2 ? -0.3 : 0.4) : 0, 0, 0)
    })
    positions.current.set(game.id, { gameId: game.id, x: position.current.x, z: position.current.z, activity: activity.current })
  })
  return <primitive object={character.group} />
}

function World(props: DemoSceneProps) {
  const { world, preferences, paused, command, touch, onSnapshot, onInteract, onReady, onError, onPhoto } = props
  const { camera, gl, size, scene } = useThree()
  const character = useMemo(() => buildCharacter("#d3ac65", 1), [])
  const player = useRef(new Vector3(...SPAWN))
  const yaw = useRef(0.45)
  const pitch = useRef(0.6)
  const distance = useRef(46)
  const keys = useRef(new Set<string>())
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null)
  const inside = useRef(false)
  const focus = useRef(new Vector3(0, 3, 0))
  const simTime = useRef(0)
  const lastSnapshot = useRef(0)
  const nearest = useRef<SceneSnapshot["nearby"]>(null)
  const registry = useRef(new Map<GameId, ResidentPosition>())
  const lastCommand = useRef(-1)
  const residents = useMemo(() => residentsFor(world), [world])
  const layout = useMemo(() => ({ builtHouse: world.builtHouse, placements: world.placements }), [world.builtHouse, world.placements])
  const live = useRef({ paused, preferences, onInteract, onError, onPhoto, touch })
  useEffect(() => { live.current = { paused, preferences, onInteract, onError, onPhoto, touch } }, [paused, preferences, onInteract, onError, onPhoto, touch])

  useEffect(() => {
    gl.domElement.setAttribute("aria-label", "Explore your treehouse world. Use W A S D or arrow keys to walk, drag to look, E to interact.")
    gl.domElement.setAttribute("tabindex", "0")
    gl.domElement.style.setProperty("touch-action", "none")
    onReady()
  }, [gl, onReady])
  useEffect(() => () => disposeVillage(character.group), [character])

  useEffect(() => {
    const canvas = gl.domElement
    const release = () => { keys.current.clear(); pointer.current = null }
    const keydown = (event: KeyboardEvent) => {
      if (ignoredTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      if (live.current.paused) return
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(event.code)) {
        event.preventDefault()
        keys.current.add(event.code)
      }
      if (event.code === "KeyE" && !event.repeat && nearest.current && live.current.preferences.camera === "explore") {
        event.preventDefault()
        live.current.onInteract(nearest.current)
      }
    }
    const keyup = (event: KeyboardEvent) => keys.current.delete(event.code)
    const down = (event: PointerEvent) => {
      if (live.current.paused) return
      canvas.focus({ preventScroll: true })
      canvas.setPointerCapture(event.pointerId)
      pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    }
    const move = (event: PointerEvent) => {
      const point = pointer.current
      if (!point || point.id !== event.pointerId || live.current.paused) return
      yaw.current -= (event.clientX - point.x) * 0.005
      pitch.current = Math.max(0.27, Math.min(1.15, pitch.current + (event.clientY - point.y) * 0.004))
      pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    }
    const up = (event: PointerEvent) => {
      if (pointer.current?.id === event.pointerId) pointer.current = null
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (live.current.paused) return
      distance.current = Math.max(10, Math.min(64, distance.current + event.deltaY * 0.018))
    }
    const lost = (event: Event) => {
      event.preventDefault()
      release()
      live.current.onError("The graphics connection was interrupted. Reload the world to continue; your local progress is kept.")
    }
    window.addEventListener("keydown", keydown)
    window.addEventListener("keyup", keyup)
    window.addEventListener("blur", release)
    document.addEventListener("visibilitychange", release)
    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerup", up)
    canvas.addEventListener("pointercancel", up)
    canvas.addEventListener("wheel", wheel, { passive: false })
    canvas.addEventListener("webglcontextlost", lost)
    return () => {
      window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup)
      window.removeEventListener("blur", release); document.removeEventListener("visibilitychange", release)
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up)
      canvas.removeEventListener("wheel", wheel); canvas.removeEventListener("webglcontextlost", lost)
    }
  }, [gl])
  useEffect(() => { if (paused || preferences.camera !== "explore") keys.current.clear() }, [paused, preferences.camera])
  useEffect(() => {
    if (!inside.current && !canWalk(player.current.x, player.current.z, layout)) {
      player.current.set(...SPAWN); inside.current = false
    }
  }, [layout])
  useEffect(() => {
    if (!command || command.serial === lastCommand.current) return
    lastCommand.current = command.serial
    if (command.type === "travel") {
      if (!isLocationVisible(command.location, layout)) {
        return
      }
      if (inside.current) distance.current = 46
      player.current.set(...LOCATION_BY_ID[command.location].arrival)
      inside.current = false
      keys.current.clear()
      focus.current.copy(player.current).add(new Vector3(0, 2.7, -1))
    } else if (command.type === "enter") {
      inside.current = true
      player.current.set(INTERIOR_CENTER, 0, 3)
      yaw.current = 0; pitch.current = 0.58; distance.current = 12
      focus.current.copy(player.current).add(new Vector3(0, 1, -2))
    } else if (command.type === "exit") {
      inside.current = false; player.current.set(...DOOR)
      player.current.z += 0.9
      distance.current = 22; pitch.current = 0.6
      focus.current.copy(player.current).add(new Vector3(0, 2, -1))
    } else if (command.type === "recenter") {
      yaw.current = 0.45; pitch.current = 0.6; distance.current = inside.current ? 12 : 46
    } else if (command.type === "photo") {
      gl.render(scene, camera)
      gl.domElement.toBlob(blob => {
        if (blob) onPhoto(blob)
        else onError("The photo could not be created. Try a lower graphics quality and capture again.")
      }, "image/png")
    }
  }, [command, layout, camera, gl, scene, onError, onPhoto])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (!paused) simTime.current += dt
    let vx = 0, vz = 0
    if (!paused && preferences.camera === "explore") {
      const forward = Number(keys.current.has("KeyW") || keys.current.has("ArrowUp")) - Number(keys.current.has("KeyS") || keys.current.has("ArrowDown")) - touch.y
      const side = Number(keys.current.has("KeyD") || keys.current.has("ArrowRight")) - Number(keys.current.has("KeyA") || keys.current.has("ArrowLeft")) + touch.x
      vx = side * Math.cos(yaw.current) - forward * Math.sin(yaw.current)
      vz = -forward * Math.cos(yaw.current) - side * Math.sin(yaw.current)
      const length = Math.hypot(vx, vz)
      if (length > 1) { vx /= length; vz /= length }
      const speed = (keys.current.has("ShiftLeft") || keys.current.has("ShiftRight") ? 5.8 : 3.9) * dt
      const steps = Math.max(1, Math.ceil(speed / 0.12))
      for (let step = 0; step < steps; step++) {
        const x = player.current.x + vx * speed / steps
        const z = player.current.z + vz * speed / steps
        if (inside.current) {
          const isClear = (xx: number, zz: number) => Math.abs(xx - INTERIOR_CENTER) < 4.6 && zz > -4.5 && zz < 4.5 &&
            !(xx < INTERIOR_CENTER - 2.2 && zz < 0.9 && zz > -3.4) &&
            !(xx > INTERIOR_CENTER + 1.15 && xx < INTERIOR_CENTER + 3.3 && zz > 0.25 && zz < 1.95) &&
            !(xx > INTERIOR_CENTER + 2.1 && zz < -2.3)
          if (isClear(x, player.current.z)) player.current.x = x
          if (isClear(player.current.x, z)) player.current.z = z
        } else {
          if (canWalk(x, player.current.z, layout)) player.current.x = x
          if (canWalk(player.current.x, z, layout)) player.current.z = z
          player.current.y = groundHeight(player.current.x, player.current.z, layout) ?? player.current.y
        }
      }
      if (length > 0.01) {
        const targetYaw = Math.atan2(vx, vz)
        character.group.rotateY(Math.atan2(Math.sin(targetYaw - character.group.rotation.y), Math.cos(targetYaw - character.group.rotation.y)) * Math.min(1, dt * 12))
      }
    }
    const moving = Math.hypot(vx, vz) > 0.01
    character.group.position.set(player.current.x, player.current.y + (moving && !preferences.reducedMotion ? Math.sin(simTime.current * 10) * 0.045 : 0), player.current.z)
    character.limbs.forEach((limb, i) => {
      limb.rotation.set(moving ? Math.sin(simTime.current * 10 + (i < 2 ? 0 : Math.PI)) * (i % 2 ? -0.35 : 0.45) : 0, 0, 0)
    })
    const isAmbient = preferences.camera === "ambient" || preferences.camera === "still"
    const lerp = preferences.reducedMotion ? 1 : 1 - Math.exp(-dt * 5)
    if (preferences.camera === "still" || (preferences.camera === "ambient" && preferences.reducedMotion)) {
      TEMP.copy(camera.position)
    } else if (isAmbient) {
      const angle = simTime.current * 0.018 + 0.65
      const target = inside.current ? new Vector3(INTERIOR_CENTER, 1.3, -1) : new Vector3(1, 4, -3)
      const radius = inside.current ? 12 : 45
      focus.current.lerp(target, lerp)
      TEMP.set(target.x + Math.sin(angle) * radius, target.y + (inside.current ? 7 : 24), target.z + Math.cos(angle) * radius)
    } else if (preferences.camera === "overview") {
      focus.current.lerp(inside.current ? new Vector3(INTERIOR_CENTER, 0, 0) : new Vector3(3, 0, -1), lerp)
      TEMP.copy(focus.current).add(new Vector3(9, inside.current ? 17 : 62, inside.current ? 9 : 32))
    } else {
      const focusHeight = inside.current ? 1.1 : 2.4 + Math.max(0, distance.current - 25) * 0.15
      focus.current.lerp(player.current.clone().add(new Vector3(0, focusHeight, inside.current ? -1 : -2)), lerp)
      const zoom = distance.current * (size.width < 600 && !inside.current ? 1.45 : 1)
      TEMP.set(Math.sin(yaw.current) * Math.cos(pitch.current) * zoom, Math.sin(pitch.current) * zoom, Math.cos(yaw.current) * Math.cos(pitch.current) * zoom).add(focus.current)
    }
    camera.position.lerp(TEMP, lerp)
    if (!isAmbient && preferences.camera === "explore") {
      const safe = unobstructedCamera(focus.current, camera.position, layout, inside.current)
      camera.position.set(safe.x, safe.y, safe.z)
    }
    camera.lookAt(focus.current)
    const location = inside.current ? LOCATION_BY_ID.grove : nearestLocation(player.current.x, player.current.z, layout)
    nearest.current = inside.current ? (player.current.z > 2.2 ? "exit" : null)
      : Math.hypot(player.current.x - DOOR[0], player.current.z - DOOR[2]) < 2 ? "door"
      : Math.hypot(player.current.x - location.arrival[0], player.current.z - location.arrival[2]) < 4.3 ? location.id : null
    lastSnapshot.current += dt
    if (lastSnapshot.current >= 0.25) {
      lastSnapshot.current = 0
      onSnapshot({
        player: { x: player.current.x, y: player.current.y, z: player.current.z, yaw: yaw.current },
        location: location.id, nearby: nearest.current, inside: inside.current,
        residents: [...registry.current.values()],
      })
    }
  })
  const night = preferences.light === "night"
  return <>
    <fog attach="fog" args={[night ? "#78908a" : "#d2c7a8", 48, 150]} />
    <Sky night={night} />
    <hemisphereLight args={[night ? "#a8c7ca" : "#e5eee0", night ? "#374b42" : "#84745b", night ? 1.2 : 2.2]} />
    <directionalLight position={[-20, 45, 25]} intensity={night ? 0.9 : 2.7} color={night ? "#aec8d1" : "#ffdcab"}
      castShadow={preferences.quality === "high"} shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={40} shadow-camera-bottom={-35}
      shadow-camera-far={130} shadow-normalBias={0.08} shadow-bias={-0.0003} />
    <pointLight position={[INTERIOR_CENTER, 3.3, 0]} intensity={12} distance={14} color="#ffc777" />
    <Village world={world} night={night} />
    <Clouds reducedMotion={preferences.reducedMotion || paused} night={night} />
    <primitive object={character.group} />
    {residents.map(resident => <ResidentActor key={resident.gameId} resident={resident} built={layout}
      paused={paused} reducedMotion={preferences.reducedMotion} positions={registry} />)}
  </>
}

export default function DemoScene(props: DemoSceneProps) {
  return <SceneBoundary onError={props.onError}>
    <Canvas camera={{ position: [18, 31, 39], fov: 48, near: 0.1, far: 300 }}
      dpr={props.preferences.quality === "low" ? 0.85 : [1, 1.5]}
      shadows={props.preferences.quality === "high"} frameloop="demand"
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping }}
      fallback="This browser cannot display the 3D canvas. Use the accessible journal and map.">
      <FrameClock ambient={props.preferences.camera === "ambient" || props.preferences.camera === "still"} paused={props.paused} quality={props.preferences.quality} />
      <World {...props} />
    </Canvas>
  </SceneBoundary>
}
