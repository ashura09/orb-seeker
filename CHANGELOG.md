# Changelog

Notable changes, newest first. Dates are the day the work landed.

## Unreleased

### Audit fixes — six parallel audits, eight real bugs

**Fixed — the game was broken on a phone**

- **The map could not be opened by tapping.** `#hud` is `pointer-events: none` and
  `#finder` never opted back in, so the radar was not hit-testable. Keyboard `M`
  worked, which is why it was never noticed.
- **The polish was switched off for most players.** The frame-rate watchdog sampled
  during loading — model fetches, shader compilation, terrain generation — decided
  the device was slow, and persisted that verdict forever. Now waits 12s.
- **Quick app-switching spawned duplicate render loops.** `visibilitychange` stopped
  scheduling frames but never cancelled the one already queued.

**Fixed — child safety**

- **Wishes can now be deleted**, one at a time or all at once. A child typed
  something true into a box that kept it forever, replayed it unprompted at the
  start of every gathering, and showed it to whoever opened the app next on a
  shared device.
- Wish text is rendered with `textContent` instead of hand-escaped `innerHTML`.

**Fixed — correctness**

- Wish tokens could spawn outside the walkable world, stranding the ceremony so the
  valley never re-scattered and the wish was lost.
- A structurally-wrong save (`{"items":null}`) crashed every module at import and
  left a blank page. Now validated field by field. 7 new tests.
- Instanced meshes were removed from the scene but never disposed, leaking GPU
  buffers on every re-scattered valley.
- `buildInstances` was called twice, building the whole world's meshes twice over.
- Shadows were never soft: `PCFSoftShadowMap` is deprecated in r185 and silently
  becomes `PCFShadowMap`.

### Tooling — the budget is now a gate

**Added**

- `npm run audit` — starts the game headless on `?bench` and fails if draw calls
  or triangles are over CLAUDE.md's budget, or if anything logged a console error.
- Lighthouse run against the live site: performance 85, accessibility 91, best
  practices 100, SEO 100.

**Fixed**

- The fragments button showed a number but announced "Fragments and shop", so a
  screen reader said something different from what was on screen.
- Draw calls 165 to 147, inside budget: the player's ten static parts merge into
  one mesh, the same trick the villagers already use.

### Stage 2 — the polish pass

**Changed**

- The palette is eight colours plus the seven orbs. Everything else in the game
  is mixed from those, down from 79 distinct hexes.
- Each villager now wears a muted version of the orb they camp beside, so the
  seven of them are colour-coded to the fiction.
- Scenery and villagers are all muted below the orbs. The player keeps his
  original navy and red, which is louder than any orb -- deliberately, since he
  is the one thing always in frame.
- sRGB output stated explicitly rather than inherited from the library default.

### Stage 1 — audit and foundations (3 September 2026)

Groundwork only: no change to how the game looks or plays, except where noted.

**Added**

- `docs/AUDIT.md` — a measured audit of the codebase and the ten biggest problems,
  each with a fix plan and the command that found it.
- ESLint (recommended defaults) and Prettier, with `npm run lint` and `npm run format`.
- Vitest, with 28 tests across three files covering save round-trip and migration,
  orb placement, and the duel tier maths.
- `src/rules.js` — the game's arithmetic, with no three.js and no DOM, so it can be
  tested outside a browser. Holds `pickOrbSpots`, `duelLoot` and `tierRate`.
- Rendering now pauses while the browser tab is hidden, and resumes without lurching.

**Changed**

- Orb placement, duel loot and opponent pace moved out of `orbs.js`, `duel.js` and
  `wanderers.js` into `rules.js`. Behaviour is identical; the random draws happen in
  the same order as before.
- Save read and write failures are reported to the console instead of being silently
  swallowed. Telling the _player_ is still pending sign-off — see AUDIT item 6.

**Removed**

- The hand-rolled `loadout.test.mjs`; its 17 assertions are ported to
  `tests/loadout.test.js` with nothing lost.
- Unused imports (`hemi`, `sun` in `main.js`; `G` in `world.js`) and the unused
  `pillars` binding in `world.js`.

### Stage 1 complete — the remaining file splits

**Changed**

- `main.js` 535 lines into a loop plus `camera`, `motion` and `gathering`. The
  frame loop now reads as four calls.
