"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Check, MapPin } from "lucide-react"
import type { DemoAction, DemoGame, DemoState, GameId, LocationId } from "@/lib/demo/contracts"
import { GAMES, GAME_BY_ID } from "@/lib/demo/state"

export type ApplyDemoAction = (action: DemoAction, message: string) => boolean

export function GameMark({ game, large = false }: { game: DemoGame; large?: boolean }) {
  return <span className={`demo-game-mark${large ? " is-large" : ""}`} style={{ color: game.color }} aria-hidden="true">{game.symbol}</span>
}

function GameNote({ world, game, onAction, blocked }: { world: DemoState; game: DemoGame; onAction: ApplyDemoAction; blocked: boolean }) {
  const [draft, setDraft] = useState(world.notes[game.id] ?? "")
  const saved = world.notes[game.id] ?? ""
  return (
    <form className="demo-note" onSubmit={event => {
      event.preventDefault()
      onAction({ type: "note", gameId: game.id, text: draft }, draft ? "Your note is saved in this browser." : "Your note has been removed.")
    }}>
      <label htmlFor={`note-${game.id}`}>Your own note</label>
      <p>Not the sample story. A little space for your words.</p>
      <textarea id={`note-${game.id}`} rows={4} maxLength={500} value={draft} onChange={event => setDraft(event.target.value)} placeholder="What would you like to remember?" disabled={blocked} />
      <div className="demo-form-footer">
        <span>{draft.length} / 500</span>
        <button className="demo-button is-secondary" disabled={blocked || draft === saved} type="submit">{draft === saved ? <><Check size={16} aria-hidden="true" /> Saved</> : "Save note"}</button>
      </div>
    </form>
  )
}

export function Journal({ world, selected, onSelect, onAction, onTravel, blocked }: {
  world: DemoState
  selected: GameId | null
  onSelect: (game: GameId | null) => void
  onAction: ApplyDemoAction
  onTravel: (location: LocationId) => void
  blocked: boolean
}) {
  const active = GAMES.find(game => world.games[game.id] === "playing")
  const detailBack = useRef<HTMLButtonElement>(null)
  useEffect(() => { detailBack.current?.focus({ preventScroll: true }) }, [selected])

  if (selected) {
    const game = GAME_BY_ID[selected]
    const status = world.games[selected]
    const permanent = Boolean(world.completions[selected])
    const home = world.homes[selected] ?? "grove"
    return (
      <div>
        <button ref={detailBack} className="demo-text-button" onClick={() => onSelect(null)}><ArrowLeft size={17} aria-hidden="true" /> All sample games</button>
        <div className="demo-game-detail-heading">
          <GameMark game={game} large />
          <div>
            <h3>{game.title}</h3>
            <p>{game.character} · {permanent ? (status === "playing" ? "At home, while you replay" : "Permanent resident") : status === "playing" ? "A visitor at the lodge" : "An adventure still to come"}</p>
          </div>
        </div>
        <p className="demo-body-copy">{game.description}</p>
        <div className="demo-action-row">
          {status === "playing" ? (
            <button className="demo-button" disabled={blocked} onClick={() => onAction(
              { type: "complete", gameId: game.id, at: new Date().toISOString() },
              permanent ? `${game.character}'s replay is complete. Their home and first memory stay.` : `${game.character} is home for good. You'll find the same familiar face in the grove.`,
            )}><Check size={17} aria-hidden="true" /> {permanent ? "Finish sample replay" : "Complete sample game"}</button>
          ) : (
            <button className="demo-button" disabled={blocked || Boolean(active)} onClick={() => onAction(
              { type: "start", gameId: game.id, at: new Date().toISOString() },
              permanent ? `${game.title} is ready to replay. ${game.character} keeps their home.` : `${game.character} has arrived at the travelers' lodge.`,
            )}>{permanent ? "Replay sample game" : "Start sample game"}<ArrowRight size={17} aria-hidden="true" /></button>
          )}
          {(permanent || status === "playing") && <button className="demo-button is-secondary" onClick={() => onTravel(permanent ? home : "lodge")}><MapPin size={17} aria-hidden="true" /> Visit {game.character}&apos;s {permanent ? "home" : "lodge"}</button>}
        </div>
        {active && active.id !== game.id && <p className="demo-inline-notice">One adventure at a time. Finish <button className="demo-inline-link" onClick={() => onSelect(active.id)}>{active.title}</button> before {permanent ? "replaying" : "starting"} this one.</p>}
        <p className="demo-small-copy">This is a fictional sample. These buttons demonstrate a game&apos;s journey; they don&apos;t launch or track a real game.</p>
        {permanent && <section className="demo-memory" aria-label="Fictional sample memory">
          <h4><BookOpen size={17} aria-hidden="true" /> Sample memory</h4>
          <blockquote>“{game.memory}”</blockquote>
          <p>Written for the demo, not taken from your play history.</p>
        </section>}
        <GameNote key={game.id} game={game} world={world} onAction={onAction} blocked={blocked} />
      </div>
    )
  }

  return (
    <div>
      <p className="demo-journal-intro">A game begins as a possibility, brings someone to visit, and leaves a familiar face behind.</p>
      {([
        { status: "backlog", title: "Backlog", empty: "Every sample adventure has found its beginning.", detail: "No rush. See what calls to you." },
        { status: "playing", title: "Visiting", empty: active ? `${active.character} is already a resident. Their replay is in At home.` : "The lodge is ready whenever you are.", detail: "Your current adventure" },
        { status: "completed", title: "At home", empty: "Finish a sample game to welcome its character home.", detail: "Stories finished. People who stayed." },
      ] as const).map(group => {
        const games = GAMES.filter(game => group.status === "completed"
          ? Boolean(world.completions[game.id])
          : world.games[game.id] === group.status && !world.completions[game.id])
        return <section className="demo-journal-group" key={group.status}>
          <div className="demo-section-heading"><h3>{group.title} <span>{games.length}</span></h3><p>{group.detail}</p></div>
          {games.length ? <ul className="demo-game-list">{games.map(game => (
            <li key={game.id}>
              <button className="demo-game-row" onClick={() => onSelect(game.id)}>
                <GameMark game={game} />
                <span><strong>{game.title}</strong><span>{world.completions[game.id] ? `${game.character} · ${world.games[game.id] === "playing" ? "Replaying; still a resident" : world.homes[game.id] === "plot" ? "Fern House" : "Resident grove"}` : group.status === "playing" ? `${game.character} · Travelers' lodge` : game.description}</span></span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}</ul> : <p className="demo-empty-line">{group.empty}</p>}
        </section>
      })}
    </div>
  )
}
