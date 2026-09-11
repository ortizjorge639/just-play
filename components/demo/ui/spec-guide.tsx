"use client"

import { ArrowLeft, ArrowRight, X } from "lucide-react"
import type { GameId, LocationId } from "@/lib/demo/contracts"

type SpecDestination =
  | { panel: "journal"; game: GameId | null }
  | { panel: "map" | "build" | "settings" }
  | { location: LocationId }

type SpecExample = {
  id: string
  title: string
  source: string
  requirement: string
  demonstration: string
  boundary: string
  action: string
  note: string
  destination: SpecDestination
}

export const SPEC_EXAMPLES = [
  {
    id: "residents",
    title: "Games become permanent neighbors",
    source: "Treehouse App Specs / Core Concept",
    requirement: "Each game is represented as a Mii-like avatar.",
    demonstration: "Mosslight Valley becomes Pip; Paper Skies becomes Wren. Arrived avatars wander the connected world and remain after a replay ends.",
    boundary: "The six games and simple stylized avatars are original demo stand-ins, not imported games or a Mii-style avatar creator. Pip and Wren begin as sample residents.",
    action: "Find the residents",
    note: "The colored neighbors represent games, not separate collectibles. The directory links each permanent resident to their game and home; use it to visit them.",
    destination: { panel: "map" },
  },
  {
    id: "cycle",
    title: "Backlogged, Invited, Arrived",
    source: "Treehouse App Specs / Game Cycle",
    requirement: "The user reaches a self-defined stamp of proof. The avatar joins the Treehouse as a permanent resident.",
    demonstration: "The journal groups games by these three states. Invite a game, then self-confirm its arrival stamp to welcome the same avatar permanently.",
    boundary: "One active invitation or replay at a time. Invited avatars appear as traveling in the journal and map, not as animated travelers or lodge guests.",
    action: "See the game cycle",
    note: "These three journal groups are your game cycle. Open a Backlogged game to invite it. Arrival requires your explicit stamp confirmation, not time spent in this world.",
    destination: { panel: "journal", game: null },
  },
  {
    id: "stamp",
    title: "You decide what counts as enough",
    source: "Treehouse App Specs / Stamp of Proof",
    requirement: "The user sets this threshold per game or uses a default rule.",
    demonstration: "Set a shared default or override a game's stamp: two hours, a story milestone, or your own definition of done enough. Meeting it grants permanent arrival.",
    boundary: "Milestones are text and explicit self-confirmations. No playtime measurement, launcher integration, trophy checks, or external proof verification.",
    action: "Inspect a game's stamp",
    note: "Open Choose this game's stamp & tiers below to edit Sol's rule. All sample games leads to the shared default editor. The confirmation button demonstrates your decision; it does not verify gameplay.",
    destination: { panel: "journal", game: "ember" },
  },
  {
    id: "tiers",
    title: "Deeper engagement enriches the same resident",
    source: "Treehouse App Specs / Tiered Merit System",
    requirement: "Users can define multiple tiers to reflect different levels of completion.",
    demonstration: "Visited, Resident, and Elder are editable defaults. Further confirmations enrich one contribution; they never create a second avatar or revoke an arrival.",
    boundary: "One to five tiers, with configurable names, milestones, and structural rewards. This demonstrates contribution depth, not a separate avatar costume or badge system.",
    action: "Inspect merit tiers",
    note: "More of the same story lists Sol's current tiers. Structural tiers earn a deck after arrival; higher depth enriches that same addition. Tier names never decide whether Sol belongs.",
    destination: { panel: "journal", game: "ember" },
  },
  {
    id: "remnants",
    title: "An unfinished attempt leaves a keepsake",
    source: "Treehouse App Specs / Dropped Games",
    requirement: "Remnants are not a penalty.",
    demonstration: "Ending an invitation before arrival leaves one postcard at the trailhead and in that game's journal. Re-inviting retains it; arrival replaces it. You may delete it.",
    boundary: "No decay or automatic expiry. The example only appears after an unarrived invitation is ended. An already-arrived resident's replay cannot create a postcard or evict them.",
    action: "Inspect the postcard path",
    note: "For an unarrived game, Invite sample game then End invitation keeps a postcard. Its controls appear below once created. If Rue has already arrived in your save, use another Backlogged game instead.",
    destination: { panel: "journal", game: "rain" },
  },
  {
    id: "trinkets",
    title: "Small memories add character, not floor space",
    source: "Treehouse App Specs / Treehouse Evolution",
    requirement: "It adds character but does not change the structure of the Treehouse.",
    demonstration: "Arrived games bring small themed exhibits beside the gathering tree: Pip's lantern seedling, Wren's folded glider, or Sol's ember reliquary.",
    boundary: "These are authored game-specific props, not a furniture-placement editor. A placed structural contribution takes over the game's exhibit; scenery is not all earned.",
    action: "See the small exhibits",
    note: "Look beside the gathering tree for the small game-themed exhibits. Pip and Wren supply the starter examples unless their additions have been placed. Trees, the lodge, and the original grove home are starter scenery, not earned rewards.",
    destination: { location: "plaza" },
  },
  {
    id: "growth",
    title: "Deeper play physically expands the world",
    source: "Treehouse App Specs / Treehouse Evolution",
    requirement: "The space itself grows.",
    demonstration: "A structural tier earns a themed addition. In Build, choose a compatible branch; the deck, bridge, map entry, and walkable connection appear together, without a cost or timer.",
    boundary: "Six authored themes and seven sites, not unlimited construction. Additions are open-air and cannot be relocated. The original grove home is the only furnished interior.",
    action: "Inspect earned expansion",
    note: "Build separates earned from placed. If no addition is ready, confirm a structural tier for an arrived game in its journal first. Choosing a branch is a real saved change; this guide never grants rewards for you.",
    destination: { panel: "build" },
  },
  {
    id: "world",
    title: "A connected plaza you can navigate",
    source: "World study / Infrastructure, map, and camera",
    requirement: "Treehouses, connected spaces, expansion, and map-and-camera wayfinding.",
    demonstration: "Walk the bridges, use the map for direct travel, find wandering residents, and enter the grove home. Placed additions extend this same navigable layout.",
    boundary: "This is the earlier world brief, not an extra requirement from the Treehouse App Specs. Movement and local routines are implemented; friend visits and multiplayer are not.",
    action: "Explore the connected map",
    note: "Solid bridges are connected routes. Dashed circles are compatible future sites, not destinations yet. Travel to the resident grove, then enter its furnished home; other houses are exteriors.",
    destination: { panel: "map" },
  },
  {
    id: "ambient",
    title: "Your gaming history becomes ambient art",
    source: "Your ambient-art idea / World study",
    requirement: "Leave it on as an art piece and admire a world built game by game.",
    demonstration: "Choose Ambient tour or Still view, close Settings, and let the controls fade. Neighbors continue their routines. The camera button downloads a clean world photograph.",
    boundary: "Browser ambient viewing, not a native OS screensaver. Watching earns nothing. Worlds save locally on this device; sharing the URL does not share your personal save.",
    action: "Find ambient and still views",
    note: "Choose Ambient tour or Still view, then Back to the canopy. Controls fade after inactivity; move, tap, or press a key to reveal them. Reduced motion holds the camera still. The world pauses while this panel is open.",
    destination: { panel: "settings" },
  },
] as const satisfies readonly SpecExample[]

