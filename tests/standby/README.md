# StandBy browser verification

Use the worktree root as the working directory. These tests use isolated local
fixtures and actual bundled art; they do not access the production database.

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
