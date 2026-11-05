"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Check, LogOut, Maximize, Minimize, Palette, Pause, Play, Square } from "lucide-react"
import type { Game, Session, StandbyPreferences } from "@/lib/types"
import { useStandbyWakeLock } from "@/hooks/use-standby-display"
import { CanopyNook } from "./canopy/nook"
import { DEFAULT_STANDBY_APPEARANCE, StandbyArtwork, type StandbyAppearance } from "./standby-artwork"
import "./canopy/nook.css"

const control = "min-h-11 rounded-lg border border-border/70 px-4 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-40"
const appearanceKey = "just-play-standby-appearance"

function readAppearance(): StandbyAppearance {
  if (typeof window === "undefined") return DEFAULT_STANDBY_APPEARANCE
  try {
    const stored = window.localStorage.getItem(appearanceKey)
    if (!stored) return DEFAULT_STANDBY_APPEARANCE
    const value: unknown = JSON.parse(stored)
    if (value && typeof value === "object" &&
        "effect" in value && (value.effect === "dither" || value.effect === "ascii" || value.effect === "artwork") &&
        "color" in value && (value.color === "original" || value.color === "amber" || value.color === "mint" || value.color === "mono") &&
        "motion" in value && typeof value.motion === "boolean") {
      return { effect: value.effect, color: value.color, motion: value.motion }
    }
    console.warn("[standby-appearance] Invalid saved appearance; using defaults.")
  } catch (error) {
    console.warn("[standby-appearance] Could not read saved appearance.", error)
  }
  return DEFAULT_STANDBY_APPEARANCE
}

