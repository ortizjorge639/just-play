"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import * as Dialog from "@radix-ui/react-dialog"
import type { Game, Session, StandbyPreferences } from "@/lib/types"
import { useStandbyWakeLock } from "@/hooks/use-standby-display"

const control = "min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-40"

export function StandbySession({
  session, elapsed, elapsedSeconds, preferences, pending, syncError, error, onRetry, onTransition, onExit,
}: {
  session: Session & { games: Game }
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
      else setDisplayMessage("Fullscreen is unavailable here. Full-window StandBy still works.")
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
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[70] bg-black" />
      <Dialog.Content
        ref={setContainer}
        onEscapeKeyDown={(event) => { event.preventDefault(); exit() }}
        className="fixed inset-0 z-[71] flex h-dvh w-screen flex-col overflow-y-auto bg-[#090c10] text-white outline-none"
        style={{ padding: "max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))" }}
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Just Play / StandBy</p>
          <button className={control} onClick={exit}>Exit StandBy</button>
        </header>
        <main className="m-auto grid w-full max-w-6xl items-center gap-6 py-6 landscape:grid-cols-[2fr_3fr] landscape:py-3 sm:gap-12">
          <div className="relative mx-auto aspect-[16/9] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 shadow-2xl landscape:aspect-[3/4] landscape:max-h-[55dvh]">
            <Image src={session.games.header_image} alt="" fill sizes="(orientation: landscape) 40vw, 80vw" className="object-cover opacity-80" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="space-y-5 text-center landscape:text-left [@media(max-height:500px)]:space-y-2">
            <p className="text-sm text-white/60 [@media(max-height:500px)]:hidden">{session.status === "Paused" ? "Taking a breath" : "Your game is waiting for you"}</p>
            <Dialog.Title className="break-words text-3xl font-semibold leading-tight sm:text-5xl [@media(max-height:500px)]:text-2xl">{session.games.name}</Dialog.Title>
            <Dialog.Description className="text-white/60">
              Make memories. Not another scroll.
            </Dialog.Description>
            {preferences.show_clock && session.record_time !== false ? (
              <p className="font-mono text-5xl tabular-nums sm:text-7xl [@media(max-height:500px)]:text-4xl" aria-label={`${session.status} elapsed time`}>{elapsed}</p>
            ) : null}
            <p className="text-sm text-white/60">{session.status} · {session.record_time === false ? "Time recording off" : preferences.show_clock ? "Time recording on" : "Clock hidden; time recording on"}</p>
            {session.session_goal ? <p className="break-words border-l-2 border-white/20 pl-4 text-base text-white/80">{session.session_goal}</p> : null}
            {preferences.reminders && !reminderDismissed && session.status === "Playing" && session.record_time !== false && elapsedSeconds >= 3600 ? (
              <div role="status" className="text-sm text-amber-200">
                A good moment to stretch or rest your eyes. Your session will keep running.
                <button className={`${control} ml-2`} onClick={() => setReminderDismissed(true)}>Dismiss</button>
              </div>
            ) : null}
            {syncError || error ? <p role="alert" className="text-sm text-amber-200">{syncError || error}</p> : null}
            {syncError ? <button className={control} onClick={onRetry}>Reconnect / retry</button> : null}
            <div className="flex flex-wrap justify-center gap-3 landscape:justify-start">
              <button className={control} disabled={pending || !!syncError} onClick={() => onTransition(session.status === "Paused" ? "Playing" : "Paused")}>{pending ? "Saving..." : session.status === "Paused" ? "Resume" : "Pause"}</button>
              <button className={control} disabled={pending || !!syncError} onClick={() => setConfirmEnd(true)}>End session</button>
              <button className={control} onClick={() => void toggleFullscreen()}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
            </div>
            {confirmEnd ? <div className="space-y-2 rounded-xl border border-white/20 p-4">
              <p>Done for today? Your game stays available to continue later.</p>
              <button className={control} disabled={pending || !!syncError} onClick={() => onTransition("Finished")}>Finish session</button>{" "}
              <button className={control} onClick={() => setConfirmEnd(false)}>Keep playing</button>
            </div> : null}
          </div>
        </main>
        <footer className="space-y-1 text-center text-xs text-white/50" role="status">
          <p>{wakeState}</p>
          <p>{displayMessage || "Screen may sleep when locked or backgrounded. Escape exits StandBy; fullscreen may need a second press."}</p>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
