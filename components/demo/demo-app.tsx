"use client"

import dynamic from "next/dynamic"
import {
  Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type ErrorInfo, type ReactNode,
} from "react"
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Camera, Check, Compass,
  DoorOpen, Expand, Eye, Home, Map as MapIcon, MapPin, Maximize2, Minimize2, Moon,
  Navigation, RotateCcw, Settings, Sparkles, Sun, TreePine, X,
} from "lucide-react"
import type {
  CameraMode, DemoAction, DemoState, GameId, LocationId, SceneCommand,
  ScenePreferences, SceneSnapshot,
} from "@/lib/demo/contracts"
import {
  CONTRIBUTIONS, createDemoState, earnedStructure, GAMES, GAME_BY_ID, matchesObservedDemoSave, observeDemoSave,
  parseDemoSave, reduceDemoState, residentsFor, rulesFor, SAVE_KEY, type DemoSaveObservation,
} from "@/lib/demo/state"
import { getDemoLockManager, mutateDemoSave, resetDemoSave } from "@/lib/demo/storage"
import { isLocationVisible, LOCATION_BY_ID, locationTitle, SPAWN, visibleLocations } from "@/lib/demo/world"
import { DemoInteractionGuard } from "@/lib/demo/interaction"
import { RulesEditor } from "./ui/rules-editor"
import { BuildPanel } from "./ui/build-panel"
import { GameMark, Journal } from "./ui/journal"
import { DemoModal } from "./ui/modal"
import { WorldMap } from "./ui/world-map"
import { SPEC_EXAMPLES, SpecAnnotation, SpecGuide, type SpecId } from "./ui/spec-guide"

/*
 * THESIS: Games become people who stay; the canopy, not a dashboard, leads.
 * OWN-WORLD: Dark pine backplates, warm ivory, restrained amber, Georgia place names.
 * STORY: Invite a fictional game, choose proof, welcome a neighbor, place an earned contribution.
 * FIRST VIEWPORT: Full-bleed world; quiet brand above, place name below, compact edge controls.
 * FORM: The approved experience-first direction. Focused field-guide panels yield to the scene.
 */

const DemoScene = dynamic(() => import("./demo-scene"), { ssr: false })

type Panel = "journal" | "map" | "build" | "settings" | "help" | "story" | "reset" | "spec"
type SaveMode = "local" | "session" | "blocked" | "conflict"
type InitialSave = { world: DemoState; mode: SaveMode; issue: string | null; observed: DemoSaveObservation }
type PendingCommand = SceneCommand extends infer Command
  ? Command extends SceneCommand ? Omit<Command, "serial"> : never
  : never

const INITIAL_SNAPSHOT: SceneSnapshot = {
  player: { x: SPAWN[0], y: SPAWN[1], z: SPAWN[2], yaw: 0 },
  location: "plaza", nearby: "plaza", inside: false, residents: [],
}
const STOP = { x: 0, y: 0 }
const NOOP_SUBSCRIBE = () => () => {}
const SERVER_FALSE = () => false

function loadDemo(): InitialSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    const observed = observeDemoSave(raw)
    const locks = getDemoLockManager()
    if (raw === null) return locks
      ? { world: createDemoState(), mode: "local", issue: null, observed }
      : {
          world: createDemoState(), mode: "session",
          issue: "This browser can't safely coordinate local saves across tabs. You can still explore; changes will last only for this visit.",
          observed,
        }
    const parsed = parseDemoSave(raw)
    if (parsed.ok) return locks
      ? { world: parsed.value, mode: "local", issue: null, observed }
      : {
          world: parsed.value, mode: "session",
          issue: "Your saved world is loaded, but this browser can't safely coordinate changes across tabs. New changes will last only for this visit.",
          observed,
        }
    return { world: createDemoState(), mode: "blocked", issue: `${parsed.error} Your stored save is untouched.`, observed }
  } catch {
    return {
      world: createDemoState(), mode: "session",
      issue: "This browser won't allow local saves. You can still explore; changes will last only for this visit.",
      observed: observeDemoSave(null),
    }
  }
}

function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl2")
    if (!gl) return false
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return true
  } catch {
    return false
  }
}

class SceneBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError("The 3D scene couldn't stay open. Your journal and local world are still here.")
  }
  render() { return this.state.failed ? null : this.props.children }
}

function TouchPad({ onMove }: { onMove: (axis: { x: number; y: number }) => void }) {
  const held = useRef(new Map<number | string, { x: number; y: number }>())
  const clickTimers = useRef(new Map<string, number>())
  const suppressClick = useRef(new Set<string>())
  const update = () => {
    const axes = [...held.current.values()]
    onMove({
      x: Math.max(-1, Math.min(1, axes.reduce((sum, value) => sum + value.x, 0))),
      y: Math.max(-1, Math.min(1, axes.reduce((sum, value) => sum + value.y, 0))),
    })
  }
  useEffect(() => {
    const reset = () => {
      held.current.clear()
      for (const timer of clickTimers.current.values()) window.clearTimeout(timer)
      clickTimers.current.clear()
      suppressClick.current.clear()
      onMove(STOP)
    }
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", reset)
    return () => {
      window.removeEventListener("blur", reset)
      document.removeEventListener("visibilitychange", reset)
      reset()
    }
  }, [onMove])
  return <div className="demo-touch-pad" aria-label="Touch movement controls">
    {([
      { key: "up", label: "Walk forward", x: 0, y: -1, Icon: ArrowUp },
      { key: "left", label: "Walk left", x: -1, y: 0, Icon: ArrowLeft },
      { key: "down", label: "Walk backward", x: 0, y: 1, Icon: ArrowDown },
      { key: "right", label: "Walk right", x: 1, y: 0, Icon: ArrowRight },
    ] as const).map(({ key, label, x, y, Icon }) => <button
      key={key} className={`demo-touch-key is-${key}`} aria-label={label} title={label}
      onPointerDown={event => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        held.current.set(event.pointerId, { x, y })
        update()
      }}
      onPointerUp={event => { held.current.delete(event.pointerId); update() }}
      onPointerCancel={event => { held.current.delete(event.pointerId); update() }}
      onLostPointerCapture={event => { held.current.delete(event.pointerId); update() }}
      onKeyDown={event => {
        if (event.key !== " " && event.key !== "Enter") return
        event.preventDefault()
        if (event.repeat) return
        suppressClick.current.add(key)
        held.current.set(`keyboard:${key}`, { x, y })
        update()
      }}
      onKeyUp={event => {
        if (event.key !== " " && event.key !== "Enter") return
        event.preventDefault()
        held.current.delete(`keyboard:${key}`)
        update()
        window.setTimeout(() => suppressClick.current.delete(key), 0)
      }}
      onBlur={() => {
        held.current.delete(`keyboard:${key}`)
        suppressClick.current.delete(key)
        update()
      }}
      onClick={event => {
        if (event.detail !== 0) return
        if (suppressClick.current.delete(key)) return
        const token = `click:${key}`
        const previous = clickTimers.current.get(key)
        if (previous !== undefined) window.clearTimeout(previous)
        held.current.set(token, { x, y })
        update()
        clickTimers.current.set(key, window.setTimeout(() => {
          held.current.delete(token)
          clickTimers.current.delete(key)
          update()
        }, 180))
      }}
      onContextMenu={event => event.preventDefault()}
    ><Icon size={21} aria-hidden="true" /></button>)}
  </div>
}

