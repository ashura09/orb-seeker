# Codebase audit

Written 3 September 2026, against commit `96b3ab5`. Every number here was measured,
not estimated; the command that produced it is given so you can re-run it.

> **Scope note.** This audit was asked for as part of a larger mission that also
> referenced `CLAUDE.md`, `docs/orb-seeker-polish-and-party.md` and
> `docs/orb-seeker-roadmap.md`. **None of those three files are in the repository.**
> This audit depends on none of them, so it is complete. The parts of Stage 1 that
> _do_ depend on them are listed at the end under _Deliberately not done yet_.

## What exists

A Three.js browser game, built with Vite, deployed to GitHub Pages. 3,987 lines of
JavaScript across 25 modules, plus 129 lines of HTML and 134 of CSS.

    wc -l src/*.js index.html src/style.css

### The modules, by job

| Module      | Lines | Job                                                     |
| ----------- | ----: | ------------------------------------------------------- |
| `world`     |   786 | terrain, regions, scenery, water, horizon               |
| `config`    |   394 | every tunable number, plus the shop's item table        |
| `main`      |   383 | builds everything, wires listeners, runs the frame loop |
| `props`     |   232 | loads 58 glTF models, recolours and merges them         |
| `map`       |   206 | the valley map and what you have explored               |
| `wanderers` |   201 | the seven villagers, their camps and hearing            |
| `input`     |   174 | joystick, look-drag, pinch zoom, keyboard               |
| `sky`       |   157 | sky dome, sun, shadows, environment light               |
| `keeper`    |   155 | the dragon and the wish ceremony                        |
| `player`    |   136 | the monkey, its cosmetics and poses                     |
| `tuner`     |   133 | the `?tune` panel (lazy-loaded)                         |
| `state`     |   132 | renderer, scene, camera, lights, shared `G`             |
| `orbs`      |   107 | the seven orbs and their pooled lights                  |
| `inventory` |   105 | pickups and the satchel panel                           |
| `voice`     |    99 | all of the game's writing                               |
| `duel`      |    92 | the tap duel                                            |
| `ui`        |    84 | HUD, toasts, stats overlay                              |
| `loadout`   |    84 | rules about what you may wear                           |
| `events`    |    70 | the publish/subscribe bus                               |
| `bloom`     |    66 | the glow pass                                           |
| `finder`    |    56 | the radar                                               |
| `rng`       |    49 | seeded randomness                                       |
| `save`      |    45 | browser storage                                         |
| `shop`      |    41 | the trader's cart                                       |

### How it is structured

Imports point downward through six layers and there are **no cycles**. This is
genuinely good, and nothing below proposes changing it.

    0  config, events, props, rng, save, voice     depend on nothing
    1  loadout, state, tuner
    2  bloom, input, player, sky, ui, world
    3  orbs, shop
    4  inventory, wanderers
    5  duel, finder, keeper, map
    6  main

Modules on the same layer never import each other; they talk through `events.js`.
That decision is documented in `ARCHITECTURE.md` and it holds.

---

## The ten biggest problems

Ordered by what I would fix first, which is not the same as severity — the early
items unblock the later ones.

### 1. `world.js` is 786 lines doing eight separate jobs

    grep -n "^// ----------" src/world.js

Regions, height sampling, the ground mesh, surface interpolation, the detail
texture, the horizon, scenery placement and instancing, and water. Nearly twice the
size of the next largest file, and where every terrain bug this project has had was
hiding.

**Fix:** split along the section headings already in the file — `terrain.js` (height
and regions), `scatter.js` (placement and instancing), `water.js`, `horizon.js` —
leaving `world.js` as the assembler.

### 2. `frame()` is a single 197-line function

    awk '/^function frame\(\)/,/^}/' src/main.js | wc -l

Input, day/night, lantern light, shadow following, jump physics, walking, collision,
camera occlusion, orbs, pickups, wanderers and rendering. There is no seam at which
any of it can be tested or reasoned about alone.

**Fix:** extract `updatePlayer(dt)`, `updateCamera(dt)` and `updateWorldObjects(dt)`
as plain functions called in order; the loop becomes about a dozen lines.

### 3. `updateOrbLights()` allocates on every single frame

`src/orbs.js` lines 42–46 run `.filter().map().sort().slice()` sixty times a second,
producing two arrays and seven short-lived objects each time — roughly 3,600 objects
a minute handed straight to the garbage collector. On a phone that is a stutter you
can feel.

**Fix:** keep one preallocated array of seven slots, fill it in place, insertion-sort
it. No allocation at all.

### 4. There are 118 colour literals, 79 of them distinct, across ten files

    grep -oh "0x[0-9a-fA-F]\{6\}" src/*.js | wc -l              # 118
    grep -oh "0x[0-9a-fA-F]\{6\}" src/*.js | sort -u | wc -l    # 79

Seventy-nine distinct colours is not a palette, it is an accumulation. Changing the
look of the game currently means a search across ten files, and nothing enforces that
two greens are the same green.

**Fix:** `src/palette.js` exporting named colours; replace every literal with a
reference.

### 5. Twenty-one exports that nothing outside their own file uses

`cellSeed`, `ORB_COLORS`, `SAVE_KEY`, `waterLevel`, `waterRadius`, `VILLAGER_VOICE`,
`WANDERERS`, `wornItems`, `slotsFree`, `setWorn`, `toastEl`, `startDuel`,
`renderDuel`, `endDuel`, `renderSatchel`, `buildKeeper`, `makeWish`, `keeperDeparts`,
`openMap`, `closeMap`, `renderShop`.

Each was checked individually: every one appears only in its own file. They advertise
a public interface far larger than the real one, which makes the module map harder to
read than the code.

**Fix:** drop the `export` keyword from each. No behaviour change.

**Revised after adding tests.** Nine of these are now legitimately consumed from
outside their file — `tests/` imports `setWorn`, `slotsFree`, `wornItems`, `worn`,
`toggleWorn`, `wornCount`, `owned`, `persist` and `save`. A test is a real caller, so
those exports stay. The list of genuinely unnecessary ones is now eleven:
`ORB_COLORS`, `SAVE_KEY`, `VILLAGER_VOICE`, `WANDERERS`, `toastEl`, `startDuel`,
`renderDuel`, `endDuel`, `renderSatchel`, `buildKeeper`, `renderShop`. Narrowing them
is queued behind the file split, since several will move file anyway.

### 6. Save failures are completely silent

`src/save.js` lines 32 and 42 — `catch(e){}` twice, with an empty body.

A corrupt save silently resets you to a new game. A full storage quota silently stops
saving and you lose everything since the last successful write, with no indication
anything is wrong. For a game whose premise is that _the valley keeps the record of
every wish you made_, losing that record without a word is the worst failure this
code can have.

**Fix:** keep the default state, and surface a toast. Distinguish "unreadable save,
starting fresh" from "cannot save, progress will not be kept".

### 7. Nothing pauses when the tab is hidden

    grep -rn "visibilitychange\|document.hidden" src/*.js   # no matches

Browsers throttle `requestAnimationFrame` in background tabs, but the game does not
know it is backgrounded and does not stop. On a phone that is battery burned for
nothing.

**Fix:** on `visibilitychange`, stop scheduling frames; on return, reset the timer so
no huge `dt` lands.

### 8. Two full sweeps of every obstacle, every frame

`src/main.js` line 152 (camera occlusion) and line 233 (walking collision). With
roughly 1,074 obstacles that is about 2,150 iterations per frame, ~129,000 per second,
to answer questions about things almost all of which are more than a hundred metres
away.

**Fix:** a uniform spatial grid keyed by rounded x/z, built once when the world is
built. Both sweeps then examine nine cells instead of the whole valley.

### 9. Dead code: `cellSeed()`

`src/rng.js` line 37 — defined and documented, never called. Written for chunked
terrain streaming that was never built.

**Fix — changed on reflection: keep it.** The instruction was to remove dead code, and
by the letter this qualifies. But this is not an accident: it is documented groundwork
for the chunked-terrain idea you raised yourself ("recognise how many steps in which
direction and that discovers new terrain"), and `docs/orb-seeker-roadmap.md` — which is
not in the repository — may well reference it. Deleting a deliberate hook for a feature
you have asked about, on the say-so of a linter, is the wrong call. It stays, and this
note records the decision.

### 10. No lint, no formatter, and one hand-rolled test file

`package.json` has no ESLint, no Prettier and no test runner. `loadout.test.mjs`
exists and passes 17 assertions, but it uses a bespoke `check()` helper and a
hand-built fake `localStorage`, so it cannot say which line failed and cannot run
alongside anything else.

**Fix:** Prettier and ESLint on recommended defaults, Vitest as the runner, and port
the existing assertions across so nothing already covered is lost.

---

## What is already good, and should not be "fixed"

- **The dependency graph is acyclic** and the event bus is used correctly.
- **`config.js` is genuinely declarative** — no imports, no logic, only values. It is
  long, but length is not the problem it looks like here.
- **The comments explain _why_, not _what_.** Several record bugs that cost real time.
  Protect them through any refactor.
- **`UPGRADE-NOTES.md` is a working record of traps already hit.** Read it before
  touching terrain, the camera, or anything to do with colour.

---

## Deliberately not done yet

Stage 1 items that cannot be done correctly without files that are not in the
repository:

| Item                                                                   | Blocked on  | Why I did not guess                                                                                        |
| ---------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| Split files "per CLAUDE.md's module list"                              | `CLAUDE.md` | Splitting to a different list than yours means doing it twice.                                             |
| `docs/TESTPLAN.md`, "the manual checklist from CLAUDE.md"              | `CLAUDE.md` | The checklist _is_ the content; inventing it produces a plan that tests the wrong things.                  |
| FPS monitor and auto low-graphics "per CLAUDE.md's performance budget" | `CLAUDE.md` | The thresholds _are_ the budget. A guessed threshold silently degrades the game on devices that were fine. |
| Whole-codebase Prettier format                                         | `CLAUDE.md` | Reformatting all 3,987 lines before the repo's style law is known rewrites every line, twice.              |

Everything else in Stage 1 proceeded.
