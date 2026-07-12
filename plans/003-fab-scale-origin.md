# 003 — Search FAB: no scale(0) entrances

- **Status**: TODO
- **Commit**: 34d5a3c
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, 1 block

## Problem

```tsx
// components/game-search.tsx:113 — current
initial={{ scale: 0, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
exit={{ scale: 0, opacity: 0 }}
```

Nothing in the real world appears from nothing; a 48px control popping from
scale(0) reads as cartoonish on every deck visit.

## Target

```tsx
initial={{ scale: 0.9, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
exit={{ scale: 0.9, opacity: 0 }}
```

Keep the existing spring `{ type: "spring", stiffness: 400, damping: 25 }`.

## Steps

1. Edit the two values in `components/game-search.tsx:113,115`.

## Boundaries

- Do NOT touch the search sheet/modal in the same file.

## Verification

- **Mechanical**: `pnpm build` green.
- **Feel check**: FAB fades/settles in rather than ballooning.