- `wanderers.js` into `villagers.js` (who they are) and `wanderers.js` (their
  bodies and behaviour).
- `keeper.js` into `dragon.js` (the body) and `keeper.js` (the ceremony), and
  `wanderers.js` again into `wandererBody.js` (building) and behaviour.
- The trader's stock out of `config.js` into `items.js`.

Every split verified against a bench fingerprint: draw calls, triangles,
drawables, obstacle checksum and terrain samples unchanged throughout, plus a
dynamic walk-and-jump check on the `main.js` split.

**Deliberate exceptions to the ~300-line rule**, both documented in the files:
`config.js` at 427 (a flat table of numbers with no logic, and the `?tune` panel
walks it as one object) and `scatter.js` at 307 (arranging scenery and drawing it
in few calls is one job).

### Stage 1 continued — bench mode and the world.js split

**Added**

- `?bench` — a fixed scene for measuring: pinned seed, position, camera and time
  of day, input ignored, villagers frozen. Four runs give identical numbers, which
  plain `?stats` never did. Baseline: 166 draw calls, 302.0k triangles.

**Changed**

- `world.js` split into seven modules — regions, terrain, ground, horizon,
  scatter, water, and world as the assembler. Verified inert against a bench
  fingerprint: draw calls, triangles, drawables, obstacle count and checksum,
  place coordinates and terrain samples all identical.
- `ARCHITECTURE.md` brought up to date: 33 modules, zero cycles, real layering.

### Stage 1 continued — palette and character merging

**Added**

- `src/palette.js` — every colour in the game, in one place. Pure extraction; the
  scene is pixel-identical at the same seed.

**Changed**

- Project rules updated to match the service worker's actual behaviour; the manual
  cache-version bump was already obsolete.
- Villager meshes merged: 14–16 each down to 5, scene drawables 211 → 143. No
  visible change — verified a villager still carries six distinct vertex colours.

### Stage 1 continued — after the project rules arrived

**Added**

- `CLAUDE.md` and the two design docs.
- `src/graphics.js` — a low-graphics quality level, and a watchdog that drops to it
  after five seconds averaging under 45 fps. Turns off shadows and bloom and cuts
  scenery. Remembered, so a phone that struggled once starts low next time.
- `docs/TESTPLAN.md` — the two-minute manual checklist to run before every deploy.

**Changed**

- Scenery count 1900 to 1150, bringing triangles from 468.3k to 292.2k, inside the
  300k budget CLAUDE.md sets. Low graphics measures 80 draw calls and 106.5k.
- The whole codebase formatted with Prettier, in its own commit.

**Fixed**

- The stats overlay reported six-figure draw calls when the composer was bypassed:
  `renderer.info.autoReset` is off, and the bypass path skipped the manual reset.

**Known exception**

- Draw calls are ~184 at normal quality against a budget of 150. Cause measured:
  the player and seven villagers are built from a dozen-plus meshes each. The fix
  is merging their non-animated parts, which belongs with the polish pass.

**Not done, and why**

Still open in Stage 1, now unblocked but not yet done: `src/palette.js` and the
colour extraction, and splitting the three files still over the ~300-line rule
(`world.js` 782, `main.js` 400, `config.js` 394).

## Duel rebalance

The duel was unwinnable above tier 3 and told the player the wrong duration.

- Opponent difficulty per tier cut from 0.065 to 0.029, and the base from 0.16 to
  0.145. Tier 7 asked for 12.3 taps a second, which no nine-year-old has; it now
  asks 7.0, or 5.4 with the grip. All seven villagers are beatable, so the losing
  lines written for Tarrow, Sable and the Pilgrim can finally be heard.
- Duel length 10s to 4s, countdown 3s to 2s. The clock now decides tiers 1-3 on
  points, so `updateDuel`'s timeout branch is reachable for the first time.
- A tie at the buzzer goes to the player.
- The consolation payment for losing raised from 1 fragment to 3.
- The rules line no longer says "Ten seconds" -- it reads the number from the
  config, because hand-typed durations go quietly false.
- The balance test used to assert tier 7 needed *more* than 10 taps a second: it
  ratified the bug. It now asserts what a nine-year-old can do.
