# 005 — Shared motion tokens

- **Status**: TODO
- **Commit**: 34d5a3c
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 2 files (new lib/motion.ts, globals.css)

## Problem

Every duration and curve in 14 animated files is hand-typed; there are no
shared motion tokens for either CSS or framer-motion.

## Target

```css
/* app/globals.css — inside :root */
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
```

```ts
// lib/motion.ts (new)
export const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const
export const EASE_IN_OUT_STRONG = [0.77, 0, 0.175, 1] as const
```

New/edited motion code uses these; no mass retrofit of existing files.

## Boundaries

- Do NOT rewrite existing transitions beyond the files touched by plans 001–004.

## Verification

- **Mechanical**: `pnpm build` green.
