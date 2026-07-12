# 004 — Replace transition-all with property-specific transitions

- **Status**: TODO
- **Commit**: 34d5a3c
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 3 feature files (~8 class strings)

## Problem

`transition-all` animates unintended properties off-GPU:

- `components/quick-filters.tsx:75,95,115` — filter chips (colors only change)
- `components/quick-filters.tsx:132` — submit button (colors + active:scale)
- `components/session-notepad.tsx:106,221` — glass buttons (colors + active:scale)
- `components/session-notepad.tsx:314` — pagination dots whose SIZE animates
  (`w-2` ↔ `w-1.5`): a real layout animation
- `components/card-deck.tsx` lock-in button — colors + active:scale

## Target

- Chips (color-only): `transition-colors`
- Buttons with `active:scale-*`: `transition` (Tailwind default covers colors,
  opacity, transform — not layout)
- Notepad dots: constant `h-2 w-2`, drive size with `scale-75`/`scale-100`
  and `transition-[background-color,transform]`:

```tsx
className={`h-2 w-2 rounded-full transition-[background-color,transform] ${
  i === currentPage ? "scale-100 bg-primary"
    : pages[i]?.trim() ? "scale-75 bg-foreground/30" : "scale-75 bg-muted-foreground/15"
}`}
```

## Boundaries

- Do NOT touch `components/ui/*` (vendored shadcn primitives).
- Visual result must be identical at rest.

## Verification

- **Mechanical**: `pnpm build` green; `grep -rn "transition-all" components/ app/ --include="*.tsx" | grep -v components/ui` returns nothing.
- **Feel check**: chips/buttons/dots animate as before.
