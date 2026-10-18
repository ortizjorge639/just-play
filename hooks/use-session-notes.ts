"use client"

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react"
import { updateSessionNotes } from "@/app/actions"

export class SessionNotesSaveError extends Error {}

type SaveState = "saved" | "acknowledged" | "unsaved" | "saving" | "error"
interface Snapshot { draft: string; saveState: SaveState; error: string | null }

// Owned by AppShell, not the tab: drafts, ACKs and the pending queue have the
// same lifetime. This is in-memory only, never authorization for a legacy finish.
function createNotesQueue(
  sessionId: string | null,
  initialNotes: string,
  beginMutation: () => number,
  endMutation: () => void,
) {
  let snapshot: Snapshot = { draft: initialNotes, saveState: "saved", error: null }
  let saved: string | null = initialNotes
  let uncertain = false
  let lastObservedRead = 0
  let minimumReadRevision = 0
  let pending: Promise<void> | null = null
  let timeout: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()
  const publish = (update: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...update }
    for (const listener of listeners) listener()
  }
  const flush = () => {
    if (timeout) { clearTimeout(timeout); timeout = null }
    if (pending) return pending
    if (!sessionId) return Promise.resolve()
    const write = (async () => {
      try {
        while (saved !== snapshot.draft) {
          const draft = snapshot.draft
          publish({ saveState: "saving" })
          // Reject reads started before this write, including a result already
          // accepted by reconciliation but not yet observed by this queue.
          minimumReadRevision = beginMutation()
          try { await updateSessionNotes(sessionId, draft) }
          finally { endMutation() }
          saved = draft
        }
        publish({ saveState: uncertain ? "acknowledged" : "saved", error: null })
      } catch (cause) {
        saved = null
        uncertain = true
        const error = new SessionNotesSaveError(`Could not save session notes. Your draft is still here; retry before finishing. ${cause instanceof Error ? cause.message : ""}`)
        publish({ saveState: "error", error: error.message })
        throw error
      }
    })()
    pending = write
    void write.then(() => { pending = null }, () => { pending = null })
    return write
  }
  return {
    sessionId,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => snapshot,
    getDraft: () => snapshot.draft,
    adoptServerNotes(notes: string, readRevision: number) {
      if (readRevision <= lastObservedRead || readRevision < minimumReadRevision) return
      lastObservedRead = readRevision
      if (pending || timeout || uncertain || snapshot.error || saved !== snapshot.draft) return
      saved = notes
      if (snapshot.draft !== notes) publish({ draft: notes, saveState: "saved", error: null })
    },
    flush,
    change(draft: string) {
      publish({ draft, saveState: "unsaved", error: null })
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        // flush publishes the error to every mounted observer before rejecting.
        void flush().catch(() => {})
      }, 1000)
    },
  }
}

export function useSessionNotes(
  sessionId: string | null,
  serverNotes: string,
  serverReadRevision: number,
  beginMutation: () => number,
  endMutation: () => void,
) {
  const [queue, setQueue] = useState(() => createNotesQueue(sessionId, serverNotes, beginMutation, endMutation))
  if (queue.sessionId !== sessionId) setQueue(createNotesQueue(sessionId, serverNotes, beginMutation, endMutation))
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  useLayoutEffect(() => {
    queue.adoptServerNotes(serverNotes, serverReadRevision)
  }, [queue, serverNotes, serverReadRevision])
  useEffect(() => () => {
    // Closing/reloading is best effort. Local finalizers explicitly await flush.
    void queue.flush().catch(cause => console.error("Session note save did not complete before leaving", cause))
  }, [queue])
  return { ...snapshot, flush: queue.flush, change: queue.change, getDraft: queue.getDraft }
}

export type SessionNotesController = ReturnType<typeof useSessionNotes>
