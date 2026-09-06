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
  createDemoState, GAMES, GAME_BY_ID, matchesObservedDemoSave, observeDemoSave,
  parseDemoSave, reduceDemoState, residentsFor, SAVE_KEY, type DemoSaveObservation,
} from "@/lib/demo/state"
import { getDemoLockManager, mutateDemoSave, resetDemoSave } from "@/lib/demo/storage"
import { LOCATION_BY_ID, SPAWN, visibleLocations } from "@/lib/demo/world"
import { BuildPanel } from "./ui/build-panel"
import { GameMark, Journal } from "./ui/journal"
import { DemoModal } from "./ui/modal"
import { WorldMap } from "./ui/world-map"

/*
 * THESIS: Games become people who stay; the canopy, not a dashboard, leads.
 * OWN-WORLD: Dark pine backplates, warm ivory, restrained amber, Georgia place names.
 * STORY: Start a fictional game, meet its visitor, finish it, and make them a home.
 * FIRST VIEWPORT: Full-bleed world; quiet brand above, place name below, compact edge controls.
 * FORM: The approved experience-first direction. Focused field-guide panels yield to the scene.
 */

const DemoScene = dynamic(() => import("./demo-scene"), { ssr: false })

type Panel = "journal" | "map" | "build" | "settings" | "help" | "story" | "reset"
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
  { title: "A story starts with a visitor", text: "Try The Last Ember. Starting this fictional game brings Sol to the travelers' lodge—someone to share the tree with while their story unfolds.", action: "Start The Last Ember" },
  { title: "Meet a familiar face", text: "Sol is part of the world now. Visit the lodge and look for the ember-colored traveler. Characters wander through the shared plaza, just like neighbors.", action: "Visit the travelers' lodge" },
  { title: "The adventure ends. Sol stays.", text: "Mark the sample game complete. The same Sol becomes a permanent resident, with a memory of the journey. No replacement, no disappearing friend.", action: "Complete the sample game" },
  { title: "Make room for someone", text: "Build Fern House on the next branch, then give Sol a place there. Their memory and identity come with them.", action: "Build Fern House" },
  { title: "Nothing left to do. Just be here.", text: "Head to the lookout, choose the evening light, or leave the canopy in ambient view. Wandering earns no points and adds no game progress. This part is simply yours to enjoy.", action: "Admire from the lookout" },
] as const

