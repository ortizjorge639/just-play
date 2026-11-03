---
name: Just Play
description: Stop scrolling your library. Start playing.
colors:
  background: "#141714"
  foreground: "#f3efe3"
  card: "#1d211d"
  popover: "#20241f"
  primary: "#e2b56c"
  primary-highlight: "#efc985"
  primary-foreground: "#20180d"
  secondary: "#252a24"
  muted: "#242823"
  muted-foreground: "#b7b5aa"
  border: "#3a3d35"
  destructive: "#f0a08d"
  destructive-foreground: "#24120d"
  success: "#a7c7ad"
  success-highlight: "#bed6c2"
  success-foreground: "#172019"
  info: "#b8c5c7"
  info-foreground: "#1d2526"
  emote: "#b9b3c5"
  emote-highlight: "#d3ccdf"
  emote-foreground: "#211d27"
  input: "#3a3d35"
  ring: "#e2b56c"
typography:
  body:
    fontFamily: "Geist, Geist Fallback, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, Geist Fallback, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
  action:
    fontFamily: "Geist, Geist Fallback, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
spacing:
  2: "0.5rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 1.25rem"
    height: "3rem"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 1.25rem"
    height: "3rem"
    typography: "{typography.label}"
  game-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.5rem"
  input-search:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "0.5rem 1rem"
    height: "3rem"
  navigation-item:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem"
    height: "2.75rem"
---

# Design System: Just Play

## Overview

**Creative North Star: "Focused Play"**

Just Play is an operate-first interface for people choosing what to play. Treat it as a focused game shelf: artwork leads, the surrounding controls stay quiet and legible, and a single amber action clarifies the next step.

The dark ink, warm ivory, and restrained amber palette carries across Discover, Now Playing, Home, Progress, and StandBy. Use Geist for the interface, solid surfaces for controls, and a subtle wash plus dither on game artwork. Canopy is not part of current navigation; preserve its separate implementation without exposing the toggle.

**Key Characteristics:**
- Artwork-first Split Focus layout: recommendation list beside a large game image on wide screens, stacked on phones.
- Amber identifies selection, primary actions, and the active navigation item; semantic status colors remain separate.
- Solid, bordered surfaces and icon-plus-label controls.
- Selection is reversible; only **Start Playing** begins a session.

## Colors

The interface uses ink and muted neutrals as its field, with warm amber as the single action accent. Green, rose, and cool neutrals are reserved for semantic state.

### Primary
- **Warm amber** (`#e2b56c`): Primary actions, selected recommendations, focus rings, and active navigation.
- **Amber highlight** (`#efc985`): Hover state for primary actions.

### Neutral
- **Ink** (`#141714`): Page background and mobile browser theme color.
- **Warm ivory** (`#f3efe3`): Main text and high-contrast foregrounds.
- **Card charcoal** (`#1d211d`): Recommendation rows and solid card surfaces.
- **Raised charcoal** (`#20241f`, `#252a24`): Popovers and secondary surfaces.
- **Muted ink** (`#242823`): Quiet surface contrast.
- **Warm gray** (`#b7b5aa`): Supporting text and labels.
- **Border** (`#3a3d35`): Dividers, outlines, and input edges.

### Named Rules
**The Amber Action Rule.** Amber marks actions and current selection; success, destructive, and informational colors communicate state rather than decoration.

Semantic state tokens are `success` (`#a7c7ad`), `destructive` (`#f0a08d`), `info` (`#b8c5c7`), and `emote` (`#b9b3c5`), each paired with its corresponding foreground token. Do not substitute these for the primary action color.

## Typography

**Display Font:** Geist (with Geist Fallback, system-ui, sans-serif)

**Body Font:** Geist (with Geist Fallback, system-ui, sans-serif)
**Label/Mono Font:** Geist Mono for elapsed-time and numeric readouts.

**Character:** Compact, direct, and readable. Use weight and size to establish hierarchy; reserve the larger display treatment for the selected game and quiet StandBy screen.

