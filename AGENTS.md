# AGENTS.md — Just Play v2

Instructions for any AI agent (Hermes, Claude Code, Codex, Cursor, Copilot, etc.) picking up this repo. If you're an agent reading this cold: **read this whole file before touching branches or opening a PR.**

> Note: `.github/copilot-instructions.md` in this repo describes the **old v1 architecture** (swipeable card deck, single-page session state machine). That's stale — v2 is a 6-screen routed app with a completely different structure. Don't follow it for anything touching `app/(v2)/`.

---

## What this is

Jorge's ("Joji") game backlog / completion tracker. Full product vision (village-of-completion narrative, companion mechanics, marketing philosophy) lives outside this repo in his Obsidian vault at `Projects/Just-Play/Just Play.md`. This file is the **technical/status/process layer only** — don't duplicate the vision doc here.

---

## 🚦 THE MERGE GATE — read this before doing anything with branches

**Do not merge anything into `main`. Ever. Without Jorge's explicit, real-time confirmation, in that exact conversation.**

This is not a style preference — it's a hard stop per his standing POC-first policy: *never push/merge code without explicit ask, verify e2e before declaring anything done.*

The intended sequence, gated at every hop:

```
feature/treehouse  →  v2  →  main
      (1)                (2)
```

1. **`feature/treehouse` → `v2`**: merge the 3D treehouse world + Supabase-wired Completed screen back into the active MVP branch. Lower stakes (still not production), but still confirm with Jorge before merging — his commit message says "build clean, integration complete" but that's a self-report from the branch's own history, not a verified fact. Actually run it (`pnpm build`, `pnpm dev`, click through the Completed screen with a real Supabase session) before telling him it's ready, let alone merging.
2. **`v2` → `main`**: this is the real ship gate. `main` currently has *none* of the v2 work — it's sitting at the pre-v2 README commit. Do not open this PR, and do not merge it, until Jorge says so explicitly in the moment. Don't infer consent from "sounds good" about something else, or from silence.

If you're an autonomous/cron agent and hit a point where the next step is a merge into `main`: **stop and surface it as a question instead.** Do not merge and report after the fact.

---

## Repo & branch map

