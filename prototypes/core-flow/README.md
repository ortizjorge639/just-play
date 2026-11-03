# Core-flow prototype

**Question:** Does the selected dark-first palette and a reversible game-selection path feel clearer when carried from Discover into Now Playing? Compare three layout structures and the cover-art treatments before changing production UI.

Run with `pnpm prototype:core-flow` and open `http://127.0.0.1:4392`. Use the prototype controls below the header or left/right arrow keys to compare Feature, Queue, and Split focus. The Cover selector compares the original art, a slow color wash, an ordered-dither study, and the selected combination of wash plus dither.

Selecting a game moves to a simulated Ready state. **Change game** or Escape returns to Discover and clears that selection; it does not create a session or record XP. Start Playing changes the simulated state to Playing. Pause and Resume are available there; ending a play session is intentionally not modeled. Everything is in memory.

This is a throwaway visual/interaction study, not production implementation. It uses existing local game artwork and example recommendations. It does not show Home, Progress, Canopy, authentication, or backend behavior. Layout C (Split focus) and the combined wash-plus-dither cover are the selected directions for further exploration; the other layouts and individual treatments remain comparison experiments.

**Decisions reflected:** ink/charcoal, warm ivory, restrained amber; one compact consistent header; icon-plus-label actions; remove “Your game is waiting for you” and “Taking a breath”; completely undo a lock-in before play.

**Learning:** the user selected Split Focus (Layout C) and the combined color-wash plus dither treatment for the production redesign. The prototype remains a non-production study.