export type SpecId = typeof SPEC_EXAMPLES[number]["id"]

export function SpecGuide({ onInspect, onHelp }: {
  onInspect: (id: SpecId) => void
  onHelp: () => void
}) {
  return <div className="demo-spec-guide">
    <p className="demo-journal-intro">Your document, made visible in the canopy.</p>
    <p className="demo-body-copy">Each note connects a requirement to something you can inspect here. Opening an example only navigates: it never invites a game, confirms proof, builds, or resets your save.</p>
    <p className="demo-small-copy">Read <strong>Demonstrated here</strong> as working demo behavior, not a claim that the whole production feature is finished. <strong>Demo boundary</strong> calls out the simplification.</p>
    <div className="demo-spec-examples">
      {SPEC_EXAMPLES.map(example => <details key={example.id} className="demo-spec-example">
        <summary>{example.title}</summary>
        <div>
          <p className="demo-small-copy">{example.source}</p>
          <dl>
            <dt>From your brief</dt><dd>{example.requirement}</dd>
            <dt>Demonstrated here</dt><dd>{example.demonstration}</dd>
            <dt>Demo boundary</dt><dd>{example.boundary}</dd>
          </dl>
          <button className="demo-text-button" onClick={() => onInspect(example.id)}>{example.action}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </details>)}
    </div>
    <section className="demo-help-section">
      <h3>The idea is real; the data is fictional</h3>
      <p>This is a local-first model of your spec, not a connected backlog service. Real account libraries, licensed characters, online saves, friend visits, and unrestricted house building are not implemented here.</p>
      <button className="demo-text-button" onClick={onHelp}>Help and controls <ArrowRight size={16} aria-hidden="true" /></button>
    </section>
  </div>
}

export function SpecAnnotation({ id, onBack, onDismiss }: {
  id: SpecId
  onBack: () => void
  onDismiss: () => void
}) {
  const example = SPEC_EXAMPLES.find(item => item.id === id)!
  return <aside className="demo-spec-annotation" aria-label={`Spec note: ${example.title}`}>
    <h3>{example.title}</h3>
    <p>{example.note}</p>
    <div>
      <button className="demo-text-button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to spec guide</button>
      <button className="demo-text-button" onClick={onDismiss}><X size={16} aria-hidden="true" /> Hide note</button>
    </div>
  </aside>
}