Repo: `ortizjorge639/just-play`. GH PAT for API access: `~/.ghpat` (no `gh` CLI on the box that usually operates this repo — use `curl` + GitHub REST API, see `github-repo-management` skill if you're a Hermes instance).

| Branch | Role | State (verify — don't trust this table blindly, see workflow below) |
|---|---|---|
| `main` | old baseline | far behind v2 — last commit is the pre-v2 README, never received any v2 work |
| `v2` | active MVP branch | all 6 screens scaffolded, styled, routed; deployed to just-play-five.vercel.app |
| `feature/treehouse` | ahead of `v2` by 3 commits | real 3D treehouse world (`components/treehouse-world.tsx`) + Supabase-wired Completed screen (`lib/treehouse.ts`) replacing the v2 mock array; unmerged |
| `v0/officialguy639-*` | legacy v0.dev auto-generated | dead, ignore |

## Deploy targets

| URL | What |
|---|---|
| just-play-five.vercel.app | v2 app build |
| just-play.created.app | landing/marketing page (built via `anything` CLI) |

## Stack

Next.js 16 · React 19 · TypeScript · Supabase (auth + Postgres) · shadcn/ui · Tailwind v4 · Framer Motion. Game search (`app/api/search-games` → IGDB) is auth-gated — a 401 hitting it directly with no Supabase session is expected, not a bug.

---

## Status-check workflow — don't answer "what's left" from memory or docs

Both the vault roadmap (`JP-Roadmap-2026.md`, has a manually-maintained `current_step` frontmatter field) and any dated design-review snapshot **drift stale fast**. As of 2026-07-05 the roadmap claimed "Step 11 — prepare v2 branch" while git showed 88 commits on `v2` with all 6 screens fully built, routed, and an entire prior design-review punch list closed out same-day. Never cite a step number or a review doc's open items as current fact — verify:

1. `git log --oneline v2 | wc -l` then `git log --oneline v2 -30` — real commit history beats any doc.
2. **Check every active branch, not just `v2`.** `git branch -a`, `git log --oneline feature/treehouse -10`, `git diff v2..feature/treehouse --stat`. This is the step most likely to get skipped — a v2-only check completely misses ahead-of-branch work.
3. Cross-reference any dated review doc's punch list against commits made *after* its date — grep the repo for the specific component/prop it flagged to confirm the fix actually landed.
4. Confirm live deploy health: `curl -s -o /dev/null -w "%{http_code}" <url>`.
5. Check for a test suite before assuming one exists: `find . -iname "*.test.*" -o -iname "*.spec.*"` (exclude `node_modules`) + grep `package.json` for test/vitest/jest/playwright scripts. As of 2026-07-05: **none exist.**
6. Check PR state via GitHub REST API (no `gh` CLI on the usual operating box): `curl -s -H "Authorization: token $(cat ~/.ghpat)" "https://api.github.com/repos/ortizjorge639/just-play/pulls?state=all"`. A branch can be fully done in commits with zero PR ever opened toward `main`.

---

## Treehouse 3D — retrospective + improvement plan (as of 2026-07-05)

The `feature/treehouse` scene (`components/treehouse-world.tsx`, ported from a standalone POC previously at `~/jp-treehouse/poc/index.html`) is **hand-rolled vanilla Three.js r128**, loaded via CDN `<script>` tags with a `setInterval` poll waiting for `window.THREE` before initializing. No React Three Fiber, no npm `three` package, no GLTF/rigged models — every character and every room object (walls, roof trusses, ladder rungs, bookshelf, fireplace) is procedural `BoxGeometry`/`CylinderGeometry` calls with hardcoded `.position.set(x,y,z)`. Confirmed live via a local tunnel + browser inspection, not just reading source.

**Why it looks "wonky" — root causes, not just symptoms:**

| Symptom | Root cause |
|---|---|
| Characters float/clip on surfaces | No contact shadows, no ground-snapping — position is just `baseY + sin(t)*bobAmp`, doesn't read terrain |
| Faces look like flat stickers | They *are* — a 2D `<canvas>` texture (`ctx.arc` eyes, `ctx.ellipse` mouth) mapped onto one flat quad face of the head box. Expression changes are instant texture-swaps, no blending |
| Walking looks stiff | Limb animation is raw trig directly on `rotation.x` (e.g. `Math.sin(t*4+phase)*0.45`), no easing, no secondary motion, pivot isn't anatomically at the joint |
| Lighting reads flat/inconsistent | No IBL/environment map, no baked lightmaps — just a few point lights (fire, lamp) + `PCFSoftShadowMap`. The post-processing (bloom + custom color-grade shader with vignette/grain) is genuinely solid — that part isn't the problem |
| Won't scale past current game count | Every avatar is 6+ freshly-constructed meshes with unique materials — no `InstancedMesh`, no geometry merging |

**What actually works and should be kept:** the FSM-driven behavior system (wander/sit/talk/loft_idle), proximity-based talk bubbles with per-game dialogue lines (`BUDDY_VOICE`), the rim-glow shader technique, and the color-grade post-process pipeline. The engineering underneath is more sophisticated than the visual output suggests — the ceiling is capped by the "single portable HTML file" architecture, not by lack of effort.

**If a future agent (or a stronger 3D-capable model) revisits this, priority order:**

1. **Port to React Three Fiber + drei**, dropping the CDN-script/`setInterval` approach entirely. This alone fixes several complaints for free: `<ContactShadows>` (floating characters), `<Environment>` (flat lighting), `<Billboard>` (manual screen-space projection math for speech bubbles becomes unnecessary).
2. **Real rigs instead of rotated boxes** — either actual skeletal animation (rig a simple GLB, drive walk/idle/sit via `AnimationMixer` with blending) or, if keeping the voxel aesthetic, correct joint pivots + secondary/overlapping motion so limbs stop moving in lockstep sine waves.
3. **Faces as blended states**, not hard texture swaps — higher-res canvas, eased transitions, morph-target blinking.
4. **Stop hand-coding room geometry** — 400+ lines of box positions is a maintenance trap. Model once in Blender or generate via Meshy/Tripo3D, export GLB, load once.
5. **Material variation** (roughness/normal maps for a "toy plastic" look) and **instancing** (`InstancedMesh` for repeated geometry) once game count grows.

---

## Pitfalls (repo-specific, not just treehouse)

- **`gh` CLI is not installed on the box this repo is usually operated from.** Use `git` locally + raw `curl` against the GitHub REST API with `~/.ghpat`.
- **`app/api/search-games` requires an authenticated Supabase session** — a 401 hitting it directly is expected, not a broken integration.
- **No `.env` file is committed** (correctly) — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` must come from the deploy environment or a local untracked `.env.local`. The middleware (`middleware.ts` → `lib/supabase/proxy.ts`) redirects every route except `/auth/*` and `/welcome` to login without a valid session — expect this when poking routes locally without auth configured.
- **`.github/copilot-instructions.md` describes the pre-v2 architecture** — treat it as historical, not current, until someone rewrites it for the v2 screen model.
