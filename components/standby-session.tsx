"use client"

import { useCallback, useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import type { Game, Session, StandbyPreferences } from "@/lib/types"
import { useStandbyWakeLock } from "@/hooks/use-standby-display"
import { CanopyNook } from "./canopy/nook"
import { StandbyArtwork } from "./standby-artwork"
import "./canopy/nook.css"

const control = "min-h-11 rounded-lg border border-white/20 px-4 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-40"

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
  const goal = session.session_goal ? <p className="break-words border-l-2 border-white/20 pl-4 text-base text-white/80">{session.session_goal}</p> : null
  const recordingLabel = session.record_time === false ? "Time recording off" : preferences.show_clock ? "Time recording on" : "Clock hidden; time recording on"
  const nookWakeMessage = preferences.keep_awake && !wakeState.startsWith("Keep-awake active") ? wakeState : null
  const titleBlock = (
    <>
      <Dialog.Title title={ambient ? session.games.name : undefined} className={ambient ? "canopy-game" : "break-words font-serif text-4xl font-medium leading-tight sm:text-6xl [@media(max-height:500px)]:text-3xl"}>{session.games.name}</Dialog.Title>
      <Dialog.Description className={ambient ? "sr-only" : "text-white/70"}>
        {nook ? "Your real play session, in a quiet Canopy nook. The room does not award residents or progress." : "Leave this screen beside your game."}
      </Dialog.Description>
      {preferences.show_clock && session.record_time !== false ? (
        <p className={ambient ? "canopy-clock" : "font-mono text-5xl tabular-nums sm:text-7xl [@media(max-height:500px)]:text-4xl"} aria-label={syncError ? "Unverified elapsed time" : `${session.status} elapsed time`}>{elapsed}{syncError ? <span className="mt-2 block font-sans text-sm text-amber-200">not verified</span> : null}</p>
      ) : null}
    </>
  )
  const controlsBlock = (
    <>
      <p className="text-sm text-white/70">{session.status}{!ambient || session.record_time === false || !preferences.show_clock ? ` · ${recordingLabel}` : ""}</p>
      {ambient && !confirmEnd ? <button className={`${control} canopy-details-toggle`} aria-expanded={details} aria-controls="canopy-session-details" onClick={event => {
        if (details) event.currentTarget.focus({ preventScroll: true })
        setDetails(value => !value)
      }}>{details ? "Hide session details" : "Session details"}</button> : null}
      {!ambient ? goal : null}
      {preferences.reminders && !reminderDismissed && session.status === "Playing" && session.record_time !== false && elapsedSeconds >= 3600 ? (
        <div role="status" className="text-sm text-amber-200">
          A good moment to stretch or rest your eyes. Your session will keep running.
          <button className={`${control} ml-2`} onClick={() => setReminderDismissed(true)}>Dismiss</button>
        </div>
      ) : null}
      {syncError || error ? <p role="alert" className="text-sm text-amber-200">{syncError || error}</p> : null}
      {syncError ? <button className={control} onClick={onRetry}>Reconnect / retry</button> : null}
      {!ambient || !confirmEnd ? <div className="flex flex-wrap justify-center gap-3">
        <button className={control} disabled={pending || !!syncError} onClick={() => onTransition(session.status === "Paused" ? "Playing" : "Paused")}>{pending ? "Saving..." : session.status === "Paused" ? "Resume" : "Pause"}</button>
        <button className={control} disabled={pending || !!syncError} onClick={() => setConfirmEnd(true)}>End session</button>
        <button className={control} onClick={() => void toggleFullscreen()}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
      </div> : null}
      {displayMessage ? <p role="status" className="text-sm text-white/70">{displayMessage}</p> : null}
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
        onEscapeKeyDown={(event) => { event.preventDefault(); exit() }}
        className={`fixed inset-0 z-[71] flex h-dvh w-screen flex-col overflow-y-auto bg-[#090c10] text-white outline-none${ambient ? " canopy-standby" : ""}`}
        style={{ padding: "max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))" }}
      >
        {!nook ? <StandbyArtwork artwork={session.games.header_image} /> : null}
        <header className={`z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/15 py-2 ${nook ? "relative" : "sticky top-0"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <p className="text-base font-semibold tracking-tight text-white">Just Play</p>
            <span aria-hidden="true" className="h-4 w-px bg-white/25" />
            <p className="text-sm text-white/70">StandBy</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={control} onClick={exit}>Exit StandBy</button>
          </div>
        </header>
        <main className={ambient ? "canopy-main" : "relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 py-6 text-center [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-center [@media(max-height:500px)]:gap-4 [@media(max-height:500px)]:py-2"}>
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
            <div className="my-auto space-y-3 py-2 [@media(max-height:500px)]:my-0 [@media(max-height:500px)]:flex-1 [@media(max-height:500px)]:space-y-1">{titleBlock}</div>
            <div data-testid="standby-controls" className="mx-auto w-full max-w-xl space-y-3 [@media(max-height:500px)]:flex-1 rounded-2xl border border-white/15 bg-black/60 p-4 backdrop-blur-sm [@media(max-height:500px)]:space-y-2 [@media(max-height:500px)]:p-3">{controlsBlock}</div>
          </>}
        </main>
        {ambient ? nookWakeMessage ? <footer role="status">
          <p>{nookWakeMessage}</p>
        </footer> : null : <footer className="relative z-10 space-y-1 text-center text-xs text-white/70" role="status">
          <p>{wakeState}</p>
          <p>{"Screen may sleep when locked or backgrounded. Escape exits StandBy; fullscreen may need a second press."}</p>
        </footer>}
      </Dialog.Content>
    </Dialog.Portal>
  )
}
