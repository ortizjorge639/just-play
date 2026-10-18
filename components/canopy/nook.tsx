"use client"

import { memo, useEffect, useRef, useState } from "react"
import Image from "next/image"

export const CanopyNook = memo(function CanopyNook({ artwork }: { artwork: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    const element = host.current
    if (!element) return
    const abort = new AbortController()
    let dispose: (() => void) | undefined
    const fail = (cause: unknown) => {
      if (abort.signal.aborted) return
      console.error("Canopy nook unavailable", cause)
      setState("failed")
    }
    void import("./renderer")
      .then(({ mountNook }) => mountNook(element, abort.signal, fail))
      .then(cleanup => {
        if (abort.signal.aborted) cleanup()
        else { dispose = cleanup; setState("ready") }
      })
      .catch(fail)
    return () => { abort.abort(); dispose?.() }
  }, [attempt])

  return (
    <div className="canopy-viewport">
      {state !== "ready" ? <>
        <Image src={artwork} alt="" fill sizes="100vw" className="object-cover opacity-40" />
        <div className="canopy-load" role={state === "failed" ? "alert" : "status"}>
          <p>{state === "failed" ? "Canopy couldn't open. Your game artwork is still here." : "Opening a little room in the trees..."}</p>
          {state === "failed" ? <button onClick={() => { setState("loading"); setAttempt(value => value + 1) }}>Retry nook</button> : null}
        </div>
      </> : null}
      <div ref={host} className="canopy-canvas" hidden={state === "failed"} role="img" aria-label="A warm timber treehouse nook with a moss-green sofa, books, tea, plants, and the neutral R1 starter companion. Not an earned resident." />
      <div className="canopy-room-label" aria-hidden="true"><span>CANOPY</span><p>A little room in the trees.</p></div>
    </div>
  )
})
