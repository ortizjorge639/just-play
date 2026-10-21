# Just Play design system (draft for owner review)

Status: tokens applied to `app/globals.css`. Owner decision: canopy art direction follows the latest treehouse world study, mixed with this palette's design. Individual assets and final avatars still need owner approval.

## Direction

Lantern Pastel. A dark teal night base with soft pastel accents. Contrast comes from pale colors on a deep base. Form comes from light gradients, a bright top edge and a darker bottom edge on controls. The app stays dark-only.

## Tokens (proposed mapping to `globals.css`)

| Token | Today | Proposed | Role |
|---|---|---|---|
| `--background` | `#0f0f14` | `#0f1a1f` | Page base (gradient to `#183241`) |
| `--foreground` | `#e0e0e6` | `#fcf7e9` | Body text |
| `--card` | `rgba(255,255,255,.06)` | `#1a2e38` (gradient from `#233c49`) | Cards |
| `--muted-foreground` | `#8b8d94` | `#a9bcc0` | Secondary text |
| `--primary` | `#5865F2` | `#f0b46a` (highlight `#ffd9a8`) | Main action |
| `--primary-foreground` | `#ffffff` | `#2a1a08` | Text on primary |
| `--success` | `#3BA55D` | `#8fcaa3` (highlight `#bfe3c9`) | Arrived, done |
| `--success-foreground` | `#ffffff` | `#10251a` | Text on success |
| `--destructive` | `#ED4245` | `#ffb4a2` | Errors (pale on dark) |
| new `--info` | n/a | `#b7d9ee` | Invited outline, hints |
| new `--emote` | n/a | `#c3b3e6` (highlight `#ddd2f5`) | Emotes |

Mood chips: Chill `#ffd0a1`, Focused `#bfe3c9`, Social `#b7d9ee`, with dark text `#14212a`.

Existing radius (`1.25rem`) and Geist fonts stay.

## Form rules

- Controls: gradient from highlight to base, `inset 0 1px 0 rgba(255,255,255,.5)` on top, `inset 0 -3px 0 rgba(0,0,0,.18)` below.
- Elevation: neutral black drop shadows only. No colored glows.
- Cards: `inset 0 1px 0 rgba(255,255,255,.12)` plus a soft black shadow.

## Accessibility

Measured WCAG contrast: text on base 16.5, muted on card 7.1, primary button text 11.8, Arrived tag 11.6, error on base 10.4. All at or above 7:1.

Never rely on color alone. Invited is a dashed outline, Arrived is a filled tag.

## Not yet checked

- Phone screens at low brightness.
- 3D scene colors against this palette.
- A migration pass over components that hardcode the old blue-violet.

## Samples

`palettes-v2.html` (colorway 1) from the design session.
