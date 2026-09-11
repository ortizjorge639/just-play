"use client"

import { useState } from "react"
import { ArrowRight, Check, MapPin } from "lucide-react"
import type { DemoState, GameId, LocationId, SiteId } from "@/lib/demo/contracts"
import { CONTRIBUTIONS, earnedStructure, GAMES } from "@/lib/demo/state"
import { availableSites, LOCATION_BY_ID, locationTitle } from "@/lib/demo/world"
import { GameMark, type ApplyDemoAction } from "./journal"

export function BuildPanel({ world, onAction, onTravel, blocked }: {
  world: DemoState; onAction: ApplyDemoAction; onTravel: (location: LocationId) => void; blocked: boolean
}) {
  const [choices, setChoices] = useState<Partial<Record<GameId, SiteId>>>({})
  const sites = availableSites(world)
  const earned = GAMES.filter(game => earnedStructure(world, game.id))
  return <div>
    <p className="demo-journal-intro">A place shaped by the adventures you chose.</p>
    <p className="demo-body-copy">Deeper self-confirmed tiers earn original gardens, decks, and pavilions. Choose a compatible branch; its platform, bridge, map entry, and walkable path appear together. No costs or timers.</p>
    {!earned.length && <p className="demo-inline-notice">No structural additions earned yet. In the journal, invite a game, meet its arrival stamp, then self-confirm a structural tier. The grove&apos;s furnished home is already open to explore.</p>}
    {earned.map(game => {
      const placed = world.placements[game.id]
      const selected = choices[game.id]
      const validChoice = selected && sites.includes(selected) ? selected : ""
      return <section key={game.id} className="demo-contribution-choice">
        <div className="demo-game-detail-heading"><GameMark game={game} /><div><h3>{CONTRIBUTIONS[game.id].structure}</h3><p>{game.character} · {game.title}</p></div></div>
        <p>{CONTRIBUTIONS[game.id].detail}. Later tiers enrich this same addition in place.</p>
        {placed ? <div className="demo-built-line"><span><Check size={17} aria-hidden="true" /> {locationTitle(placed, world)}</span><button className="demo-text-button" onClick={() => onTravel(placed)}>Go there <ArrowRight size={16} aria-hidden="true" /></button></div>
          : <div className="demo-placement-form">
            <label htmlFor={`site-${game.id}`}>Choose a compatible branch for {game.character}</label>
            <select id={`site-${game.id}`} disabled={blocked || !sites.length} value={validChoice} onChange={event => setChoices({ ...choices, [game.id]: event.target.value as SiteId })}>
              <option value="">Choose a branch…</option>
              {sites.map(site => <option value={site} key={site}>{site === "plot" ? "Grove branch" : LOCATION_BY_ID[site].title}</option>)}
            </select>
            {validChoice && <p className="demo-small-copy">{LOCATION_BY_ID[validChoice].subtitle} Authored open-air addition; the separate grove home has the enterable interior.</p>}
            <button className="demo-button" disabled={blocked || !validChoice} onClick={() => {
              if (validChoice) onAction({ type: "place", gameId: game.id, site: validChoice }, `${game.character}'s ${CONTRIBUTIONS[game.id].structure.toLowerCase()} is placed. Its bridge and path are open.`)
            }}>Place earned contribution</button>
          </div>}
      </section>
    })}
    {world.builtHouse && <section className="demo-contribution-choice">
      <h3>Fern House · preserved legacy build</h3>
      <p className="demo-body-copy">Your version-one home, bridge, and resident assignments remain on their original branch. It occupies that site; no new proof or replacement construction is required.</p>
      <button className="demo-button is-secondary" onClick={() => onTravel("plot")}><MapPin size={17} aria-hidden="true" /> Visit Fern House</button>
      <ul className="demo-resident-list">{GAMES.filter(game => world.completions[game.id]).map(game => {
        const here = world.homes[game.id] === "plot"
        return <li key={game.id} className="demo-assignment-row"><GameMark game={game} /><div><strong>{game.character}</strong><span>{here ? "Fern House" : "Resident grove"}</span></div><button className="demo-button is-secondary" disabled={blocked} onClick={() => onAction(
          { type: "move", gameId: game.id, home: here ? "grove" : "plot" }, `${game.character}'s home has moved; their contribution and proof history stay.`,
        )}>{here ? "Move to grove" : "Move in"}</button></li>
      })}</ul>
    </section>}
    <p className="demo-small-copy">{sites.length} compatible branches available. Seven authored sites allow all six sample contributions plus a preserved legacy home. No unrestricted building is promised.</p>
  </div>
}