const STORY = [
  { title: "An invitation beyond the tree", text: "Invite Sol from The Last Ember. Until your chosen proof is met, Sol travels outside the settlement: visible in the journal and map, not waiting at the lodge.", action: "Invite The Last Ember" },
  { title: "You decide what is enough", text: "Choose Sol's permanent arrival stamp below, or keep the default. Two hours can mean enough; later credits can mean more. Tier names never decide whether a neighbor belongs.", action: "Use this stamp · continue" },
  { title: "One stamp. A permanent neighbor.", text: "Self-confirm your chosen fictional milestone. The same Sol arrives permanently, with an ember reliquary beside the gathering tree. This is demonstration data, not externally verified play.", action: "Self-confirm arrival stamp" },
  { title: "A deeper story changes the world", text: "Self-confirm a structural tier. It earns Sol's hearth deck, not a duplicate Sol. The addition waits for you to choose a branch; later tiers enrich that same place.", action: "Self-confirm structural tier" },
  { title: "Choose where the memory belongs", text: "Place Sol's earned hearth deck on a compatible branch below. The platform, bridge, map entry, and walkable connection arrive together. No cost or timer.", action: "Continue after placement" },
  { title: "Some journeys take another shape", text: "Try a separate invitation to demonstrate an unfinished attempt. Nothing is replaced: if another game is active, handle it in the journal or skip this part.", action: "Invite for the postcard path" },
  { title: "Keep a little of the journey", text: "End that unarrived invitation. One postcard stays by the trailhead and in the journal. Re-inviting keeps it; arrival replaces it. You may delete it whenever you like.", action: "End invitation · leave postcard" },
  { title: "Nothing left to do. Just be here.", text: "The furnished grove home is open, and your earned additions are part of the canopy. Head to the lookout or leave the world in ambient view. Watching never earns progress.", action: "Admire from the lookout" },
] as const

