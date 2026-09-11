"use client"

import { useId } from "react"
import type { DemoState, SceneSnapshot } from "@/lib/demo/contracts"
import { GAME_BY_ID, GAMES, residentsFor, rulesFor } from "@/lib/demo/state"
import { availableSites, LOCATION_BY_ID, locationTitle, visibleConnections, visibleLocations } from "@/lib/demo/world"

const mx = (x: number) => 500 + x * 8
const mz = (z: number) => 370 + z * 8

export function WorldMap({ world, snapshot, compact = false }: {
  world: DemoState
  snapshot: SceneSnapshot
  compact?: boolean
}) {
  const title = useId()
  const locations = visibleLocations(world)
  const residents = residentsFor(world)
  const player = snapshot.inside ? LOCATION_BY_ID.grove : { x: snapshot.player.x, z: snapshot.player.z }

  return (
    <svg className={`demo-world-map${compact ? " is-compact" : ""}`} viewBox="120 -15 770 765" role="img" aria-labelledby={title}>
      <title id={title}>Canopy map. You are {snapshot.inside ? "inside a grove home" : `at ${LOCATION_BY_ID[snapshot.location].title}`}.</title>
      <g fill="none" stroke="currentColor" className="demo-map-contours" strokeWidth="1">
        <ellipse cx="493" cy="376" rx="306" ry="226" />
        <ellipse cx="493" cy="376" rx="274" ry="197" />
        <path d="M173 566Q318 626 438 611M647 150Q777 192 814 302M252 259Q284 173 354 147" />
      </g>
      <g stroke="#ad9468" strokeWidth={compact ? 9 : 7} strokeLinecap="round">
        {visibleConnections(world).map(([a, b]) => (
          <line key={`${a}-${b}`} x1={mx(LOCATION_BY_ID[a].x)} y1={mz(LOCATION_BY_ID[a].z)} x2={mx(LOCATION_BY_ID[b].x)} y2={mz(LOCATION_BY_ID[b].z)} />
        ))}
      </g>
      {locations.map(location => (
        <g key={location.id}>
          <circle cx={mx(location.x)} cy={mz(location.z)} r={location.radius * 7} fill={location.id === snapshot.location ? "#405d46" : "#294638"} stroke="#879770" strokeWidth="2" />
          <path d={`M${mx(location.x) - 9} ${mz(location.z) + 6}v-13l9-8 9 8v13z`} fill="#d2b67d" />
          <title>{locationTitle(location.id, world)}</title>
          {!compact && <text x={mx(location.x)} y={mz(location.z) + location.radius * 7 + 23} textAnchor="middle" fill="#f2ead8" fontSize="18">
            {location.id === "plaza" ? "Gathering tree" : location.id === "trailhead" ? "Trailhead" : location.id === "grove" ? "Resident grove" : location.id === "lookout" ? "Lookout" : location.id === "lodge" ? "Lodge" : Object.entries(world.placements).find(([, site]) => site === location.id)?.[0] ? GAME_BY_ID[Object.entries(world.placements).find(([, site]) => site === location.id)![0] as keyof typeof GAME_BY_ID].character + "'s addition" : "Fern House"}
          </text>}
        </g>
      ))}
      {!compact && availableSites(world).map(site => {
        const point = LOCATION_BY_ID[site]
        return <g key={site}><circle cx={mx(point.x)} cy={mz(point.z)} r="21" fill="none" stroke="#879770" strokeDasharray="5 5" strokeWidth="2" /><text x={mx(point.x)} y={mz(point.z) + 41} textAnchor="middle" fill="#b9c5b3" fontSize="17">{site === "plot" ? "Grove branch" : point.title}</text><title>Compatible site: {point.title}. Place an earned addition to connect it.</title></g>
      })}
      {!compact && residents.map((resident, index) => {
        const live = snapshot.residents.find(value => value.gameId === resident.gameId)
        const home = LOCATION_BY_ID[resident.home]
        const x = live?.x ?? home.x + index * 1.6 - 2
        const z = live?.z ?? home.z + 2
        return <circle key={resident.gameId} cx={mx(x)} cy={mz(z)} r="6" fill={GAME_BY_ID[resident.gameId].color} stroke="#14291f" strokeWidth="2"><title>{GAME_BY_ID[resident.gameId].character}</title></circle>
      })}
      {!compact && GAMES.filter(game => world.remnants[game.id]).map((game, index) => <g key={game.id} transform={`translate(${mx(-9 + index * 1.6)},${mz(25)})`}><rect width="10" height="7" fill="#e0bd7f" /><title>{game.character}&apos;s retained postcard</title></g>)}
      {!compact && <g>
        <path d="M250 660H740" stroke="#879770" strokeDasharray="5 7" />
        <text x="490" y="690" textAnchor="middle" fill="#b9c5b3" fontSize="18">Beyond the settlement · invitations travel here</text>
        {GAMES.filter(game => world.games[game.id] === "playing" && !world.completions[game.id]).map(game => <g key={game.id}>
          <circle cx="300" cy="720" r="7" fill={game.color} /><text x="318" y="726" fill="#f2ead8" fontSize="18">{game.character} · awaiting your stamp</text><title>{rulesFor(world, game.id).stamp} · self-confirmed in the journal</title>
        </g>)}
      </g>}
      <g transform={`translate(${mx(player.x)},${mz(player.z)}) rotate(${snapshot.player.yaw * 180 / Math.PI})`}>
        <circle r={compact ? 19 : 14} fill="#13271f" stroke="#f7eacb" strokeWidth="2" />
        <path d="M0-10L7 8 0 4-7 8Z" fill="#f7eacb" />
      </g>
      <text x="816" y="134" textAnchor="middle" fill="#c4cbbb" fontSize="24">N</text>
      <path d="M816 144v25m-6-18 6-7 6 7" fill="none" stroke="#c4cbbb" strokeWidth="2" />
    </svg>
  )
}
