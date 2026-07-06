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

### ✅ 2026-07-06: hop (1) is DONE — merge + verification log

Hop (1) `feature/treehouse` → `v2` was completed on 2026-07-06 with Jorge's explicit in-session approval. Hop (2) `v2` → `main` remains fully gated — `main` still has none of the v2 work.

What happened, for the record:

- Merged as `ccc6df1` (`--no-ff`). Per step 1 below, `tsconfig.tsbuildinfo` was **excluded** from the merge (`git rm --cached` inside the merge commit) and `*.tsbuildinfo` added to `.gitignore`, so it never landed on `v2` as a tracked file.
- Runtime-verified on the merged branch with a real Supabase session (the `test@justplay.dev` test account, via the login page's "Quick Play (Test Mode)" button): login ✓; IGDB search through the app's own `/api/search-games` ✓ (200, real results); Completed screen reads real `game_progress` rows ✓ — two `beaten` rows were inserted for the test user (Celeste `igdb-11208`, Hades `igdb-113112`, left in place as demo data) and both showed up in the count badge, list view, and Recently Completed strip with real cover art; 3D treehouse scene renders with per-game buddies and `BUDDY_VOICE` dialogue ✓.
- **Found and fixed during verification** (`a79c129` on `v2`): the three.js CDN scripts were async `<Script>` tags with no execution-order guarantee — when any addon beat `three.min.js`, it threw `THREE is not defined` and the scene stayed permanently black. Also, the readiness poll only checked 2 of 7 addons, so init could fire before `ShaderPass`/`UnrealBloomPass` existed. Scripts are now injected sequentially (`async=false`) and the readiness check covers everything `buildScene` uses. Verified across 3 fresh mounts, zero errors.
- Known open items found during verification (real findings, not yet fixed): the status ticker in `app/(v2)/completed/completed-client.tsx` (~line 276) is **hardcoded POC text** — it shows "Hades is chilling / Celeste found a cozy spot" even for an account with zero completed games; the add-game confirm page's "✅ Add to Backlog" / "▶ Just Play" buttons have **no onClick handlers** — the add flow is UI-only, though the server actions (`addSearchedGame`, `markGameBeaten`) exist and work; Next.js warns the `middleware` file convention is deprecated in favor of `proxy`.
- `feature/treehouse` is fully merged (its tip `1be183a` is an ancestor of `v2` — verified with `git merge-base --is-ancestor`) and approved for deletion, but the deletion itself was **blocked by the operating session's environment** (the git proxy 403s ref deletions; the GitHub MCP toolset has no delete-branch tool). Jorge or a box with direct push rights should finish it: `git push origin --delete feature/treehouse`, or GitHub UI → branches. Until then the branch is dead weight — do not build on it.

The subsections below are kept as the playbook that was followed (and for the next experimental branch); their dated claims are historical now.

### `feature/treehouse` was an experiment — treat the merge as a code review, not a rubber stamp

`feature/treehouse` was built to prove out a 3D world concept, not written under the same scrutiny as the rest of `v2`. "The commit message says it's clean" is not the same as "it's clean." Before merging, actually check:

1. **Diff it first, don't blind-merge.** `git diff v2..feature/treehouse --stat` and read the full diff on anything nontrivial. As of 2026-07-05 this touches `app/(v2)/completed/page.tsx` + `completed-client.tsx` (splits server/client, wires real Supabase data in place of the v2 mock array), `components/treehouse-world.tsx` (the 3D scene itself, +1117/-… lines), `lib/treehouse.ts` (new data layer), and two files that are **not real feature changes** and need a second look before they ride along:
   - `tsconfig.tsbuildinfo` — a compiler build artifact, **not gitignored in this repo** (`.gitignore` has no `tsbuildinfo` entry). This should not be a tracked file at all. Add it to `.gitignore` and `git rm --cached tsconfig.tsbuildinfo` rather than merging it in.
   - `pnpm-workspace.yaml` — just someone answering pnpm's interactive `allowBuilds` prompt (`esbuild/sharp/unrs-resolver: true` instead of the placeholder `set this to true or false`). Harmless, but confirm it's the whole diff and nothing else snuck in under it.
2. **No dependency drift as of the last check** (`git diff v2..feature/treehouse -- package.json pnpm-lock.yaml` was empty) — if that's changed since, run `pnpm install` after merging and re-verify the lockfile before building.
3. **Branches may no longer be a clean fast-forward.** If any commits have landed on `v2` directly since `feature/treehouse` was cut (e.g. this very `AGENTS.md` file did), the two branches have mutually diverged — `git merge-base --is-ancestor v2 feature/treehouse` will fail, and you need a real three-way merge / PR, not a fast-forward. Check this fresh each time, don't assume the table above is still true.
4. **Actually run the app before calling it done** — `pnpm install && pnpm build && pnpm dev`, then click through the Completed screen with a real logged-in Supabase session (the new `lib/treehouse.ts` data layer requires auth — see pitfalls below) and confirm the treehouse scene renders and the completed-games list matches real `game_progress` rows, not the old mock array.
5. **Mechanical merge**, once 1–4 are clean and Jorge has said yes:
   ```bash
   git checkout v2
   git pull origin v2
   git merge feature/treehouse --no-ff -m "merge: feature/treehouse into v2 — 3D world + Supabase-wired Completed screen"
   # Verified via dry-run (git merge --no-commit --no-ff, then --abort) on
   # 2026-07-05: this is a clean merge, zero conflicts — 6 files auto-stage
   # (completed-client.tsx added, completed/page.tsx + treehouse-world.tsx +
   # pnpm-workspace.yaml modified, lib/treehouse.ts + tsconfig.tsbuildinfo
   # added). feature/treehouse predates AGENTS.md so it won't conflict there.
   # If a real conflict DOES show up, that means v2 picked up other commits
   # since this was last checked — re-run the dry-run yourself before assuming
   # this note is still accurate.
   pnpm install && pnpm build   # verify build is actually green post-merge
   git push origin v2
   ```
   Prefer `--no-ff` so the merge is a visible, revertable commit rather than silently rewriting history — this was an experimental branch, keep the seam visible.
6. **After merging, `feature/treehouse` is done** — don't leave it lingering as a source of confusion for the next agent. Ask Jorge if it should be deleted (`git push origin --delete feature/treehouse`) or kept around as a reference; don't unilaterally delete it without asking, but do flag it rather than leaving five stale branches for the next status-check pass to puzzle over.

### If something goes wrong mid-merge — stop, don't improvise

The steps above assume the happy path (dry-run clean → real merge → build passes → push). If reality diverges from that:

- **Real merge produces conflicts the dry-run didn't show** (means someone pushed to either branch between your dry-run and the real merge): do not hand-resolve conflicts to force it through. Run `git merge --abort` to get back to a clean `v2`, re-run the dry-run check (step 3 above) to see the *current* diff, and either re-plan the merge with fresh eyes or go back to Jorge if the conflict touches something you don't have context on (e.g. someone else's commit landed on `v2` in the meantime).
- **`pnpm build` fails after a real (committed) merge, before you've pushed**: do not push a broken build to `origin/v2` — that blocks Jorge and any other agent working off this branch. Fix forward only if the failure is small and obviously caused by the merge itself (e.g. an import path collision) and you can verify the fix with a clean rebuild; otherwise `git reset --hard HEAD~1` to undo the merge commit locally (safe — nothing pushed yet) and report the specific build error back to Jorge instead of pushing something broken.
- **You already pushed and then discovered a problem**: don't force-push over it silently. Tell Jorge what broke and what you want to do about it (revert commit vs. fix-forward commit) — a shared branch's history is something to negotiate, not unilaterally rewrite.

---

## Repo & branch map

Repo: `ortizjorge639/just-play`. GH PAT for API access: `~/.ghpat` (no `gh` CLI on the box that usually operates this repo — use `curl` + GitHub REST API, see `github-repo-management` skill if you're a Hermes instance).

| Branch | Role | State (verify — don't trust this table blindly, see workflow below) |
|---|---|---|
| `main` | old baseline | far behind v2 — last commit is the pre-v2 README, never received any v2 work |
| `v2` | active MVP branch | all 6 screens scaffolded, styled, routed; now includes the treehouse 3D world + Supabase-wired Completed screen (merged `ccc6df1`, 2026-07-06, runtime-verified); deployed to just-play-five.vercel.app |
| `feature/treehouse` | merged, pending deletion | fully merged into `v2` as `ccc6df1` on 2026-07-06 (tip `1be183a` is an ancestor of `v2`); approved for deletion but the operating session couldn't delete refs — safe to remove with `git push origin --delete feature/treehouse`, do not build on it |
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
6. Check PR state via GitHub REST API (no `gh` CLI on the usual operating box). Read the token from `~/.ghpat` into a shell variable, then build the curl auth header from that variable — e.g. `GH_TOKEN=$(cat ~/.ghpat)` followed by a `curl -H` call passing `"token $GH_TOKEN"` as the auth header value against `https://api.github.com/repos/ortizjorge639/just-play/pulls?state=all`. (Written descriptively here rather than as one literal copy-pasteable line — some write tooling pattern-matches and mangles an inlined `"<header-name>: token $VAR"` string even when it's just a variable reference in documentation, not a real credential. Construct the two-step version yourself rather than trusting a single-line command pasted from a doc.) A branch can be fully done in commits with zero PR ever opened toward `main`.

---

## Treehouse 3D — retrospective + improvement plan (as of 2026-07-05)

The treehouse scene (`components/treehouse-world.tsx`, now on `v2`; ported from a standalone POC previously at `~/jp-treehouse/poc/index.html`) is **hand-rolled vanilla Three.js r128**, loaded from CDN with a `setInterval` poll waiting for `window.THREE` before initializing (since `a79c129` the scripts inject sequentially with `async=false` — the original async tags had a load-order race that black-screened the scene). No React Three Fiber, no npm `three` package, no GLTF/rigged models — every character and every room object (walls, roof trusses, ladder rungs, bookshelf, fireplace) is procedural `BoxGeometry`/`CylinderGeometry` calls with hardcoded `.position.set(x,y,z)`. Confirmed live via a local tunnel + browser inspection, not just reading source.

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
