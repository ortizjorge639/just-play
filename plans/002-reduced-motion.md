# 002 — Respect prefers-reduced-motion

- **Status**: TODO
- **Commit**: 34d5a3c
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 4 files, one wrapper each

## Problem

No file in the app handles `prefers-reduced-motion` (grep for it and
`useReducedMotion` returns nothing). Users with reduced motion enabled get
full slides, springs, and pulses.

## Target

Wrap each client motion root in framer-motion's config so transform
animations are dropped (opacity kept) for those users:

```tsx
import { MotionConfig } from "framer-motion"
<MotionConfig reducedMotion="user">…existing JSX…</MotionConfig>
```

## Steps

1. `components/app-shell.tsx`: wrap the component's outermost returned element.
2. `app/backlog/backlog-client.tsx`: wrap the returned `<main>`.
3. `app/treehouse/treehouse-client.tsx`: wrap the returned root div.
4. `app/welcome/page.tsx`: wrap the returned root element.

## Boundaries

- Do NOT hand-roll media queries; the one-prop wrapper is the fix.
- The treehouse 3D canvas is out of scope (game scene, not UI chrome).

## Verification

- **Mechanical**: `pnpm build` green.
- **Feel check**: with OS reduced-motion on, tabs/cards crossfade without sliding.