### Hierarchy
- **Display** (semibold, 1.875rem to 3rem, tight leading): Featured game names and primary page headings; allow long titles to wrap.
- **Title** (semibold, 1.25rem to 1.5rem): Section and card headings.
- **Body** (regular, 0.875rem to 1rem, 1.5 line-height): Descriptions and supporting content.
- **Label** (medium, 0.75rem to 0.875rem): Genres, timing, navigation labels, and compact state text.
- **Timer** (Geist Mono, tabular numerals): StandBy elapsed time only; retain its explicit verified/unverified state.

## Layout

The app shell uses a 64px compact header and a fixed 64px bottom navigation, with content padded clear of the nav. Discover is capped at 1440px. At wide widths, a narrow recommendation list sits beside a larger artwork/detail panel; at smaller widths, the list stacks above the detail panel. Keep the primary action within the visible content area at common phone sizes.

Use the existing Tailwind spacing rhythm: 8px for tight groups, 16px for component spacing, and 24px or more to separate sections. Give metadata and utility controls less visual weight than the selected game and its next action.

## Elevation & Depth

Prefer tonal contrast and fine borders over floating layers. The shared `.glass-card` utility is a solid charcoal surface with a subtle `0 8px 24px rgba(0, 0, 0, 0.18)` shadow; its name does not imply a blurred surface. Keep backdrop blur limited to overlays where it separates a modal from the page. Game artwork may use a low-opacity radial color wash and a dither canvas; respect reduced-motion preferences.

## Shapes

Use the established 4px, 8px, 12px, and 16px radius scale. Recommendation rows and action buttons use restrained rounded corners; larger artwork panels may use the 16px radius. Use thin neutral borders for separation. Avoid nesting bordered cards when spacing or a divider is enough.

## Components

### Buttons
- **Character:** Tactile primary actions with quiet secondary controls.
- **Primary:** Amber fill (`#e2b56c`), dark text (`#20180d`), 12px corners, at least 48px high, with a concise icon and action label when it clarifies the action.
- **Hover / Focus:** Primary hover uses the amber highlight. Keep the 2px amber focus outline visible with a 4px offset.
- **Secondary:** Solid or transparent dark surface with a thin border and warm-ivory text; keep the label explicit.
- **Disabled / Pending:** Reduce opacity and prevent interaction. Loading copy must not imply that an action has completed.

### Chips
- **Style:** Compact, low-contrast surface with a clear label.
- **State:** Use semantic colors only for real session or progress status, not as decoration.

### Cards / Containers
- **Corner Style:** 12px on shared solid surfaces; 16px where the artwork panel needs a larger frame.
- **Background:** Use `card` or `background` tokens with a fine neutral border.
- **Shadow Strategy:** Subtle offset shadow only; never use blur as a decorative card material.
- **Artwork:** Reuse `GameArtwork` so the source image, wash, and dither treatment stay together. Keep readable text above a dark overlay.
- **Selection:** Clearly mark the selected row. A ready-to-play selection stays reversible until the user starts.

### Inputs / Fields
- **Style:** Transparent text input inside the solid `.glass-card` search surface, with a search icon and muted placeholder.
- **Focus:** Use the shared amber focus ring; keep clear-search and loading states visible and labeled.

### Navigation
- **Header:** Keep “Just Play,” a divider, and the current section aligned in one compact bar; place section actions at the opposite edge. StandBy uses the same brand/section structure with an explicit Exit action.
- **Bottom navigation:** Fixed, icon above label, 44px minimum control height, amber active state, and descriptive accessible names.

### Artwork Treatment
Use the real game image as the expressive surface. The animated radial wash is subtle and slow; the dither is an overlay, not a replacement for the image. When reduced motion is requested or canvas readback is unavailable, preserve the original artwork and keep the text/action layer usable.

## Do's and Don'ts

### Do:
- **Do** keep amber for the primary action, current selection, and active navigation.
- **Do** pair an icon with a concise label for primary actions and navigation.
- **Do** keep game titles readable at narrow widths and enlarged text sizes.
- **Do** preserve a visible focus indicator and reduced-motion behavior.
- **Do** keep session, timer, and status wording honest about what the app has verified.

### Don't:
- **Don't** restore “Your game is waiting for you” or “Taking a breath” style filler copy.
- **Don't** expose the Artwork/Canopy toggle in current production navigation.
- **Don't** use decorative blur, extra accent colors, or busy motion to compete with the game art.
- **Don't** treat selecting a game as starting a session; only explicit play intent may do so.
