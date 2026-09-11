"use client"

import { useId, useState } from "react"
import type { DemoState, GameId, MilestoneRules } from "@/lib/demo/contracts"
import { rulesFor } from "@/lib/demo/state"
import type { ApplyDemoAction } from "./journal"

export function RulesEditor({ world, gameId, onAction, blocked }: {
  world: DemoState; gameId: GameId | null; onAction: ApplyDemoAction; blocked: boolean
}) {
  const current = gameId ? rulesFor(world, gameId) : world.rules.defaults
  return <details className="demo-rules">
    <summary>{gameId ? "Choose this game's stamp & tiers" : "Default stamp & merit tiers"}</summary>
    <RuleForm key={JSON.stringify(current)} current={current} gameId={gameId} onAction={onAction} blocked={blocked} />
    {gameId && !world.rules.games[gameId] && <button className="demo-text-button" disabled={blocked} onClick={() => onAction(
      { type: "rules", gameId, rules: current }, "These rules are now specific to this game. Future default edits won't change them.",
    )}>Make these rules specific to this game</button>}
    {gameId && world.rules.games[gameId] && <button className="demo-text-button" disabled={blocked} onClick={() => onAction(
      { type: "rules", gameId, rules: null }, "This game now uses your default rules. Past proofs and permanent arrival are unchanged.",
    )}>Use default rules instead</button>}
  </details>
}

function RuleForm({ current, gameId, onAction, blocked }: {
  current: MilestoneRules; gameId: GameId | null; onAction: ApplyDemoAction; blocked: boolean
}) {
  const prefix = useId()
  const [draft, setDraft] = useState<MilestoneRules>(() => structuredClone(current))
  const updateTier = (index: number, patch: Partial<MilestoneRules["tiers"][number]>) =>
    setDraft(previous => ({ ...previous, tiers: previous.tiers.map((tier, i) => i === index ? { ...tier, ...patch } : tier) }))
  return <form onSubmit={event => {
    event.preventDefault()
    onAction({ type: "rules", gameId, rules: draft }, "Milestone rules saved. Existing arrivals, earned additions, and proof history stay yours.")
  }}>
    <p className="demo-small-copy">You decide what counts: two hours, a story chapter, a season, credits, or a personal goal. These are self-confirmed sample milestones, not measured playtime.</p>
    <fieldset disabled={blocked}>
      <label htmlFor={`${prefix}-stamp-choice`}>Permanent arrival stamp</label>
      <select id={`${prefix}-stamp-choice`} value={draft.tiers.some(tier => tier.milestone === draft.stamp) ? draft.stamp : "__custom"} onChange={event => {
        setDraft({ ...draft, stamp: event.target.value === "__custom" ? "" : event.target.value })
      }}>
        {[...new Set(draft.tiers.map(tier => tier.milestone))].map(milestone => <option key={milestone} value={milestone}>{milestone || "Untitled milestone"}</option>)}
        <option value="__custom">Custom stamp — edit below</option>
      </select>
      <label htmlFor={`${prefix}-stamp`}>Your “done enough” milestone</label>
      <input id={`${prefix}-stamp`} required maxLength={120} value={draft.stamp} onChange={event => setDraft({ ...draft, stamp: event.target.value })} />
      <p className="demo-small-copy">This stamp makes the avatar permanent, regardless of any tier&apos;s name. Editing rules never revokes history or automatically earns new proofs.</p>
      <h4>Merit tiers · from lighter to deeper engagement</h4>
      {draft.tiers.map((tier, index) => <div className="demo-tier-editor" key={tier.id}>
        <label htmlFor={`${prefix}-${tier.id}-name`}>Tier {index + 1} name</label>
        <input id={`${prefix}-${tier.id}-name`} required maxLength={30} value={tier.name} onChange={event => updateTier(index, { name: event.target.value })} />
        <label htmlFor={`${prefix}-${tier.id}-milestone`}>Milestone to self-confirm</label>
        <input id={`${prefix}-${tier.id}-milestone`} required maxLength={120} value={tier.milestone} onChange={event => updateTier(index, { milestone: event.target.value })} />
        <label className="demo-check-label"><input type="checkbox" checked={tier.structural} onChange={event => updateTier(index, { structural: event.target.checked })} /> Earn a structural contribution at this tier</label>
        <button type="button" className="demo-text-button" disabled={draft.tiers.length === 1} onClick={() => setDraft({ ...draft, tiers: draft.tiers.filter(item => item.id !== tier.id) })}>Remove tier {index + 1}</button>
      </div>)}
      <button type="button" className="demo-text-button" disabled={draft.tiers.length >= 5} onClick={() => {
        const id = Array.from({ length: 5 }, (_, i) => `tier-${i + 1}`).find(id => !draft.tiers.some(tier => tier.id === id))!
        setDraft({ ...draft, tiers: [...draft.tiers, { id, name: "My milestone", milestone: "Reach my next personal goal", structural: true }] })
      }}>Add a tier {draft.tiers.length}/5</button>
      <div className="demo-action-row"><button type="submit" className="demo-button" disabled={JSON.stringify(draft) === JSON.stringify(current)}>Save {gameId ? "game" : "default"} rules</button></div>
    </fieldset>
  </form>
}