export function StandbySession({
  session, notesStatus, elapsed, elapsedSeconds, preferences, pending, syncError, error, onRetry, onTransition, onExit,
}: {
  session: Session & { games: Game }
  notesStatus: string | null
  elapsed: string
  elapsedSeconds: number
  preferences: StandbyPreferences
  pending: boolean
  syncError: string | null
  error: string | null
  onRetry: () => void
  onTransition: (status: "Playing" | "Paused" | "Finished") => void
  onExit: () => void
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [displayMessage, setDisplayMessage] = useState<string | null>(null)
  const [appearance, setAppearance] = useState(readAppearance)
  const [showAppearance, setShowAppearance] = useState(false)
  const appearanceButton = useRef<HTMLButtonElement>(null)
  const closeAppearance = () => {
    setShowAppearance(false)
    appearanceButton.current?.focus()
  }
  const changeAppearance = (next: StandbyAppearance) => {
    setAppearance(next)
    try {
      window.localStorage.setItem(appearanceKey, JSON.stringify(next))
    } catch (error) {
      console.warn("[standby-appearance] Could not save appearance.", error)
      setDisplayMessage("Appearance changed for this visit, but could not be saved on this device.")
    }
  }
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [reminderDismissed, setReminderDismissed] = useState(false)
  const [view] = useState<"artwork" | "canopy">("artwork")
  const nook = view === "canopy"
  const ambient = nook
  const [details, setDetails] = useState(false)
  const focusDetails = useCallback((element: HTMLDivElement | null) => { element?.focus({ preventScroll: true }) }, [])
  const wakeState = useStandbyWakeLock(preferences.keep_awake)
  useEffect(() => {
    if (!container) return
    const element = container
    const change = () => setFullscreen(document.fullscreenElement === element)
    document.addEventListener("fullscreenchange", change)
    return () => {
      document.removeEventListener("fullscreenchange", change)
      if (document.fullscreenElement === element && document.fullscreenElement) {
        void document.exitFullscreen().catch((cause) => console.error("Could not exit StandBy fullscreen", cause))
      }
    }
  }, [container])
  const toggleFullscreen = async () => {
    setDisplayMessage(null)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (container?.requestFullscreen && document.fullscreenEnabled) {
        await container.requestFullscreen()
        if (!container.isConnected && document.fullscreenElement === container) await document.exitFullscreen()
      }
      else setDisplayMessage("Fullscreen is unavailable here. Full-window StandBy still works. On iPhone/iPad Safari, Add to Home Screen for a full-screen view.")
    } catch {
      setDisplayMessage("Fullscreen was not allowed. Full-window StandBy still works.")
    }
  }
  const exit = () => {
    if (document.fullscreenElement === container) {
      void document.exitFullscreen().catch((cause) => console.error("Could not exit fullscreen", cause))
    }
    onExit()
  }
  const goal = session.session_goal ? <p className="break-words text-base text-foreground/80">{session.session_goal}</p> : null
  const recordingLabel = session.record_time === false ? "Time recording off" : preferences.show_clock ? null : "Clock hidden; time recording on"
  const nookWakeMessage = preferences.keep_awake && !wakeState.startsWith("Keep-awake active") ? wakeState : null
  const titleBlock = (
    <>
      {ambient ? <Dialog.Title title={session.games.name} className="canopy-game">{session.games.name}</Dialog.Title> : null}
      <Dialog.Description className="sr-only">
        {nook ? "Your real play session, in a quiet Canopy nook. The room does not award residents or progress." : "Leave this screen beside your game."}
      </Dialog.Description>
      {preferences.show_clock && session.record_time !== false ? (
        <p className={ambient ? "canopy-clock" : "font-mono text-5xl tabular-nums sm:text-6xl [@media(max-height:500px)]:text-4xl"} aria-label={syncError ? "Unverified elapsed time" : `${session.status} elapsed time`}>{elapsed}{syncError ? <span className="mt-2 block font-sans text-sm text-primary">not verified</span> : null}</p>
      ) : null}
    </>
  )
  const controlsBlock = (
    <>
      {recordingLabel ? <p className="text-sm text-white/70">{recordingLabel}</p> : null}
      {ambient && !confirmEnd ? <button className={`${control} canopy-details-toggle`} aria-expanded={details} aria-controls="canopy-session-details" onClick={event => {
        if (details) event.currentTarget.focus({ preventScroll: true })
        setDetails(value => !value)
      }}>{details ? "Hide session details" : "Session details"}</button> : null}
      {preferences.reminders && !reminderDismissed && session.status === "Playing" && session.record_time !== false && elapsedSeconds >= 3600 ? (
        <div role="status" className="text-sm text-primary">
          A good moment to stretch or rest your eyes. Your session will keep running.
          <button className={`${control} ml-2`} onClick={() => setReminderDismissed(true)}>Dismiss</button>
        </div>
      ) : null}
      {syncError || error ? <p role="alert" className="text-sm text-primary">{syncError || error}</p> : null}
      {syncError ? <button className={control} onClick={onRetry}>Reconnect / retry</button> : null}
      {!ambient || !confirmEnd ? <div className="standby-action-row flex flex-wrap justify-center gap-3">
        <button className={`${control} standby-icon-control`} aria-label={pending ? "Saving..." : session.status === "Paused" ? "Resume" : "Pause"} disabled={pending || !!syncError} onClick={() => onTransition(session.status === "Paused" ? "Playing" : "Paused")}>
          {session.status === "Paused" ? <Play aria-hidden="true" size={20} /> : <Pause aria-hidden="true" size={20} />}
          <span>{pending ? "Saving..." : session.status === "Paused" ? "Resume" : "Pause"}</span>
        </button>
        <button className={`${control} standby-icon-control`} aria-label="End session" disabled={pending || !!syncError} onClick={() => setConfirmEnd(true)}>
          <Square aria-hidden="true" size={20} /><span>End session</span>
        </button>
        <button className={`${control} standby-icon-control`} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Minimize aria-hidden="true" size={20} /> : <Maximize aria-hidden="true" size={20} />}
          <span>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
        </button>
      </div> : null}
      {displayMessage ? <p role="status" className="text-sm text-foreground/70">{displayMessage}</p> : null}
      {confirmEnd ? <div className="canopy-confirm space-y-2 rounded-xl border border-white/20 p-4">
        <p>Done for today? Your game stays available to continue later.</p>
        <button className={control} disabled={pending || !!syncError} onClick={() => onTransition("Finished")}>Finish session</button>{" "}
        <button className={control} onClick={() => setConfirmEnd(false)}>Keep playing</button>
      </div> : null}
    </>
  )
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[70] bg-black" />
      <Dialog.Content
        ref={setContainer}
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          if (showAppearance) closeAppearance()
          else exit()
        }}
        onPointerMove={(event) => {
          if (!appearance.motion || event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - bounds.left
          const y = event.clientY - bounds.top
          const hue = 105 - Math.min(1, Math.max(0, x / bounds.width)) * 63
          event.currentTarget.style.setProperty("--pointer-x", `${x}px`)
          event.currentTarget.style.setProperty("--pointer-y", `${y}px`)
          event.currentTarget.style.setProperty("--pointer-hue", `${hue}`)
        }}
        className={`fixed inset-0 z-[71] flex h-dvh w-screen flex-col overflow-y-auto bg-background text-foreground outline-none${ambient ? " canopy-standby" : " standby-screen"}`}
        style={{ padding: "max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))" }}
      >
        {!nook ? <StandbyArtwork artwork={session.games.header_image} appearance={appearance} /> : null}
        <header className={`standby-header z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border/50 py-2 ${nook ? "relative" : "sticky top-0"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <p className="text-base font-semibold tracking-tight text-foreground">Just Play</p>
            <span aria-hidden="true" className="standby-header-divider h-4 w-px bg-border" />
            <p className="standby-header-label text-sm text-muted-foreground">StandBy</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!nook ? <button ref={appearanceButton} className={`${control} standby-icon-control`} aria-label="Appearance" aria-expanded={showAppearance} aria-controls="standby-appearance" onClick={() => setShowAppearance(value => !value)}><Palette aria-hidden="true" size={20} /><span>Appearance</span></button> : null}
            <button className={`${control} standby-icon-control`} aria-label="Exit StandBy" onClick={exit}><LogOut aria-hidden="true" size={20} /><span>Exit StandBy</span></button>
          </div>
        </header>
        {showAppearance && !nook ? <section id="standby-appearance" aria-label="StandBy appearance" className="standby-appearance z-30 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-4">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <label htmlFor="standby-style">Style</label>
            <select id="standby-style" className={`${control} bg-background`} value={appearance.effect} onChange={event => {
              const effect = event.target.value
              if (effect === "dither" || effect === "ascii" || effect === "artwork") changeAppearance({ ...appearance, effect })
            }}>
              <option value="dither">Dither</option>
              <option value="ascii">ASCII</option>
              <option value="artwork">Artwork</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <label htmlFor="standby-color">Color</label>
            <select id="standby-color" className={`${control} bg-background`} value={appearance.color} onChange={event => {
              const color = event.target.value
              if (color === "original" || color === "amber" || color === "mint" || color === "mono") changeAppearance({ ...appearance, color })
            }}>
              <option value="original">Game colors</option>
              <option value="amber">Amber</option>
              <option value="mint">Mint</option>
              <option value="mono">Monochrome</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={appearance.motion} onChange={event => changeAppearance({ ...appearance, motion: event.target.checked })} />
            Background motion
          </label>
          <button className={`${control} standby-icon-control`} aria-label="Done" onClick={closeAppearance}><Check aria-hidden="true" size={20} /><span>Done</span></button>
        </section> : null}
        <main className={ambient ? "canopy-main" : "standby-main relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 py-8 text-center"}>
          {nook ? <div className="canopy-scene">
            <div inert={details && !confirmEnd}>
              <CanopyNook artwork={session.games.header_image} />
            </div>
            {details && !confirmEnd ? <div ref={focusDetails} id="canopy-session-details" className="canopy-details" tabIndex={0} role="region" aria-label="Session context">
              <p className="canopy-context-game">{session.games.name}</p>
              {goal || <p>No session goal set.</p>}
              <p className="canopy-notes"><span>Session notes</span>{session.notes || "No notes yet. You can write in your notepad after leaving StandBy."}</p>
              {notesStatus ? <p role="status">{notesStatus}</p> : null}
              <p className="canopy-boundary">R1 is your neutral starter companion, not an earned game resident. This room is a visual preview; no arrivals, rewards, or memories are created here.</p>
              <p>{recordingLabel}. {wakeState}. Screen may sleep when locked or backgrounded. Escape exits StandBy; fullscreen may need a second press.</p>
            </div> : null}
          </div> : null}
          {nook ? <div className="canopy-session-panel">{titleBlock}{controlsBlock}</div> : <>
            <section className="standby-session-summary relative z-10 my-auto flex w-full flex-col items-center gap-4">
              <Dialog.Title className="max-w-full break-words text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                {session.games.name}
              </Dialog.Title>
              <p className="text-sm text-white/75">{session.status}</p>
              {titleBlock}
              {goal}
            </section>
            <div data-testid="standby-controls" className="relative z-10 mx-auto w-full max-w-xl space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
              {controlsBlock}
            </div>
          </>}
        </main>
        {ambient ? nookWakeMessage ? <footer role="status">
          <p>{nookWakeMessage}</p>
        </footer> : null : <footer className="relative z-10 space-y-1 text-center text-xs text-muted-foreground" role="status">
          <p>{wakeState}</p>
        </footer>}
      </Dialog.Content>
    </Dialog.Portal>
  )
}