export default function DemoApp() {
  const [initial] = useState(loadDemo)
  const [world, setWorld] = useState(initial.world)
  const [saveMode, setSaveMode] = useState<SaveMode>(initial.mode)
  const [saveIssue, setSaveIssue] = useState(initial.issue)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [specNote, setSpecNote] = useState<SpecId | null>(null)
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null)
  const [snapshot, setSnapshot] = useState<SceneSnapshot>(INITIAL_SNAPSHOT)
  const [command, setCommand] = useState<SceneCommand | null>(null)
  const [touch, setTouch] = useState(STOP)
  const [camera, setCamera] = useState<CameraMode>("explore")
  const [light, setLight] = useState<ScenePreferences["light"]>("golden")
  const [quality, setQuality] = useState<ScenePreferences["quality"]>(() => window.matchMedia("(max-width: 700px)").matches ? "low" : "high")
  const [motion, setMotion] = useState<"system" | "reduce" | "full">("system")
  const [sceneReady, setSceneReady] = useState(false)
  const [webgl, setWebgl] = useState(supportsWebGL)
  const [sceneError, setSceneError] = useState<string | null>(null)
  const [sceneKey, setSceneKey] = useState(0)
  const [toast, setToast] = useState<{ message: string; serial: number } | null>(null)
  const [photoPending, setPhotoPending] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [storyStep, setStoryStep] = useState<number | null>(null)
  const [tourFinished, setTourFinished] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const commandSerial = useRef(0)
  const toastSerial = useRef(0)
  const observedSave = useRef(initial.observed)
  const worldRef = useRef(initial.world)
  const saveModeRef = useRef(initial.mode)
  const [interaction] = useState(() => new DemoInteractionGuard())
  const [tourRemnant, setTourRemnant] = useState<GameId>("rain")
  const [tourTier, setTourTier] = useState("")
  const root = useRef<HTMLDivElement>(null)
  const downloadUrls = useRef(new Set<string>())
  const reducedOS = useSyncExternalStore(subscribeMotion, prefersReducedMotion, SERVER_FALSE)
  const fullscreenSupported = useSyncExternalStore(NOOP_SUBSCRIBE, () => Boolean(document.fullscreenEnabled), SERVER_FALSE)
  const reducedMotion = motion === "system" ? reducedOS : motion === "reduce"
  const preferences = useMemo(() => ({ camera, light, quality, reducedMotion }), [camera, light, quality, reducedMotion])
  const saveBlocked = saveMode === "blocked" || saveMode === "conflict"
  const blocked = saveBlocked || actionPending
  const fallback = !webgl || Boolean(sceneError)
  const ambient = camera === "ambient" || camera === "still"
  const worldSpecNote = specNote === "trinkets" && snapshot.location === "plaza" && !snapshot.inside ? specNote : null
  const residents = residentsFor(world)
  const location = LOCATION_BY_ID[snapshot.location]

  const notify = useCallback((message: string) => {
    toastSerial.current += 1
    setToast({ message, serial: toastSerial.current })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 6500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!photoPending) return
    const timer = window.setTimeout(() => {
      setPhotoPending(false)
      notify("The photo didn't arrive. Try again after the scene has settled, or switch to lower detail.")
    }, 12000)
    return () => window.clearTimeout(timer)
  }, [photoPending, notify])

  useEffect(() => {
    const urls = downloadUrls.current
    return () => { for (const url of urls) URL.revokeObjectURL(url); urls.clear() }
  }, [])

  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", changed)
    return () => document.removeEventListener("fullscreenchange", changed)
  }, [])

  useEffect(() => {
    if (saveMode !== "local") return
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== SAVE_KEY && event.key !== null) ||
        matchesObservedDemoSave(observedSave.current, event.newValue)) return
      updateSaveMode("conflict")
      setSaveIssue("This saved world changed in another tab. Your world in this tab is still here and has not overwritten it.")
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [saveMode])

  useEffect(() => {
    if (!ambient || panel) return
    const element = root.current
    let timer: number
    const wake = () => {
      element?.removeAttribute("data-ambient-idle")
      window.clearTimeout(timer)
      timer = window.setTimeout(() => element?.setAttribute("data-ambient-idle", "true"), 3200)
    }
    wake()
    window.addEventListener("pointermove", wake)
    window.addEventListener("pointerdown", wake)
    window.addEventListener("keydown", wake)
    window.addEventListener("focusin", wake)
    return () => {
      window.clearTimeout(timer)
      element?.removeAttribute("data-ambient-idle")
      window.removeEventListener("pointermove", wake)
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("keydown", wake)
      window.removeEventListener("focusin", wake)
    }
  }, [ambient, panel])

  const sendCommand = useCallback((next: PendingCommand) => {
    commandSerial.current += 1
    setCommand({ ...next, serial: commandSerial.current })
  }, [])

  const openPanel = useCallback((next: Panel) => {
    interaction.navigate()
    setSpecNote(null)
    setTouch(STOP)
    setPanel(next)
  }, [interaction])
  const closePanel = useCallback(() => { interaction.navigate(); setPanel(null); setSpecNote(null) }, [interaction])

  const travel = useCallback((destination: LocationId) => {
    interaction.navigate()
    setSpecNote(null)
    if (!isLocationVisible(destination, worldRef.current)) return
    setTouch(STOP)
    setPanel(null)
    setCamera("explore")
    sendCommand({ type: "travel", location: destination })
    // The accessible directory remains a usable world when no renderer is available.
    if (fallback) {
      const point = LOCATION_BY_ID[destination]
      setSnapshot({ player: { x: point.arrival[0], y: point.arrival[1], z: point.arrival[2], yaw: 0 }, location: destination, nearby: destination, inside: false, residents: [] })
    }
  }, [sendCommand, fallback, interaction])

  function inspectSpec(id: SpecId) {
    const { destination } = SPEC_EXAMPLES.find(example => example.id === id)!
    if ("location" in destination) travel(destination.location)
    else {
      if (destination.panel === "journal") setSelectedGame(destination.game)
      openPanel(destination.panel)
    }
    setSpecNote(id)
  }

  const enterHouse = useCallback(() => {
    interaction.navigate()
    setPanel(null)
    setTouch(STOP)
    setCamera("explore")
    if (fallback) {
      setSnapshot(previous => ({ ...previous, inside: true, nearby: "exit", location: "grove" }))
    } else sendCommand({ type: "enter" })
    notify("Inside the grove home. The door will take you back outside.")
  }, [fallback, sendCommand, notify, interaction])

  const exitHouse = useCallback(() => {
    if (fallback) setSnapshot(previous => ({ ...previous, inside: false, nearby: "grove" }))
    else sendCommand({ type: "exit" })
    notify("Back among the branches.")
  }, [fallback, sendCommand, notify])

  const onInteract = useCallback((target: LocationId | "door" | "exit") => {
    if (target === "door") enterHouse()
    else if (target === "exit") exitHouse()
    else if (["plot", "brook", "crown", "fern", "dusk", "meadow", "sunrise"].includes(target)) openPanel("build")
    else if (target === "grove" || target === "lookout") openPanel("map")
    else { setSelectedGame(null); openPanel("journal") }
  }, [enterHouse, exitHouse, openPanel])

  const receivePhoto = useCallback((blob: Blob) => {
    setPhotoPending(false)
    if (!blob.size) { notify("The photo was empty. Please try again."); return }
    let url: string | null = null
    let link: HTMLAnchorElement | null = null
    try {
      url = URL.createObjectURL(blob)
      downloadUrls.current.add(url)
      link = document.createElement("a")
      link.href = url
      link.download = `just-play-canopy-${new Date().toISOString().slice(0, 10)}.png`
      document.body.appendChild(link)
      link.click()
      notify("Your canopy photo is ready. Check your browser's downloads.")
      const downloadUrl = url
      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl)
        downloadUrls.current.delete(downloadUrl)
      }, 1000)
    } catch {
      if (url) { URL.revokeObjectURL(url); downloadUrls.current.delete(url) }
      notify("Your browser couldn't save this photo. Check its download permissions and try again.")
    } finally { link?.remove() }
  }, [notify])

  const receiveError = useCallback((message: string) => {
    setPhotoPending(false)
    if (/photo/i.test(message)) { notify(message); return }
    setSceneError(message)
    setSceneReady(false)
  }, [notify])
  const receiveReady = useCallback(() => setSceneReady(true), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || panel) return
      if (event.key === "Escape" && ambient) {
        event.preventDefault()
        setTouch(STOP)
        setCamera("explore")
        return
      }
      if (
        (target instanceof HTMLElement && target.closest("input, textarea, select, button, a, [contenteditable='true'], dialog, [role='dialog']"))) return
      const key = event.key.toLowerCase()
      if (key === "m") { event.preventDefault(); openPanel("map") }
      if (key === "j") { event.preventDefault(); setSelectedGame(null); openPanel("journal") }
      if (key === "h") {
        event.preventDefault()
        setTouch(STOP)
        setCamera(previous => previous === "ambient" || previous === "still" ? "explore" : reducedMotion ? "still" : "ambient")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [panel, ambient, reducedMotion, openPanel])

  function updateWorld(next: DemoState) {
    worldRef.current = next
    setWorld(next)
    setSnapshot(previous => isLocationVisible(previous.location, next) ? previous : INITIAL_SNAPSHOT)
  }

  function updateSaveMode(next: SaveMode) {
    saveModeRef.current = next
    setSaveMode(next)
  }

  async function applyAction(action: DemoAction, message: string) {
    if (interaction.pending) {
      notify("Finish the current change before making another one.")
      return false
    }
    if (saveModeRef.current === "blocked" || saveModeRef.current === "conflict") {
      notify(saveMode === "conflict" ? "Choose which world to keep before making another change." : "Choose how to handle your unreadable save before changing this world.")
      return false
    }
    if (!interaction.beginMutation()) return false
    setActionPending(true)
    try {
      const currentWorld = worldRef.current
      const currentMode = saveModeRef.current
      if (currentMode === "local") {
        const locks = getDemoLockManager()
        if (!locks) {
          const result = reduceDemoState(currentWorld, action)
          if (!result.ok) { notify(result.error); return false }
          updateWorld(result.value)
          updateSaveMode("session")
          setSaveIssue("Safe local saving became unavailable. This world is preserved for this visit, and the previous stored save is untouched.")
          notify(`${message} This change is session-only.`)
          return true
        }
        try {
          const mutation = await mutateDemoSave(localStorage, locks, observedSave.current, currentWorld, action)
          if (mutation.status === "rejected") { notify(mutation.error); return false }
          updateWorld(mutation.world)
          if (mutation.status === "conflict") {
            updateSaveMode("conflict")
            setSaveIssue("This saved world changed in another tab. Your latest change is safe in this tab and has not overwritten it.")
            notify(`${message} Choose whether to load the newer saved world or keep this tab session-only.`)
            return true
          }
          observedSave.current = mutation.observed
          notify(message)
          return true
        } catch {
          const result = reduceDemoState(currentWorld, action)
          if (!result.ok) { notify(result.error); return false }
          updateWorld(result.value)
          updateSaveMode("session")
          setSaveIssue("Your browser couldn't safely save this change. The world is safe in this tab, but changes will be lost when you leave. Your previous stored save is untouched.")
          notify(`${message} This change is session-only.`)
          return true
        }
      }
      const result = reduceDemoState(currentWorld, action)
      if (!result.ok) { notify(result.error); return false }
      updateWorld(result.value)
      notify(`${message.replace("in this browser", "for this visit")} (Session only.)`)
      return true
    } finally {
      interaction.endMutation()
      setActionPending(false)
    }
  }

  function retrySave() {
    if (interaction.pending) return
    interaction.navigate()
    const next = loadDemo()
    updateWorld(next.world)
    updateSaveMode(next.mode)
    setSaveIssue(next.issue)
    observedSave.current = next.observed
    notify(next.mode === "local" ? "Your local demo save is ready." : "Local saving still isn't available.")
  }

  function loadNewerSave() {
    if (interaction.pending) return
    interaction.navigate()
    const next = loadDemo()
    if (next.mode === "session") {
      updateSaveMode("session")
      setSaveIssue(next.issue)
      notify("The saved world couldn't be loaded. This tab remains session-only.")
      return
    }
    if (next.mode === "blocked") {
      updateSaveMode("blocked")
      setSaveIssue(`${next.issue} Your current world is still safe in this tab.`)
      observedSave.current = next.observed
      notify("The newer saved world couldn't be read.")
      return
    }
    updateWorld(next.world)
    updateSaveMode("local")
    setSaveIssue(null)
    observedSave.current = next.observed
    notify("The newer saved world is loaded.")
  }

  function keepCurrentSession() {
    if (interaction.pending) return
    interaction.navigate()
    updateSaveMode("session")
    setSaveIssue(null)
    notify("This tab's world is now session-only. Any existing stored demo save remains untouched.")
  }

  async function resetDemo() {
    if (!interaction.beginMutation()) return
    interaction.navigate()
    setActionPending(true)
    const freshWorld = createDemoState()
    let nextMode: SaveMode = saveModeRef.current === "local" ? "local" : "session"
    let nextIssue: string | null = null
    const locks = getDemoLockManager()
    if (!locks) {
      nextMode = "session"
      nextIssue = "This browser can't safely coordinate removal of the old demo save. This fresh world is session-only; the stored save may return next visit."
    } else {
      try {
        const mutation = await resetDemoSave(localStorage, locks, observedSave.current)
        if (mutation.status === "conflict") {
          nextMode = "conflict"
          nextIssue = "This saved world changed in another tab. Your fresh world is safe in this tab and the other saved world was not removed."
        } else {
          observedSave.current = mutation.observed
        }
      } catch {
        nextMode = "session"
        nextIssue = "The browser wouldn't remove the old demo save. This fresh world is session-only; the stored save may return next visit."
      }
    }
    updateWorld(freshWorld)
    updateSaveMode(nextMode)
    setSaveIssue(nextIssue)
    setSelectedGame(null)
    setStoryStep(null)
    setTourFinished(false)
    setPanel(null)
    setCamera("explore")
    setSnapshot(INITIAL_SNAPSHOT)
    setSceneReady(false)
    setSceneKey(previous => previous + 1)
    sendCommand({ type: "travel", location: "plaza" })
    notify("A fresh canopy. Pip and Wren are home, and four adventures are waiting.")
    interaction.endMutation()
    setActionPending(false)
  }

  function takePhoto() {
    if (!sceneReady || fallback || photoPending) return
    setPhotoPending(true)
    sendCommand({ type: "photo" })
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen()
      else notify("Fullscreen isn't supported here. You can still enjoy the world in this window.")
    } catch { notify("Fullscreen wasn't available. Try again using your browser's fullscreen control.") }
  }

  function retryScene() {
    setWebgl(supportsWebGL())
    setSceneError(null)
    setSceneReady(false)
    setCommand(null)
    setSnapshot(INITIAL_SNAPSHOT)
    setQuality("low")
    setSceneKey(previous => previous + 1)
  }

  function startTour() {
    interaction.navigate()
    setTourRemnant(GAMES.find(game => game.id === "rain" && !world.completions[game.id])?.id ??
      GAMES.find(game => game.id !== "ember" && !world.completions[game.id])?.id ?? "rain")
    setTourTier("")
    setStoryStep(0)
    setTourFinished(false)
    openPanel("story")
  }

  async function advanceStory() {
    if (interaction.pending) return
    const token = interaction.capture()
    const apply = async (action: DemoAction, message: string) =>
      await applyAction(action, message) && interaction.isCurrent(token)
    const step = storyStep ?? 0
    if (step === 0) {
      const active = GAMES.find(game => world.games[game.id] === "playing" && game.id !== "ember")
      if (active && world.games.ember === "backlog") { setSelectedGame(active.id); openPanel("journal"); return }
      if (world.games.ember === "backlog" && !await apply({ type: "start", gameId: "ember", at: new Date().toISOString() }, "Sol is invited, traveling beyond the settlement.")) return
      setStoryStep(1)
      openPanel("story")
    } else if (step === 1) {
      setStoryStep(2)
      openPanel("story")
    } else if (step === 2) {
      if (world.games.ember === "backlog") { setStoryStep(0); return }
      if (!world.completions.ember && !await apply({ type: "confirm", gameId: "ember", target: "stamp", at: new Date().toISOString() }, "Sol has arrived permanently. The ember reliquary is beside the gathering tree.")) return
      setStoryStep(3)
      travel(worldRef.current.homes.ember ?? "grove")
    } else if (step === 3) {
      if (!world.completions.ember) { setStoryStep(2); return }
      const structural = rulesFor(world, "ember").tiers.filter(tier => tier.structural)
      const target = structural.find(tier => tier.id === tourTier) ?? structural[0]
      if (!earnedStructure(world, "ember")) {
        if (!target) { setSelectedGame("ember"); openPanel("journal"); return }
        if (!await apply({ type: "confirm", gameId: "ember", target: target.id, at: new Date().toISOString() }, "Self-confirmed. Sol's hearth deck is earned and ready for your choice of branch.")) return
      }
      setStoryStep(4); openPanel("story")
    } else if (step === 4) {
      if (!world.placements.ember) return
      setStoryStep(5); travel(world.placements.ember)
    } else if (step === 5) {
      if (world.completions[tourRemnant]) { setStoryStep(7); return }
      const active = GAMES.find(game => world.games[game.id] === "playing" && game.id !== tourRemnant)
      if (active) { setSelectedGame(active.id); openPanel("journal"); return }
      if (world.games[tourRemnant] !== "playing" && !await apply({ type: "start", gameId: tourRemnant, at: new Date().toISOString() }, `${GAME_BY_ID[tourRemnant].character} is invited beyond the tree.`)) return
      setStoryStep(6); openPanel("story")
    } else if (step === 6) {
      if (world.games[tourRemnant] === "playing" && !world.completions[tourRemnant] &&
        !await apply({ type: "stop", gameId: tourRemnant, at: new Date().toISOString() }, "One postcard stays by the trailhead. No debt, no decay.")) return
      setStoryStep(7); travel("trailhead")
    } else {
      setTourFinished(true)
      setStoryStep(null)
      travel("lookout")
      setCamera(reducedMotion ? "still" : "ambient")
    }
  }

  const storyIndex = storyStep ?? 0
  const story = STORY[storyIndex]
  const activeOther = GAMES.find(game => world.games[game.id] === "playing" && game.id !== "ember")
  const structuralTiers = rulesFor(world, "ember").tiers.filter(tier => tier.structural)
  const storyAction = storyIndex === 0
    ? world.games.ember !== "backlog" ? "Continue Sol's existing story" : activeOther ? `Open ${activeOther.title}` : story.action
    : storyIndex === 2 && world.games.ember === "backlog" ? "Go back to Sol's beginning"
    : storyIndex === 2 && world.completions.ember ? "See Sol's permanent home"
    : storyIndex === 3 && !world.completions.ember ? "Return to arrival stamp"
    : storyIndex === 3 && earnedStructure(world, "ember") ? "See the earned contribution"
    : storyIndex === 3 && !structuralTiers.length ? "Choose a structural tier in the journal"
    : storyIndex === 5 && world.completions[tourRemnant] ? "All these neighbors already arrived · skip"
    : storyIndex === 6 && world.games[tourRemnant] !== "playing" ? "See the current trailhead"
    : story.action

  const panelHeading: Record<Panel, { title: string; description: string }> = {
    journal: { title: "Your game journal", description: "Six fictional games. A real little world to try." },
    map: { title: "A place for everyone", description: "Find a path, a neighbor, or a quiet corner." },
    build: { title: "Room on the next branch", description: "Earned additions. Your choice of place." },
    settings: { title: "Make yourself comfortable", description: "Set the light, camera, and pace of your canopy." },
    help: { title: "Find your feet", description: "Explore freely. Nothing here is a task to keep up with." },
    story: { title: "A small story, together", description: "A guided tour using the real demo. Leave or skip at any time." },
    spec: { title: "Your spec, in this demo", description: "What is demonstrated, where to find it, and what is still a stand-in." },
    reset: { title: "Start with a fresh canopy?", description: "This removes only this demo's local save: notes, proofs, rules, postcards, and builds. Your Just Play account and real games are not touched." },
  }

  const storageNotice = saveIssue ? <div className="demo-storage-notice" role="alert">
    <div><strong>{saveMode === "conflict" ? "Another tab saved a different world" : blocked ? "Your saved world needs a moment" : "Playing without a local save"}</strong><p>{saveIssue}</p></div>
    <div className="demo-storage-actions">
      {saveMode === "conflict" ? <>
        <button className="demo-text-button" disabled={actionPending} onClick={loadNewerSave}>Load newer saved world</button>
        <button className="demo-text-button" disabled={actionPending} onClick={keepCurrentSession}>Keep this world session-only</button>
      </> : saveBlocked ? <>
        <button className="demo-text-button" disabled={actionPending} onClick={retrySave}>Retry saved world</button>
        <button className="demo-text-button" disabled={actionPending} onClick={keepCurrentSession}>Continue session-only</button>
        <button className="demo-text-button" disabled={actionPending} onClick={() => openPanel("reset")}>Reset demo save</button>
      </> : <button className="demo-text-button" onClick={() => setSaveIssue(null)}>Continue session-only <Check size={16} aria-hidden="true" /></button>}
    </div>
  </div> : null

  return (
    <div ref={root} className={`canopy-demo${ambient ? " is-ambient" : ""}${fallback ? " is-fallback" : ""}`} data-reduced-motion={reducedMotion}>
      <a className="demo-skip-link" href="#demo-world-controls">Skip to world controls</a>
      <main className="demo-scene" aria-label="Your canopy world">
        {!fallback ? (
          <SceneBoundary key={sceneKey} onError={receiveError}>
            <DemoScene world={world} preferences={preferences} paused={panel !== null} command={command} touch={panel ? STOP : touch}
              onSnapshot={setSnapshot} onInteract={onInteract} onReady={receiveReady} onError={receiveError} onPhoto={receivePhoto} />
          </SceneBoundary>
        ) : (
          <section className="demo-scene-fallback" aria-label="Accessible world view">
            <WorldMap world={world} snapshot={snapshot} />
            <div>
              <h1>Your canopy is still here.</h1>
              <p>{sceneError ?? "This browser doesn't support the 3D view. You can still invite games, confirm milestones, keep notes, and place earned additions using the controls below."}</p>
              <div className="demo-action-row">
                <button className="demo-button" onClick={() => openPanel("journal")}><BookOpen size={18} aria-hidden="true" /> Open game journal</button>
                <button className="demo-button is-secondary" onClick={retryScene}>Retry 3D at lower detail</button>
              </div>
              {snapshot.inside && <p className="demo-fallback-room">Inside the grove home: a woven rug, a reading chair, a timber table, shelves of keepsakes, and warm lanterns. <button className="demo-inline-link" onClick={exitHouse}>Leave the home</button></p>}
            </div>
          </section>
        )}
      </main>

      <header className="demo-topbar">
        <div className="demo-brand"><TreePine size={23} strokeWidth={1.5} aria-hidden="true" /><span>Just Play</span><span className="demo-indicator">Demo</span></div>
        <div className="demo-top-actions">
          <button className="demo-icon-button" onClick={takePhoto} disabled={!sceneReady || fallback || photoPending} aria-label={photoPending ? "Preparing photo" : "Save a photo of the canopy"} title={photoPending ? "Preparing photo…" : "Save photo"}><Camera size={19} aria-hidden="true" /></button>
          <button className="demo-icon-button demo-fullscreen-control" onClick={toggleFullscreen} disabled={!fullscreenSupported} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreenSupported ? fullscreen ? "Exit fullscreen" : "Fullscreen" : "Fullscreen unavailable in this browser"}>{fullscreen ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}</button>
          <button className="demo-icon-button" onClick={() => openPanel("settings")} aria-label="World settings" title="World settings"><Settings size={19} aria-hidden="true" /></button>
          <button className="demo-help-button" onClick={() => openPanel("help")} aria-label="Help and controls" title="Help and controls">?</button>
        </div>
      </header>

      {!sceneReady && !fallback && <div className="demo-loading" role="status"><span className="demo-loading-seed" />Growing your canopy…</div>}

      {!panel && storageNotice}

      {!panel && !worldSpecNote && !toast && !saveIssue && <button className="demo-spec-launcher demo-button is-secondary" onClick={() => openPanel("spec")}>Spec guide <BookOpen size={16} aria-hidden="true" /></button>}

      {!panel && worldSpecNote ? <div className="demo-location-caption has-spec-note">
        <SpecAnnotation id={worldSpecNote} onBack={() => openPanel("spec")} onDismiss={() => setSpecNote(null)} />
      </div> : <div className="demo-location-caption">
        <p>{snapshot.inside ? "A home among the branches" : locationTitle(location.id, world)}</p>
        <span>{snapshot.inside ? "The story is on the shelves. The door is always open." : location.subtitle}</span>
      </div>}

      <nav id="demo-world-controls" className="demo-world-controls" aria-label="World controls" tabIndex={-1}>
        <button data-demo-menu className="demo-dock-button" onClick={() => { setSelectedGame(null); openPanel("journal") }} title="Game journal (J)"><BookOpen size={19} aria-hidden="true" /><span>Journal</span></button>
        <button className="demo-dock-button" onClick={() => openPanel("map")} title="Map and residents (M)"><MapIcon size={19} aria-hidden="true" /><span>Map</span></button>
        <button className="demo-dock-button" onClick={() => openPanel("build")} title="Place earned contributions"><Home size={19} aria-hidden="true" /><span>Build</span></button>
        <span className="demo-dock-divider" aria-hidden="true" />
        <button className="demo-dock-button demo-tour-button" onClick={storyStep === null ? startTour : () => openPanel("story")} title={storyStep === null ? "Take a guided tour" : "Continue guided tour"}><Sparkles size={18} aria-hidden="true" /><span>{storyStep === null ? tourFinished ? "Replay tour" : "Take a tour" : `Tour · ${storyStep + 1}/${STORY.length}`}</span></button>
      </nav>

      {!ambient && !panel && <div className="demo-context-controls">
        {snapshot.inside ? <button className="demo-context-button" onClick={exitHouse}><DoorOpen size={18} aria-hidden="true" /> Leave home {snapshot.nearby === "exit" && <kbd>E</kbd>}</button>
          : snapshot.location === "grove" ? <button className="demo-context-button" onClick={enterHouse}><DoorOpen size={18} aria-hidden="true" /> Enter grove home {snapshot.nearby === "door" && <kbd>E</kbd>}</button>
          : snapshot.nearby && <button className="demo-context-button" onClick={() => onInteract(snapshot.nearby ?? "plaza")}><MapPin size={17} aria-hidden="true" />{snapshot.nearby === "lodge" ? "Read the game journal" : snapshot.nearby === "trailhead" ? "Find your next adventure" : ["plot", "brook", "crown", "fern", "dusk", "meadow", "sunrise"].includes(snapshot.nearby) ? "See contributions" : snapshot.nearby === "lookout" ? "Look around" : "Open your journal"}<kbd>E</kbd></button>}
      </div>}

      <aside className="demo-wayfinding" aria-label="Map and camera">
        <div className="demo-camera-controls">
          <button className="demo-icon-button" onClick={() => setCamera(camera === "overview" ? "explore" : "overview")} aria-label={camera === "overview" ? "Use walking camera" : "Use overview camera"} aria-pressed={camera === "overview"} title={camera === "overview" ? "Walking camera" : "Overview camera"}><Expand size={18} aria-hidden="true" /></button>
          <button className="demo-icon-button" onClick={() => sendCommand({ type: "recenter" })} disabled={fallback} aria-label="Recenter camera on your character" title="Recenter camera"><Navigation size={18} aria-hidden="true" /></button>
          <button className="demo-icon-button" onClick={() => { setTouch(STOP); setCamera(ambient ? "explore" : reducedMotion ? "still" : "ambient") }} aria-label={ambient ? "Leave ambient view" : "Enter ambient view"} title="Ambient view (H)" aria-pressed={ambient}><Eye size={19} aria-hidden="true" /></button>
        </div>
        <button className="demo-minimap-button" onClick={() => openPanel("map")} aria-label="Open map and resident directory" title="Map and residents (M)">
          <WorldMap compact world={world} snapshot={snapshot} />
          <span><Compass size={14} aria-hidden="true" /> Canopy map</span>
        </button>
      </aside>

      {!ambient && !panel && !fallback && <TouchPad onMove={setTouch} />}
      <div className="demo-session-label">{saveMode === "local" ? "Fictional games · saved on this device" : "Fictional games · session only"}</div>

      {ambient && <div className="demo-ambient-controls">
        <span>{camera === "still" ? "A quiet still view" : "A little time among the trees"}</span>
        <button className="demo-text-button" onClick={() => setCamera(camera === "still" ? "ambient" : "still")}>{camera === "still" ? "Slow camera tour" : "Hold this view"}</button>
        <button className="demo-button is-secondary" onClick={() => setCamera("explore")}><X size={17} aria-hidden="true" /> Leave ambient</button>
      </div>}

      {toast && !panel && <div className="demo-toast" role="status" aria-live="polite">
        <span>{toast.message}</span>
        <button className="demo-icon-button" onClick={() => setToast(null)} aria-label="Dismiss message" title="Dismiss message"><X size={17} aria-hidden="true" /></button>
      </div>}

      {panel && <DemoModal title={panelHeading[panel].title} description={panelHeading[panel].description} onClose={closePanel} alert={panel === "reset"}>
        {storageNotice}
        {panel === "spec" && <SpecGuide onInspect={inspectSpec} onHelp={() => openPanel("help")} />}
        {specNote && <SpecAnnotation id={specNote} onBack={() => openPanel("spec")} onDismiss={() => setSpecNote(null)} />}
        {toast && <div className="demo-panel-toast" role="status" aria-live="polite">
          <span>{toast.message}</span><button className="demo-icon-button" onClick={() => setToast(null)} aria-label="Dismiss message" title="Dismiss message"><X size={17} aria-hidden="true" /></button>
        </div>}
        {panel === "journal" && <>
          {world.migratedFrom === 1 && <p className="demo-inline-notice">Your version-one world was upgraded without resetting it. Established residents, notes, first-arrival dates, and home assignments stay. {world.builtHouse ? "Fern House and its branch are preserved as a legacy build; the other six sites remain available." : "New additions are now earned through your own milestone rules."}</p>}
          <Journal world={world} selected={selectedGame} onSelect={setSelectedGame} onAction={applyAction} onTravel={travel} onBuild={() => openPanel("build")} blocked={blocked} />
        </>}
        {panel === "build" && <BuildPanel world={world} onAction={applyAction} onTravel={travel} blocked={blocked} />}
        {panel === "map" && <>
          <WorldMap world={world} snapshot={snapshot} />
          <p className="demo-map-legend"><Navigation size={15} aria-hidden="true" /> You are {snapshot.inside ? "inside the grove home" : `at ${location.title}`}.</p>
          {snapshot.inside && <button className="demo-button is-secondary" onClick={() => { exitHouse(); closePanel() }}><DoorOpen size={17} aria-hidden="true" /> Leave the grove home</button>}
          {!snapshot.inside && snapshot.location === "grove" && <button className="demo-button" onClick={enterHouse}><DoorOpen size={17} aria-hidden="true" /> Enter the furnished grove home</button>}
          <section className="demo-map-directory"><h3>Places to go</h3><ul>
            {visibleLocations(world).map(place => <li key={place.id}><button onClick={() => travel(place.id)}><span><strong>{locationTitle(place.id, world)}</strong><span>{place.id === "grove" ? "Travel here, then enter the furnished home." : place.subtitle}</span></span><ArrowRight size={18} aria-hidden="true" /><span className="demo-sr-only">Travel to {locationTitle(place.id, world)}</span></button></li>)}
          </ul></section>
          <section className="demo-map-directory"><h3>Neighbors, near and far</h3><p>Everyone wanders. Their home is always a good place to begin.</p><ul>
            {residents.map(resident => {
              const game = GAME_BY_ID[resident.gameId]
              const live = snapshot.residents.find(value => value.gameId === resident.gameId)
              return <li key={resident.gameId}><button onClick={() => travel(resident.home)}><GameMark game={game} /><span><strong>{game.character} <small>Arrived · permanent</small></strong><span>{game.title} · {LOCATION_BY_ID[resident.home].title}{live ? ` · ${live.activity}` : ""}</span></span><ArrowRight size={18} aria-hidden="true" /><span className="demo-sr-only">Visit {game.character}&apos;s home</span></button></li>
            })}
          </ul></section>
          <section className="demo-map-directory"><h3>Beyond the settlement</h3><p>Unarrived avatars are outside, not lodge visitors. Dashed circles mark compatible sites, not walkable destinations until an earned addition is placed.</p><ul>
            {GAMES.filter(game => !world.completions[game.id]).map(game => <li key={game.id}><button onClick={() => { setSelectedGame(game.id); openPanel("journal") }}><GameMark game={game} /><span><strong>{game.character} · {world.games[game.id] === "playing" ? "Invited, traveling" : "Backlogged possibility"}</strong><span>{rulesFor(world, game.id).stamp}{world.remnants[game.id] ? " · Postcard kept at the trailhead" : ""}</span></span><ArrowRight size={17} aria-hidden="true" /></button></li>)}
          </ul></section>
          <section className="demo-map-directory"><h3>What your games brought home</h3><ul>{GAMES.filter(game => world.completions[game.id]).map(game => <li key={game.id}><button onClick={() => travel(world.placements[game.id] ?? "plaza")}><GameMark game={game} /><span><strong>{game.character} · {world.placements[game.id] ? CONTRIBUTIONS[game.id].structure : CONTRIBUTIONS[game.id].small}</strong><span>{world.placements[game.id] ? locationTitle(world.placements[game.id]!, world) : earnedStructure(world, game.id) ? "Small exhibit at the gathering tree; earned addition awaiting placement in Build." : "Small exhibit beside the gathering tree."}</span></span><ArrowRight size={17} aria-hidden="true" /></button></li>)}</ul></section>
        </>}
        {panel === "settings" && <>
          <fieldset className="demo-setting-group"><legend>Camera</legend><div className="demo-option-grid">
            {([{ value: "explore", label: "Explore", detail: "Follow your footsteps", Icon: Navigation }, { value: "overview", label: "Overview", detail: "The whole canopy", Icon: MapIcon }, { value: "ambient", label: "Ambient tour", detail: "A slow camera drift", Icon: Eye }, { value: "still", label: "Still view", detail: "Hold the camera", Icon: Camera }] as const).map(option => <button className="demo-option" key={option.value} aria-pressed={camera === option.value} onClick={() => setCamera(option.value)}><option.Icon size={19} aria-hidden="true" /><span><strong>{option.label}</strong><span>{option.detail}</span></span>{camera === option.value && <Check size={16} aria-hidden="true" />}</button>)}
          </div></fieldset>
          <fieldset className="demo-setting-group"><legend>The light outside</legend><div className="demo-segmented">
            <button aria-pressed={light === "golden"} onClick={() => setLight("golden")}><Sun size={18} aria-hidden="true" /> Golden hour</button>
            <button aria-pressed={light === "night"} onClick={() => setLight("night")}><Moon size={18} aria-hidden="true" /> Lantern night</button>
          </div></fieldset>
          <fieldset className="demo-setting-group"><legend>Scene detail</legend><div className="demo-segmented">
            <button aria-pressed={quality === "high"} onClick={() => setQuality("high")}>Full detail</button>
            <button aria-pressed={quality === "low"} onClick={() => setQuality("low")}>Lighter on this device</button>
          </div><p>Lower detail is a gentler choice for phones and warm laptops.</p></fieldset>
          <div className="demo-setting-group"><label htmlFor="demo-motion">Motion</label><select id="demo-motion" value={motion} onChange={event => { const value = event.target.value; if (value === "system" || value === "reduce" || value === "full") setMotion(value) }}>
            <option value="system">Follow device preference</option><option value="reduce">Reduce motion</option><option value="full">Allow full motion</option>
          </select><p>{reducedMotion ? "Reduced motion is on. Ambient camera movement is held still." : "Slow character and camera movement is enabled."}</p></div>
          {fullscreenSupported && <div className="demo-setting-group"><button className="demo-button is-secondary" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}{fullscreen ? "Leave fullscreen" : "Enter fullscreen"}</button></div>}
          <div className="demo-setting-group"><h3>Your local world</h3><p>{saveMode === "local" ? "Only this demo's invitations, rules, proofs, notes, postcards, and placements are saved in this browser. Camera positions and settings aren't saved." : "This visit is session-only. Your changes won't be saved after you leave."}</p><p>Version 2 preserves version-one residents and builds. Real accounts are separate.</p><button className="demo-text-button is-danger" onClick={() => openPanel("reset")}><RotateCcw size={17} aria-hidden="true" /> Reset demo world</button></div>
          <button className="demo-button" onClick={closePanel}>Back to the canopy <ArrowRight size={17} aria-hidden="true" /></button>
        </>}
        {panel === "help" && <>
          <button className="demo-text-button" onClick={() => openPanel("spec")}>See your spec demonstrated here <ArrowRight size={17} aria-hidden="true" /></button>
          <section className="demo-help-section"><h3>A few ways to wander</h3><dl className="demo-key-list">
            <div><dt><kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd></dt><dd>Walk along platforms and bridges</dd></div>
            <div><dt>Drag the world</dt><dd>Turn the camera; scroll to zoom</dd></div>
            <div><dt><kbd>E</kbd></dt><dd>Interact with the nearest place or door</dd></div>
            <div><dt><kbd>M</kbd> / <kbd>J</kbd></dt><dd>Open the map or game journal</dd></div>
            <div><dt><kbd>H</kbd></dt><dd>Enter or leave ambient view</dd></div>
            <div><dt><kbd>Esc</kbd></dt><dd>Close a panel or leave ambient view</dd></div>
          </dl><p>On touchscreens, hold the arrow buttons to walk. Use the map for direct travel without steering. Keyboard shortcuts stay quiet while you use a panel, button, or text field.</p></section>
          <section className="demo-help-section"><h3>This is your little demo</h3><p>All six games and their characters are fictional. An invitation travels outside the settlement. Self-confirming your chosen stamp welcomes that same avatar permanently. Deeper tiers earn or enrich original contributions; choose a branch in Build to place an earned addition. Replaying never removes a resident.</p><p>Ending an unarrived invitation leaves one optional postcard, visible by the trailhead and in the journal. It stays through re-invites until arrival or manual deletion.</p><p>There are no points for wandering, no ticking game timer, and no real account connection. Friends&apos; visits are not part of this demo. Ambient view works in this browser—it is not a system screensaver.</p></section>
          <div className="demo-action-row"><button className="demo-button" onClick={startTour}>Take the guided tour <ArrowRight size={17} aria-hidden="true" /></button><button className="demo-button is-secondary" onClick={() => openPanel("map")}>Open accessible map</button></div>
        </>}
        {panel === "story" && <section className="demo-story">
          <div className="demo-story-progress" aria-label={`Tour step ${storyIndex + 1} of ${STORY.length}`}><span>Step {storyIndex + 1} of {STORY.length}</span><div>{STORY.map((_, index) => <span key={index} className={index <= storyIndex ? "is-current" : ""} />)}</div></div>
          <GameMark game={GAME_BY_ID[storyIndex === 5 || storyIndex === 6 ? tourRemnant : "ember"]} large />
          <h3>{story.title}</h3><p>{story.text}</p>
          {storyIndex === 0 && activeOther && world.games.ember === "backlog" && <p className="demo-inline-notice">You already have an adventure underway. Handle {activeOther.title} in the journal or skip this step. Nothing will be replaced.</p>}
          {storyIndex <= 2 && world.completions.ember && <p className="demo-inline-notice">Sol already has a permanent home in this save. We&apos;ll show you around without creating another Sol.</p>}
          {storyIndex === 1 && <RulesEditor world={world} gameId="ember" onAction={applyAction} blocked={blocked} />}
          {storyIndex === 2 && <p className="demo-inline-notice">Selected arrival stamp: {rulesFor(world, "ember").stamp}. Self-confirmation of a fictional sample only.</p>}
          {storyIndex === 3 && <div className="demo-setting-group">
            {!world.completions.ember && <p className="demo-inline-notice">Sol is not arrived yet. Return to the stamp or skip; nothing is granted automatically.</p>}
            {structuralTiers.length > 0 && <><label htmlFor="demo-tour-tier">Choose the deeper milestone</label><select id="demo-tour-tier" value={structuralTiers.some(tier => tier.id === tourTier) ? tourTier : structuralTiers[0].id} disabled={blocked} onChange={event => { interaction.navigate(); setTourTier(event.target.value) }}>{structuralTiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name} · {tier.milestone}</option>)}</select></>}
            {earnedStructure(world, "ember") && <p>This addition is already earned in your save. We won&apos;t create a duplicate.</p>}
          </div>}
          {storyIndex === 4 && <BuildPanel world={world} onAction={applyAction} onTravel={travel} blocked={blocked} />}
          {storyIndex === 5 && <div className="demo-setting-group"><label htmlFor="demo-tour-remnant">Choose the invitation to try</label><select id="demo-tour-remnant" value={tourRemnant} disabled={blocked} onChange={event => { interaction.navigate(); setTourRemnant(event.target.value as GameId) }}>
            {GAMES.filter(game => game.id !== "ember" && (!world.completions[game.id] || game.id === tourRemnant)).map(game => <option key={game.id} value={game.id}>{game.title}{world.completions[game.id] ? " · already arrived, will not be dropped" : ""}</option>)}
          </select></div>}
          {storyIndex === 6 && <p className="demo-inline-notice">{world.completions[tourRemnant] ? `${GAME_BY_ID[tourRemnant].character} already arrived. Their residency will not be changed.` : world.games[tourRemnant] === "playing" ? `${GAME_BY_ID[tourRemnant].character}'s active invitation will end; no arrival will be granted.` : world.remnants[tourRemnant] ? "A postcard from this invitation is already kept." : "No invitation is active for this game. Nothing will be dropped; go Back to invite or skip."}</p>}
          <button className="demo-button" onClick={advanceStory} disabled={blocked || storyIndex === 4 && !world.placements.ember}>{storyAction}<ArrowRight size={18} aria-hidden="true" /></button>
          <div className="demo-story-navigation">
            <button className="demo-text-button" disabled={storyIndex === 0} onClick={() => { interaction.navigate(); setStoryStep(Math.max(0, storyIndex - 1)) }}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
            <button className="demo-text-button" onClick={() => { interaction.navigate(); if (storyIndex < STORY.length - 1) setStoryStep(storyIndex + 1); else closePanel() }}>{storyIndex < STORY.length - 1 ? "Skip this step" : "Keep exploring"}</button>
            <button className="demo-text-button" onClick={() => { setStoryStep(null); closePanel() }}>End tour</button>
          </div><p className="demo-small-copy">The world pauses while you read. After each action, have a look around and use “Tour” below to continue.</p>
        </section>}
        {panel === "reset" && <div className="demo-reset"><p>You&apos;ll return to two residents, four backlog games, and an unbuilt plot. This can&apos;t be undone.</p><div className="demo-action-row"><button data-demo-cancel className="demo-button is-secondary" disabled={actionPending} onClick={() => openPanel("settings")}>Keep my canopy</button><button className="demo-button is-destructive" disabled={actionPending} onClick={resetDemo}>Reset only this demo</button></div></div>}
        {actionPending && <p className="demo-inline-notice" role="status">Saving your change… waiting for safe access to this device&apos;s demo save. You can close or leave the tour; its saved action will not bring you back.</p>}
        {saveBlocked && panel !== "reset" && <p className="demo-inline-notice">Resolve the saved-world notice before making another change. Close this panel to load the saved world, keep this one session-only, or reset only the demo.</p>}
      </DemoModal>}
    </div>
  )
}
