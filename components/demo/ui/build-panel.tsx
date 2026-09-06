"use client"

import { ArrowRight, Check, Home, MapPin } from "lucide-react"
import type { DemoState, LocationId } from "@/lib/demo/contracts"
import { GAMES } from "@/lib/demo/state"
import { GameMark, type ApplyDemoAction } from "./journal"

function HousePreview() {
  return <svg className="demo-house-preview" viewBox="0 0 460 240" role="img" aria-label="Illustrated preview of Fern House: a timber home with a broad pitched roof, warm windows, and a fern-lined porch.">
    <path d="M67 179 204 111 395 173 258 230Z" fill="#475f3b" />
    <path d="M67 179v13l190 48 138-54v-13l-137 57Z" fill="#314532" />
    <path d="m149 159 85-38 104 36-81 43Z" fill="#a27a4e" />
    <path d="m162 160 4-59 79-31 71 31v62l-65 29Z" fill="#a47f51" />
    <path d="m245 70 71 31v62l-65 29Z" fill="#6c563d" />
    <path d="m134 107 45-66 112 20 50 45-98-21Z" fill="#bd8352" />
    <path d="m134 107 109-22 48-24-112-20Z" fill="#cea56a" />
    <path d="m243 85 48-24 50 45Z" fill="#9c6b43" />
    <path d="m184 116 26-9v28l-26 10Z" fill="#f3d590" />
    <path d="m195 112v29m-11-11 26-10" fill="none" stroke="#695536" strokeWidth="3" />
    <path d="m269 117 21 7v27l-21-6Z" fill="#f3d590" />
    <path d="m229 129 15-5v51l-15 6Z" fill="#493e31" />
    <path d="m155 163 96 33 78-32m-168-9v19m29-10v19m28-9v19m32-1v17m25-29v18m26-32v18m24-31v18" fill="none" stroke="#c4a477" strokeWidth="5" />
    <path d="M111 174q-25-43-23-17m23 17q-4-51 9-24m-9 24q26-38 27-13M354 183q-22-44-23-18m23 18q-2-51 8-27m-8 27q29-30 25-8" fill="none" stroke="#8eae73" strokeWidth="5" strokeLinecap="round" />
    <path d="m192 208-10 14m18-11-10 14m18-11-10 14m18-11-10 14" stroke="#b49566" strokeWidth="5" />
  </svg>
}

export function BuildPanel({ world, onAction, onTravel, blocked }: {
  world: DemoState
  onAction: ApplyDemoAction
  onTravel: (location: LocationId) => void
  blocked: boolean
}) {
  const residents = GAMES.filter(game => world.completions[game.id])
  return (
    <div>
      <div className="demo-blueprint"><HousePreview /><span>Fern House · illustrated preview</span></div>
      <div className="demo-section-heading">
        <h3>A little more room</h3>
        <p>A timber home on a new branch, connected to the grove by a footbridge.</p>
      </div>
      {world.builtHouse ? (
        <div className="demo-built-line"><span><Check size={18} aria-hidden="true" /> Fern House is built</span><button className="demo-text-button" onClick={() => onTravel("plot")}>Go there <ArrowRight size={16} aria-hidden="true" /></button></div>
      ) : (
        <>
          <p className="demo-body-copy">This demo has one home to build. There are no costs, timers, or chores—just a place for someone who stayed.</p>
          <button className="demo-button" disabled={blocked} onClick={() => onAction({ type: "build" }, "Fern House is ready. A new bridge now connects it to the grove.")}><Home size={18} aria-hidden="true" /> Build Fern House</button>
        </>
      )}
      <section className="demo-resident-assignment">
        <div className="demo-section-heading"><h3>{world.builtHouse ? "Make it a home" : "Future neighbors"}</h3><p>{world.builtHouse ? "Choose who lives here. Everyone still meets at the gathering tree." : "Permanent residents can move in once the house is built."}</p></div>
        <ul className="demo-resident-list">
          {residents.map(game => {
            const here = world.homes[game.id] === "plot"
            return <li key={game.id} className="demo-assignment-row">
              <GameMark game={game} />
              <div><strong>{game.character}</strong><span>{game.title}</span><span className="demo-resident-home"><MapPin size={13} aria-hidden="true" /> {here ? "Fern House" : "Resident grove"}</span></div>
              <button className="demo-button is-secondary" disabled={!world.builtHouse || blocked} onClick={() => onAction(
                { type: "move", gameId: game.id, home: here ? "grove" : "plot" },
                `${game.character} now lives ${here ? "in the resident grove" : "at Fern House"}. Their story comes with them.`,
              )}>{here ? "Move to grove" : "Move in"}</button>
            </li>
          })}
        </ul>
      </section>
    </div>
  )
}