export default function DemoApp() {
  const [initial] = useState(loadDemo)
  const [world, setWorld] = useState(initial.world)
  const [saveMode, setSaveMode] = useState<SaveMode>(initial.mode)
  const [saveIssue, setSaveIssue] = useState(initial.issue)
  const [panel, setPanel] = useState<Panel | null>(null)
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
  const actionPendingRef = useRef(false)
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
    setTouch(STOP)
    setPanel(next)
  }, [])
  const closePanel = useCallback(() => setPanel(null), [])

  const travel = useCallback((destination: LocationId) => {
    setTouch(STOP)
    setPanel(null)
    setCamera("explore")
    sendCommand({ type: "travel", location: destination })
    // The accessible directory remains a usable world when no renderer is available.
    if (fallback) {
      const point = LOCATION_BY_ID[destination]
      setSnapshot({ player: { x: point.arrival[0], y: point.arrival[1], z: point.arrival[2], yaw: 0 }, location: destination, nearby: destination, inside: false, residents: [] })
    }
  }, [sendCommand, fallback])

  const enterHouse = useCallback(() => {
    setPanel(null)
    setTouch(STOP)
    setCamera("explore")
    if (fallback) {
      setSnapshot(previous => ({ ...previous, inside: true, nearby: "exit", location: "grove" }))
    } else sendCommand({ type: "enter" })
    notify("Inside the grove home. The door will take you back outside.")
  }, [fallback, sendCommand, notify])

  const exitHouse = useCallback(() => {
    if (fallback) setSnapshot(previous => ({ ...previous, inside: false, nearby: "grove" }))
    else sendCommand({ type: "exit" })
    notify("Back among the branches.")
  }, [fallback, sendCommand, notify])

  const onInteract = useCallback((target: LocationId | "door" | "exit") => {
    if (target === "door") enterHouse()
    else if (target === "exit") exitHouse()
    else if (target === "plot") openPanel("build")
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
  }

  function updateSaveMode(next: SaveMode) {
    saveModeRef.current = next
    setSaveMode(next)
  }

  async function applyAction(action: DemoAction, message: string) {
    if (actionPendingRef.current) {
      notify("Finish the current change before making another one.")
      return false
    }
    if (saveBlocked) {
      notify(saveMode === "conflict" ? "Choose which world to keep before making another change." : "Choose how to handle your unreadable save before changing this world.")
      return false
    }
    actionPendingRef.current = true
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
      actionPendingRef.current = false
      setActionPending(false)
    }
  }

  function retrySave() {
    const next = loadDemo()
    updateWorld(next.world)
    updateSaveMode(next.mode)
    setSaveIssue(next.issue)
    observedSave.current = next.observed
    notify(next.mode === "local" ? "Your local demo save is ready." : "Local saving still isn't available.")
  }

  function loadNewerSave() {
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
    updateSaveMode("session")
    setSaveIssue(null)
    notify("This tab's world is now session-only. The newer saved world remains untouched.")
  }

  async function resetDemo() {
    if (actionPendingRef.current) return
    actionPendingRef.current = true
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
    actionPendingRef.current = false
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
    setStoryStep(0)
    setTourFinished(false)
    openPanel("story")
  }

  async function advanceStory() {
    const step = storyStep ?? 0
    if (step === 0) {
      const active = GAMES.find(game => world.games[game.id] === "playing" && game.id !== "ember")
      if (active && world.games.ember === "backlog") { setSelectedGame(active.id); openPanel("journal"); return }
      if (world.games.ember === "backlog" && !await applyAction({ type: "start", gameId: "ember", at: new Date().toISOString() }, "Sol has arrived. A visitor for a story just beginning.")) return
      const currentWorld = worldRef.current
      setStoryStep(1)
      travel(currentWorld.completions.ember ? (currentWorld.homes.ember ?? "grove") : "lodge")
    } else if (step === 1) {
      setStoryStep(2)
      travel(world.completions.ember ? (world.homes.ember ?? "grove") : "lodge")
    } else if (step === 2) {
      if (world.games.ember === "backlog") { setStoryStep(0); return }
      if (world.games.ember === "playing" && !await applyAction({ type: "complete", gameId: "ember", at: new Date().toISOString() }, "Sol is a permanent resident now. Same face. A place to stay.")) return
      const currentWorld = worldRef.current
      setStoryStep(3)
      travel(currentWorld.homes.ember ?? "grove")
    } else if (step === 3) {
      if (!world.builtHouse) {
        if (await applyAction({ type: "build" }, "Fern House and its bridge are ready. Next, invite Sol to move in.")) travel("plot")
      } else if (world.completions.ember && world.homes.ember !== "plot") {
        if (await applyAction({ type: "move", gameId: "ember", home: "plot" }, "Sol now lives at Fern House. Their story came with them.")) {
          setStoryStep(4)
          travel("plot")
        }
      } else { setStoryStep(4); openPanel("story") }
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
  const storyAction = storyIndex === 0
    ? world.games.ember !== "backlog" ? "Find Sol in the world" : activeOther ? `Open ${activeOther.title}` : story.action
    : storyIndex === 1 && world.completions.ember ? "Visit Sol's home"
    : storyIndex === 2 && world.games.ember === "backlog" ? "Go back to Sol's beginning"
    : storyIndex === 2 && world.games.ember === "completed" ? "See Sol in the grove"
    : storyIndex === 3 && world.builtHouse ? world.completions.ember && world.homes.ember !== "plot" ? "Move Sol into Fern House" : "Enjoy the new branch"
    : story.action

  const panelHeading: Record<Panel, { title: string; description: string }> = {
    journal: { title: "Your game journal", description: "Six fictional games. A real little world to try." },
    map: { title: "A place for everyone", description: "Find a path, a neighbor, or a quiet corner." },
    build: { title: "Room on the next branch", description: "One new home, made for stories that stay." },
    settings: { title: "Make yourself comfortable", description: "Set the light, camera, and pace of your canopy." },
    help: { title: "Find your feet", description: "Explore freely. Nothing here is a task to keep up with." },
    story: { title: "A small story, together", description: "A guided tour using the real demo. Leave or skip at any time." },
    reset: { title: "Start with a fresh canopy?", description: "This removes only this demo's local save, including your notes and Fern House. Your Just Play account and real games are not touched." },
  }

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
              <p>{sceneError ?? "This browser doesn't support the 3D view. You can still meet the cast, keep notes, and build a home using the controls below."}</p>
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

      {saveIssue && <div className="demo-storage-notice" role="alert">
        <div><strong>{saveMode === "conflict" ? "Another tab saved a different world" : blocked ? "Your saved world needs a moment" : "Playing without a local save"}</strong><p>{saveIssue}</p></div>
        <div className="demo-storage-actions">
          {saveMode === "conflict" ? <>
            <button className="demo-text-button" onClick={loadNewerSave}>Load newer saved world</button>
            <button className="demo-text-button" onClick={keepCurrentSession}>Keep this world session-only</button>
          </> : blocked ? <>
            <button className="demo-text-button" disabled={actionPending} onClick={retrySave}>Retry saved world</button>
            <button className="demo-text-button" disabled={actionPending} onClick={() => { updateSaveMode("session"); setSaveIssue(null); notify("This visit is session-only. Your stored save won't be changed.") }}>Continue session-only</button>
            <button className="demo-text-button" disabled={actionPending} onClick={() => openPanel("reset")}>Reset demo save</button>
          </> : <button className="demo-text-button" onClick={() => setSaveIssue(null)}>Continue session-only <Check size={16} aria-hidden="true" /></button>}
        </div>
      </div>}

      <div className="demo-location-caption">
        <p>{snapshot.inside ? "A home among the branches" : location.title}</p>
        <span>{snapshot.inside ? "The story is on the shelves. The door is always open." : location.subtitle}</span>
      </div>

      <nav id="demo-world-controls" className="demo-world-controls" aria-label="World controls" tabIndex={-1}>
        <button data-demo-menu className="demo-dock-button" onClick={() => { setSelectedGame(null); openPanel("journal") }} title="Game journal (J)"><BookOpen size={19} aria-hidden="true" /><span>Journal</span></button>
        <button className="demo-dock-button" onClick={() => openPanel("map")} title="Map and residents (M)"><MapIcon size={19} aria-hidden="true" /><span>Map</span></button>
        <button className="demo-dock-button" onClick={() => openPanel("build")} title="Build and move residents"><Home size={19} aria-hidden="true" /><span>Build</span></button>
        <span className="demo-dock-divider" aria-hidden="true" />
        <button className="demo-dock-button demo-tour-button" disabled={actionPending} onClick={storyStep === null ? startTour : () => openPanel("story")} title={storyStep === null ? "Take a guided tour" : "Continue guided tour"}><Sparkles size={18} aria-hidden="true" /><span>{storyStep === null ? tourFinished ? "Replay tour" : "Take a tour" : `Tour · ${storyStep + 1}/5`}</span></button>
      </nav>

      {!ambient && !panel && <div className="demo-context-controls">
        {snapshot.inside ? <button className="demo-context-button" onClick={exitHouse}><DoorOpen size={18} aria-hidden="true" /> Leave home {snapshot.nearby === "exit" && <kbd>E</kbd>}</button>
          : snapshot.location === "grove" ? <button className="demo-context-button" onClick={enterHouse}><DoorOpen size={18} aria-hidden="true" /> Enter grove home {snapshot.nearby === "door" && <kbd>E</kbd>}</button>
          : snapshot.nearby && <button className="demo-context-button" onClick={() => onInteract(snapshot.nearby ?? "plaza")}><MapPin size={17} aria-hidden="true" />{snapshot.nearby === "lodge" ? "Meet the visitors" : snapshot.nearby === "trailhead" ? "Find your next adventure" : snapshot.nearby === "plot" ? "Make this a home" : snapshot.nearby === "lookout" ? "Look around" : "Open your journal"}<kbd>E</kbd></button>}
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
        {toast && <div className="demo-panel-toast" role="status" aria-live="polite">
          <span>{toast.message}</span><button className="demo-icon-button" onClick={() => setToast(null)} aria-label="Dismiss message" title="Dismiss message"><X size={17} aria-hidden="true" /></button>
        </div>}
        {panel === "journal" && <Journal world={world} selected={selectedGame} onSelect={setSelectedGame} onAction={applyAction} onTravel={travel} blocked={blocked} />}
        {panel === "build" && <BuildPanel world={world} onAction={applyAction} onTravel={travel} blocked={blocked} />}
        {panel === "map" && <>
          <WorldMap world={world} snapshot={snapshot} />
          <p className="demo-map-legend"><Navigation size={15} aria-hidden="true" /> You are {snapshot.inside ? "inside the grove home" : `at ${location.title}`}.</p>
          {snapshot.inside && <button className="demo-button is-secondary" onClick={() => { exitHouse(); closePanel() }}><DoorOpen size={17} aria-hidden="true" /> Leave the grove home</button>}
          {!snapshot.inside && snapshot.location === "grove" && <button className="demo-button" onClick={enterHouse}><DoorOpen size={17} aria-hidden="true" /> Enter the furnished grove home</button>}
          <section className="demo-map-directory"><h3>Places to go</h3><ul>
            {visibleLocations(world.builtHouse).map(place => <li key={place.id}><button onClick={() => travel(place.id)}><span><strong>{place.title}</strong><span>{place.id === "grove" ? "Travel here, then enter the furnished home." : place.subtitle}</span></span><ArrowRight size={18} aria-hidden="true" /><span className="demo-sr-only">Travel to {place.title}</span></button></li>)}
          </ul></section>
          <section className="demo-map-directory"><h3>Neighbors, near and far</h3><p>Everyone wanders. Their home is always a good place to begin.</p><ul>
            {residents.map(resident => {
              const game = GAME_BY_ID[resident.gameId]
              const live = snapshot.residents.find(value => value.gameId === resident.gameId)
              return <li key={resident.gameId}><button onClick={() => travel(resident.home)}><GameMark game={game} /><span><strong>{game.character} <small>{resident.kind === "visitor" ? "Visiting" : "At home"}</small></strong><span>{game.title} · {LOCATION_BY_ID[resident.home].title}{live ? ` · ${live.activity}` : ""}</span></span><ArrowRight size={18} aria-hidden="true" /><span className="demo-sr-only">Visit {game.character}&apos;s home</span></button></li>
            })}
          </ul></section>
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
          <div className="demo-setting-group"><h3>Your local world</h3><p>{saveMode === "local" ? "Only this demo's game choices, homes, and notes are saved in this browser. Camera positions and settings aren't saved." : "This visit is session-only. Your changes won't be saved after you leave."}</p><button className="demo-text-button is-danger" onClick={() => openPanel("reset")}><RotateCcw size={17} aria-hidden="true" /> Reset demo world</button></div>
          <button className="demo-button" onClick={closePanel}>Back to the canopy <ArrowRight size={17} aria-hidden="true" /></button>
        </>}
        {panel === "help" && <>
          <section className="demo-help-section"><h3>A few ways to wander</h3><dl className="demo-key-list">
            <div><dt><kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd></dt><dd>Walk along platforms and bridges</dd></div>
            <div><dt>Drag the world</dt><dd>Turn the camera; scroll to zoom</dd></div>
            <div><dt><kbd>E</kbd></dt><dd>Interact with the nearest place or door</dd></div>
            <div><dt><kbd>M</kbd> / <kbd>J</kbd></dt><dd>Open the map or game journal</dd></div>
            <div><dt><kbd>H</kbd></dt><dd>Enter or leave ambient view</dd></div>
            <div><dt><kbd>Esc</kbd></dt><dd>Close a panel or leave ambient view</dd></div>
          </dl><p>On touchscreens, hold the arrow buttons to walk. Use the map for direct travel without steering. Keyboard shortcuts stay quiet while you use a panel, button, or text field.</p></section>
          <section className="demo-help-section"><h3>This is your little demo</h3><p>All six games and their characters are fictional. Starting a sample welcomes a visitor. Completing it makes that same character a resident. Replaying never removes their home or creates a second character.</p><p>There are no points for wandering, no ticking game timer, and no real account connection. Friends&apos; visits are not part of this demo. Ambient view works in this browser—it is not a system screensaver.</p></section>
          <div className="demo-action-row"><button className="demo-button" onClick={startTour}>Take the guided tour <ArrowRight size={17} aria-hidden="true" /></button><button className="demo-button is-secondary" onClick={() => openPanel("map")}>Open accessible map</button></div>
        </>}
        {panel === "story" && <section className="demo-story">
          <div className="demo-story-progress" aria-label={`Tour step ${storyIndex + 1} of 5`}><span>Step {storyIndex + 1} of 5</span><div>{STORY.map((_, index) => <span key={index} className={index <= storyIndex ? "is-current" : ""} />)}</div></div>
          <GameMark game={GAME_BY_ID.ember} large />
          <h3>{story.title}</h3><p>{story.text}</p>
          {storyIndex === 0 && activeOther && world.games.ember === "backlog" && <p className="demo-inline-notice">You already have an adventure underway. Finish {activeOther.title} in the journal, then return to the tour. Nothing will be replaced.</p>}
          {storyIndex <= 2 && world.completions.ember && <p className="demo-inline-notice">Sol already has a permanent home in this save. We&apos;ll show you around without creating another Sol.</p>}
          {storyIndex === 3 && !world.completions.ember && <p className="demo-inline-notice">Sol hasn&apos;t finished their story yet. You can still build the house, then use Build to move Pip or Wren in.</p>}
          <button className="demo-button" onClick={advanceStory} disabled={blocked}>{storyAction}<ArrowRight size={18} aria-hidden="true" /></button>
          <div className="demo-story-navigation">
            <button className="demo-text-button" disabled={storyIndex === 0} onClick={() => setStoryStep(Math.max(0, storyIndex - 1))}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
            <button className="demo-text-button" onClick={() => storyIndex < 4 ? setStoryStep(storyIndex + 1) : closePanel()}>{storyIndex < 4 ? "Skip this step" : "Keep exploring"}</button>
            <button className="demo-text-button" onClick={() => { setStoryStep(null); closePanel() }}>End tour</button>
          </div><p className="demo-small-copy">The world pauses while you read. After each action, have a look around and use “Tour” below to continue.</p>
        </section>}
        {panel === "reset" && <div className="demo-reset"><p>You&apos;ll return to two residents, four backlog games, and an unbuilt plot. This can&apos;t be undone.</p><div className="demo-action-row"><button data-demo-cancel className="demo-button is-secondary" disabled={actionPending} onClick={() => openPanel("settings")}>Keep my canopy</button><button className="demo-button is-destructive" disabled={actionPending} onClick={resetDemo}>Reset only this demo</button></div></div>}
        {blocked && panel !== "reset" && <p className="demo-inline-notice">Your stored save couldn&apos;t be read. Close this panel and choose “Continue session-only,” retry it, or reset only the demo save before making changes.</p>}
      </DemoModal>}
    </div>
  )
}
