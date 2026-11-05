# StandBy browser verification

Use the worktree root as the working directory. These tests use isolated local
fixtures and actual bundled art; they do not access the production database.

## Home completed-game gallery

```sh
STANDBY_TEST_PORT=4492 node_modules/.bin/playwright test --config tests/standby/playwright.config.ts home.spec.ts --grep "calm empty state|4:3 carousel|expand into a gallery|Home stamp"
```

Home shows the completed-game count and a See all gallery with 4:3 artwork.
Completed means the player marked a game beaten; Arrived means it met the
player's arrival rule, which may happen before completion. Stamp help opens on
hover, keyboard focus, or tap. Settings can hide both visual stamps without
changing game records; this preference is saved on the current device.
Cases cover touch help, keyboard dismissal, responsive expansion, saved
visibility, and storage-save errors.

## Now Playing artwork stage

```sh
pnpm exec playwright test --config tests/standby/playwright.config.ts now-playing.spec.ts standby.spec.ts notes.spec.ts --project=chromium
pnpm exec playwright test --config tests/standby/playwright.config.ts now-playing.spec.ts --project=webkit --project=firefox
```

Now Playing uses full-width artwork above a wrapping session-control strip.
Goals, notes, time preferences, and prior-play context sit below the controls.
The layout cases cover desktop, tablet, small phones, short landscape screens,
long titles, and 200% text. They also check stale-time labeling, disabled
actions during verification failures, and untracked-session presentation.
StandBy and note-save cases exercise the existing actions with mocked
account data. The image replacement is schematic, so these checks do not
verify real cover-art crops, physical devices, or a deployed account session.

## StandBy appearance

```sh
pnpm exec playwright test --config tests/standby/playwright.config.ts artwork-motion.spec.ts
```

StandBy defaults to ordered dither, with ASCII and unfiltered artwork alternatives.
Appearance controls store style, color, and background-motion choices on the
current device; they do not change session recording. The cached texture pans
as one image rather than deforming individual rows. Tests cover visible motion,
static reduced-motion rendering, simulated visibility changes, blocked-canvas
fallback, responsive controls, and saved appearance choices. These lifecycle
fixtures simulate visibility; they are not native background-tab certification.
Mobile cases use touch input at portrait and short-landscape sizes (down to
568 by 320), verify 44px targets, rotate during StandBy, and exercise the
Appearance overlay and pause/resume controls. Compact layouts retain accessible
names on icon buttons. Physical iOS/Android browser chrome still needs a device
check; viewport tests cannot certify it.

## Shared-world regression and motion preferences

```sh
STANDBY_TEST_PORT=4393 node node_modules/@playwright/test/cli.js test living-world.spec.ts world-lifecycle.spec.ts --config tests/standby/playwright.config.ts --project=chromium --workers=1 --timeout=30000
```

## Native background/foreground lifecycle (separate required command)

```sh
STANDBY_TEST_PORT=4393 xvfb-run -a node node_modules/@playwright/test/cli.js test --config tests/standby/native-world.playwright.config.ts
```

On Linux this needs Xvfb (`xvfb-run`) and the installed Playwright Chromium.
On a graphical desktop omit `xvfb-run -a`. The native fixture owns one disposable
headed Chromium/profile, connects to its loopback CDP endpoint without Playwright
focus-emulation defaults, and cleans up on success or failure. It explicitly
uses SwiftShader software WebGL. The `noDefaults` CDP option was verified with the
lockfile-installed Playwright 1.64.1; its empty-page native hidden/visible
prerequisite fails closed if browser behavior changes.

`*.native.ts` deliberately runs through its dedicated Chromium configuration,
not the ordinary page fixture or other browser projects. It is not skipped: run
**both** commands for the targeted world gates. The ordinary Playwright fixture
keeps background documents visible through session-scoped focus emulation and
cannot certify native hidden-tab cleanup.

The native case preserves the original 5-second assertions. It first proves
browser-native hidden/visible on an empty page, then exercises the real world
with normal motion, one elder resident, background RAF quiescence, foreground
resume and keyboard exit/canvas cleanup. No visibility getters, synthetic events,
clocks or artwork are replaced. Test runtime is not a performance benchmark.

Passing these commands does not establish full Home/Canopy regression coverage,
WebKit support, all resident tiers, physical-device comfort or release approval.
