# 006 — Nav badge dot: soften scale(0) pop

- **Status**: TODO
- **Commit**: 34d5a3c
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, 1 value

## Problem

```tsx
// components/bottom-nav.tsx:89 — current
initial={{ scale: 0 }}
```

## Target

```tsx
initial={{ scale: 0.5, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
```

## Boundaries

- Do NOT touch the glow pulse below it (deliberate attention effect, runs 3×).

## Verification

- **Mechanical**: `pnpm build` green.
