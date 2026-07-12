# Motion plans (improve-animations audit, 2026-07-11)

Source: Emil Kowalski's improve-animations skill run against commit 34d5a3c.

| Plan | Severity | Status | Depends on |
| --- | --- | --- | --- |
| 001-fast-tab-transitions | HIGH | DONE | 005 |
| 002-reduced-motion | MEDIUM | DONE | — |
| 003-fab-scale-origin | MEDIUM | DONE | — |
| 004-transition-all-cleanup | MEDIUM | DONE | — |
| 005-motion-tokens | LOW | DONE | — |
| 006-badge-dot-scale | LOW | DONE | — |

Execution order: 005 → 001 → 002 → 003 → 004 → 006.
Declined (user review): shared-layoutId nav indicator pill (missed-opportunity item).
