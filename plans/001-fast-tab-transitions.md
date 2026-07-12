# 001 — Make tab switching fast and asymmetric

- **Status**: TODO
- **Commit**: 34d5a3c
- **Severity**: HIGH
- **Category**: Purpose & frequency / Easing & duration
- **Estimated scope**: 1 file (components/app-shell.tsx), 3 motion.div blocks

## Problem

Tab switching is the app's most frequent action. `components/app-shell.tsx:166`
uses `AnimatePresence mode="wait"` and each tab pane animates:

```tsx
// components/app-shell.tsx:170 — current (same shape at :189 and :241)
initial={{ opacity: 0, x: -20 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -20 }}
transition={{ duration: 0.2 }}
```

`mode="wait"` serializes: 200ms exit fully completes before the 200ms
entrance starts — ~400ms of dead time per tab tap, on framer's default
easeInOut (entrances should be ease-out).

## Target

Asymmetric timing: exit snaps, entrance is quick and decisive.

```tsx
import { EASE_OUT_STRONG } from "@/lib/motion"

initial={{ opacity: 0, x: -8 }}   // keep each pane's existing x sign (deck -8; session/progress +8)
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -8, transition: { duration: 0.1, ease: EASE_OUT_STRONG } }}
transition={{ duration: 0.15, ease: EASE_OUT_STRONG }}
```

Total perceived switch ≤ 250ms. Keep `mode="wait"` (avoids overlap layout work).

## Repo conventions to follow

- JS motion constants live in `lib/motion.ts` (created by plan 005): `export const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const`.

## Steps

1. In `components/app-shell.tsx`, update all three tab-pane `motion.div`s (keys `deck`, `session`, `progress`) to the target config, preserving each pane's existing x-direction sign.
2. Import `EASE_OUT_STRONG` from `@/lib/motion`.

## Boundaries

- Do NOT change `mode="wait"`, markup, keys, or the settings modal.
- Depends on plan 005 (lib/motion.ts).

## Verification

- **Mechanical**: `pnpm build` green.
- **Feel check**: switch tabs rapidly — no blank gap, no lag; content appears crisply.
