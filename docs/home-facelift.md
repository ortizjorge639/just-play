# Home facelift

Status: decisions agreed with the owner, tickets ready. Replaces nothing; builds on [spec-story-7-settlement.md](spec-story-7-settlement.md) and [player-placement-proposal.md](player-placement-proposal.md).

## The problem

Every story works, but Home does not feel like a place. The default view is a list that reads like a database. The settlement sits behind a toggle, inside a small box, and residents react with a line of text. The gap is in the experience, not in missing features.

## Decisions

- **Two experiences on Home.**
  - **List:** a simple bird's-eye view. Lives here, On the way, and later Archived.
  - **Settlement:** a virtual place that shows finished and on-the-way games as a growing treehouse community.
- **Main verb of the Settlement:** plan and arrange. The player places and moves homes like a planner. Decorating interiors is a later phase.
- **Metaphor:** the treehouse stays. A flat-land neighborhood theme is only built if the treehouse fails. Scene code should not hard-wire the metaphor, so a second theme stays possible.
- **Full screen.** Entering the Settlement takes over the whole screen on phones and desktop, like loading into a game. It has a loading screen while assets render. A small Back button and the HUD stay on top.
- **New player.** An empty plot with one "first home" marker that points them to lock in a game.
- **Voice.** Plain and human. No unlock, streak, collect, countdown or "almost there".

## Non-goals

Interior decorating, friend visits, the neighborhood theme, account recovery, sharing.

## Deferred unknowns

- Loading-time budget and asset weight on weak phones.
- Whether a lighter mode is needed for low-end devices.

## Tickets

Each ticket is one PR. Order follows the dependencies.

1. **H1. Full-screen Settlement shell.** Entering from Home opens a full-viewport layer with a loading screen, then the scene. A visible Back button returns to Home and restores focus. Escape also goes back. Tests cover open, loading state, and back. Blocks H3 to H5.
2. **H2. First-home plot.** With no residents, the Settlement shows one empty plot with a "first home" marker and a plain line pointing to locking in a game. The entry button is available even with zero homes. Blocked by H1.
3. **H3. Home shell and list.** The List/Settlement choice moves above the sections and is remembered per player. Keepsakes is renamed Archived. List sections read Lives here, On the way, Archived. Independent of H1.
4. **H4. Settlement front door.** Name card in the full-screen HUD, tap a home opens a bottom sheet with the portrait, a one-time plain hint on first visit. Blocked by H1.
5. **H5. Planner mode.** Drag to place, move and rotate homes on a snap grid, with undo. Builds on the placement actions already shipped. Needs its own short spec before code.
6. **H6. Living residents.** Idle motion, a visible reaction to Say hi, an arrival moment after a session. Needs art direction first.
7. **H7. Theme contract.** A small scene and theme interface so a neighborhood theme can follow if needed.
8. **Later: decorating.** Furniture catalog and room view. Spec first.

## Owner steps

None for H1 to H4. No migrations and no settings changes.
