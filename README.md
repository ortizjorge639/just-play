# Just Play

> *You don't track games. You collect proof that you showed up.*

Just Play is a game tracker built around a simple idea: meaningful time with a game becomes a permanent part of your world. You choose what counts as done enough. Not a spreadsheet. Not a list. A treehouse full of characters and memories, built game by game.

---

## What it does

- **Backlog** — your queue. Add games, keep the pile honest.
- **In Progress** — one game at a time. Track sessions, set goals, stay in it.
- **Completed** — every finished game becomes a character in your treehouse. They live there.

---

## Stack

- [Next.js 16](https://nextjs.org/) + React 19 + TypeScript
- [Supabase](https://supabase.com/) — auth + database
- [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS v4
- [Framer Motion](https://www.framer.com/motion/) — animations
- [Three.js](https://threejs.org/) + React Three Fiber — the original Canopy demo world
- [IGDB](https://www.igdb.com/api) — game metadata

---

## Status

**v2 in progress** — full redesign. Building in public.

The [treehouse world study](docs/treehouse-world-study.md) analyzes Yukagecho
and maps its spatial experience to a proposed Just Play gaming home. It is
research and a world-model proposal, not a description of shipped 3D features.

The **Canopy demo** at `/demo` makes that direction playable: explore a treehouse
settlement, invite game characters, choose a stamp of proof for permanent
arrival, and place the additions earned through deeper engagement. Dropped
invitations leave removable postcards, not penalties. Leave the world on
display as ambient art. It uses original procedural scenery, fictional sample
games, explicit milestone self-confirmation, and browser-local saves.
See the [presenter guide](docs/demo.md).

The separate [Canopy art archive](docs/canopy-art/README.md) preserves the
September 12 Blender approval slice, original brief, specifications, development
tools, final GLBs, and evidence. Technical delivery is complete; **visual approval
is pending**. These offline assets are not integrated into the demo or app.

Follow the build → [@jojiguy639](https://x.com/jojiguy639)

---

## Running locally

```bash
pnpm install
pnpm dev
```

The account-backed app requires a `.env.local` with Supabase and IGDB credentials.
The public `/demo` route does not require those credentials or a login.

---

*Built by [@jojiguy639](https://x.com/jojiguy639)*
