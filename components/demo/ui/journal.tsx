"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Check, MapPin } from "lucide-react"
import type { DemoAction, DemoGame, DemoState, GameId, LocationId } from "@/lib/demo/contracts"
import { CONTRIBUTIONS, earnedStructure, GAMES, GAME_BY_ID, hasConfirmed, rulesFor } from "@/lib/demo/state"
import { locationTitle } from "@/lib/demo/world"
import { RulesEditor } from "./rules-editor"

export type ApplyDemoAction = (action: DemoAction, message: string) => Promise<boolean>

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

export function Journal({ world, selected, onSelect, onAction, onTravel, onBuild, blocked }: {
  world: DemoState
  selected: GameId | null
  onSelect: (game: GameId | null) => void
  onAction: ApplyDemoAction
  onTravel: (location: LocationId) => void
  onBuild: () => void
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
    const rules = rulesFor(world, selected)
    const merit = world.merits[selected]
    const placement = world.placements[selected]
    return (
      <div>
        <button ref={detailBack} className="demo-text-button" onClick={() => onSelect(null)}><ArrowLeft size={17} aria-hidden="true" /> All sample games</button>
        <div className="demo-game-detail-heading">
          <GameMark game={game} large />
          <div>
            <h3>{game.title}</h3>
            <p>{game.character} · {permanent ? (status === "playing" ? "Arrived · replaying, still permanent" : "Arrived · permanent neighbor") : status === "playing" ? "Invited · traveling outside the settlement" : "Backlogged · a possibility beyond the tree"}</p>
          </div>
        </div>
        <p className="demo-body-copy">{game.description}</p>
        <div className="demo-action-row">
          {status === "playing" ? (
            <button className="demo-button is-secondary" disabled={blocked} onClick={() => onAction(
              { type: "stop", gameId: game.id, at: new Date().toISOString() },
              permanent ? `${game.character}'s replay has ended. Their arrival and contribution stay.` : `${game.character}'s invitation has ended. One postcard stays by the trailhead until you remove it or welcome them home.`,
            )}>{permanent ? "End replay" : "End invitation · keep a postcard"}</button>
          ) : (
            <button className="demo-button" disabled={blocked || Boolean(active)} onClick={() => onAction(
              { type: "start", gameId: game.id, at: new Date().toISOString() },
              permanent ? `${game.title} is ready to replay. ${game.character} keeps their home.` : `${game.character} is traveling beyond the settlement. Your stamp decides when they arrive.`,
            )}>{permanent ? "Replay sample game" : "Invite sample game"}<ArrowRight size={17} aria-hidden="true" /></button>
          )}
          {permanent && <button className="demo-button is-secondary" onClick={() => onTravel(home)}><MapPin size={17} aria-hidden="true" /> Visit {game.character}&apos;s home</button>}
        </div>
        {active && active.id !== game.id && <p className="demo-inline-notice">One active adventure at a time. End <button className="demo-inline-link" onClick={() => onSelect(active.id)}>{active.title}</button>&apos;s invitation or replay before inviting another.</p>}
        <section className="demo-proof">
          <h4>{permanent ? "Permanent arrival earned" : "Your stamp of proof"}</h4>
          <p>{rules.stamp}</p>
          <p className="demo-small-copy">{world.rules.games[selected] ? "Game-specific rules." : "Using your default rules."} Self-confirmation only: no launcher, trophy, or playtime telemetry. Viewing this world earns nothing.</p>
          {!permanent && <button className="demo-button" disabled={blocked || status !== "playing"} onClick={() => onAction(
            { type: "confirm", gameId: selected, target: "stamp", at: new Date().toISOString() },
            `Self-confirmed: ${rules.stamp}. ${game.character} is permanently home, with their own contribution.`,
          )}>Self-confirm arrival stamp</button>}
          {permanent && <p className="demo-small-copy">Arrived {new Date(world.completions[selected]!).toLocaleDateString()}. This stays earned even if you change the stamp or stop a replay.</p>}
        </section>
        <RulesEditor world={world} gameId={selected} onAction={onAction} blocked={blocked} />
        <section className="demo-merits"><h3>More of the same story</h3><p className="demo-small-copy">Tiers enrich {game.character}&apos;s contribution, never their right to stay. Confirm only the sample milestones you choose to demonstrate.</p>
          <ul>{rules.tiers.map((tier, index) => {
            const confirmed = hasConfirmed(world, selected, tier.id)
            return <li key={tier.id}>
              <div><strong>{tier.name}</strong><p>{tier.milestone}</p><span className="demo-small-copy">{tier.structural ? `${CONTRIBUTIONS[selected].structure} · ${index >= 2 ? "richer treatment" : "choose a branch after arrival"}` : CONTRIBUTIONS[selected].small}</span></div>
              <button className="demo-button is-secondary" disabled={blocked || confirmed || (!permanent && status !== "playing")} onClick={() => onAction(
                { type: "confirm", gameId: selected, target: tier.id, at: new Date().toISOString() },
                `Self-confirmed ${tier.name}: ${tier.milestone}. ${tier.structural ? "Your earned addition can be placed after arrival." : "Your contribution records this milestone."}`,
              )}>{confirmed ? <><Check size={16} aria-hidden="true" /> Confirmed</> : `Self-confirm ${tier.name}`}</button>
            </li>
          })}</ul>
        </section>
        {permanent && <section className="demo-proof"><h4>{CONTRIBUTIONS[selected].small} → {CONTRIBUTIONS[selected].structure}</h4>
          <p>{placement ? `Placed at ${locationTitle(placement, world)}.` : earnedStructure(world, selected) ? "Earned, not yet placed. Choose a compatible branch—no cost or timer." : "Your small contribution is beside the gathering tree. A structural tier can earn an addition."}</p>
          {earnedStructure(world, selected) && <button className="demo-button is-secondary" onClick={placement ? () => onTravel(placement) : onBuild}>{placement ? "Visit contribution" : "Choose a branch"}</button>}
        </section>}
        {world.remnants[selected] && <section className="demo-proof"><h4>{game.character}&apos;s postcard</h4><p>A keepsake from an earlier invitation, beside the trailhead. Re-inviting keeps it; permanent arrival replaces it with {game.character}&apos;s contribution.</p>
          <div className="demo-action-row"><button className="demo-button is-secondary" onClick={() => onTravel("trailhead")}>See postcard</button><button className="demo-text-button" disabled={blocked} onClick={() => onAction({ type: "delete-remnant", gameId: selected }, `${game.character}'s postcard has been removed. You can invite them again whenever you like.`)}>Delete postcard</button></div>
        </section>}
        {Boolean(merit?.history.length) && <details className="demo-rules"><summary>Self-confirmed proof history · {merit!.history.length}</summary><ul className="demo-proof-history">{merit!.history.map(item => <li key={item.key}><strong>{item.tier}</strong> · {item.milestone}<span>{new Date(item.at).toLocaleDateString()} · self-confirmed</span></li>)}</ul><p className="demo-small-copy">Saved as originally confirmed. Editing rules never rewrites this history.</p></details>}
        {permanent && <section className="demo-memory" aria-label="Fictional sample memory">
          <h4><BookOpen size={17} aria-hidden="true" /> Sample memory</h4>
          <blockquote>“{game.memory}”</blockquote>
          <p>Written for the demo, not taken from your play history.</p>
        </section>}
        <GameNote key={`${game.id}:${world.notes[game.id] ?? ""}`} game={game} world={world} onAction={onAction} blocked={blocked} />
      </div>
    )
  }

  return (
    <div>
      <p className="demo-journal-intro">An invitation beyond the tree. A stamp that means enough to you. A familiar face who stays.</p>
      <RulesEditor world={world} gameId={null} onAction={onAction} blocked={blocked} />
      {([
        { status: "backlog", title: "Backlogged", empty: "Every sample adventure has found its beginning.", detail: "Possibilities outside the settlement. No rush." },
        { status: "playing", title: "Invited", empty: active ? `${active.character} is already a resident. Their replay is in Arrived.` : "No invitation is traveling right now.", detail: "Traveling beyond the tree until your stamp is met." },
        { status: "completed", title: "Arrived", empty: "Meet your chosen stamp to welcome a permanent neighbor.", detail: "People who stay, whatever comes next." },
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
                <span><strong>{game.title}</strong><span>{world.completions[game.id] ? `${game.character} · ${world.games[game.id] === "playing" ? "Replaying; still a resident" : world.homes[game.id] === "plot" ? "Legacy Fern House" : "Resident grove"}` : group.status === "playing" ? `${game.character} · traveling outside · ${rulesFor(world, game.id).stamp}` : `${game.description}${world.remnants[game.id] ? " · Postcard kept" : ""}`}</span></span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}</ul> : <p className="demo-empty-line">{group.empty}</p>}
        </section>
      })}
    </div>
  )
}
