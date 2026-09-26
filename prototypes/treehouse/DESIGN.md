---
name: Just Play — Toy Treehouse Prototype
description: A very cozy, toy-scale home for the games you finish.
colors:
  paper: "#f8f5e9"
  ink: "#354f42"
  muted: "#637261"
  primary-button: "#52775e"
  primary-label: "#fff8df"
  secondary-button: "#e7ebd7"
  secondary-label: "#4b6950"
  card: "#fffdf3"
  selected-resident: "#eef1df"
  focus: "#b58132"
typography:
  body:
    fontFamily: '"Avenir Next", "Nunito", "Trebuchet MS", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 500
  display:
    fontSize: "clamp(30px, 3.1vw, 46px)"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-.04em"
  section:
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-.025em"
  button:
    fontSize: "12px"
    fontWeight: 700
rounded:
  field: "12px"
  card: "22px"
  button: "24px"
spacing:
  compact: "8px"
  control: "12px"
  group: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-button}"
    textColor: "{colors.primary-label}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 21px"
  button-secondary:
    backgroundColor: "{colors.secondary-button}"
    textColor: "{colors.secondary-label}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "12px 21px"
---

# Design System: Just Play — Toy Treehouse

## Overview

**Creative North Star: "A cozy toy treehouse"**

This system applies only inside `prototypes/treehouse/`, not to the production app.
It records `src/style.css`, `src/app.tsx`, and the procedural world in `src/scene.ts`;
`index.html` is the built prototype. Product authority remains `../../PRODUCT.md`.
Production integration is not part of this artifact.

The approved world is toyish, diorama-scale, and very cozy. Animal Crossing: New
Horizons informs approachable pacing and materials, not copied characters or assets.
Original rounded residents, soft forest light, and paper keepsakes make completion tangible.
**Key Characteristics:**
- Warm paper, leafy greens, and restrained golden accents.
- Small physical objects with visible thickness, not floating glass panels.
- Friendly sentence-case copy and a usable library alongside the 3D scene.

## Colors

### Primary
Leafy greens carry actions and selection; primary and secondary button colors above
are the actual component fills, not substitutes for the root green declarations.
### Secondary
Warm gold supports the goal fill (`#d6b663`) and the amber focus indicator.
### Neutral
`paper`, `ink`, and `muted` map directly to `--paper`, `--ink`, and `--muted`.
Cream cards separate content gently; selected residents receive a pale green surface.
The forest uses soft radial color layers; evening changes the scene, not the whole UI theme.

## Typography

All roles inherit the body stack above; no font is downloaded or bundled.
Installed Avenir Next, Nunito, or Trebuchet MS determines the actual face.
The display ramp is compact and rounded in feeling, with tight tracking and balanced headings.
Library headings use `clamp(28px, 3.2vw, 40px)`; card titles are 19px on desktop.
Body copy uses 14px with contextual line-height around 1.7–1.8; supporting labels are
mostly 10–13px, with some mobile metadata at 9px. Timers and counts use tabular numerals.
These small labels describe the build, not a recommended minimum or an accessibility endorsement.

## Layout

Desktop uses a horizontal header, a layered diorama, then a four-column resident roster.
Library content is capped at 1280px with 5% side padding; backlog cards also use four columns.
Spacing is contextual rather than a strict scale: recurring 8px, 12px, and 24px gaps
coexist with 15px roster gaps and 24px desktop game-grid gaps.
At 1100px, controls and portraits tighten. At 760px and below, navigation wraps to
a second header row, grids become two columns, and in-progress cards stack vertically.
The desktop resident note is hidden; its mobile counterpart moves **below the roster**.
The scene remains above it, with camera controls below the diorama. At 380px, type
and portraits tighten further; at 1550px, wide-screen margins are constrained.

## Elevation & Depth

**The Toy Thickness Rule.** Depth represents physical edges and resting surfaces.
Game cards share a solid lower edge (`0 5px 0 #e4e4d2`); primary buttons use
`inset 0 -3px #3b5d48, 0 3px 7px #53744310`.
The shared raised-surface shadow is `0 6px 0 #cdd6bb, 0 12px 25px #4964440d`.
Paper notes add slight rotation and offset shadows; the diorama adds contact shadows
and warm directional lighting. These effects belong to the toy materials.
Three detector `side-tab` warnings on logo/button/progress inset bottom shadows were
reviewed as intentional physical depth, not side bars. No detector rules are suppressed.

## Shapes

Soft, thick silhouettes connect the UI to the original procedural residents.
Cards, fields, and buttons use the frontmatter radii; larger playing cards and dialogs
use 26px and 27px. Circular portraits and capsule navigation contrast with asymmetric
paper-note corners. Fine one-pixel borders and dashed separators retain a stationery feel.

## Components

- **Buttons/navigation:** primary and secondary capsules; active navigation is green with an inset edge. Hover dims to `.97` brightness; press moves down 1px; disabled buttons use `.5` opacity.
- **Fields/dialogs:** cream inputs with thin green-gray borders; native modal dialogs have labeled fields and close controls. Buttons, links, inputs, and selects receive a 3px amber focus outline, offset 4px.
- **Resident roster:** selectable portrait buttons update the note and 3D selection; the selected item has a green-tinted surface and `aria-pressed`.
- **Three authored state changes:** starting a game shares its artwork into the in-progress card (spring stiffness 210, damping 27); finishing brings a resident into the world with a 1.1s scale settle and 1.6s mote burst; selecting a resident changes the desktop note with a 200ms fade/6px rise and a resident wave.
- **Supporting motion:** progress fills use a 600ms transform transition; save/arrival notices use a spring (250/24). Ambient breathing, blinking, and motes remain secondary to tracking.
- **Reduced motion:** system preference and the ambient pause control disable scene animation and transform/layout motion; camera changes snap, arrivals render at full scale, and motes disappear. The note transition becomes immediate; toast opacity may still fade. CSS reduces transition/animation duration to `.01ms` under the system preference.
- **Resilience:** labeled roster controls, a skip link, status announcements, and a 3D-error message preserve non-canvas access. These implemented features do not establish complete accessibility conformance.

## Do's and Don'ts

- **Do** preserve original toy assets, warm materials, visible control labels, and the non-3D library path.
- **Do** treat completion as a keepsake; maintain calm, no-streak-pressure copy.
- **Don't** copy Animal Crossing assets or characters, or treat this prototype as production-integrated.
- **Don't** remove intentional lower-edge shadows merely to silence a detector.
- **Don't** canonize every decorative color, unused root declaration, or small metadata size as a reusable token.
