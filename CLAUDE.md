# CLAUDE.md — Orb Seeker project rules

You are working on Orb Seeker, a 3D browser game (Three.js + Vite) played mostly on phones,
by a beginner developer and his 9-year-old daughter's friend group. These rules apply to every
session in this repo, forever. When a request conflicts with them, say so before coding.

## Who this is for

- Primary players: kids around 9–12 on phones, plus the developer.
- The developer is learning: explain non-obvious decisions in one or two plain sentences as you
  work, and prefer readable code over clever code.

## Non-negotiable product rules (child safety)

- Multiplayer is private-room-code only. Never add public lobbies, stranger matchmaking,
  or discovery of other people's rooms.
- No free-text input visible to other players: communication is preset phrases and emotes only.
  Player names come from a fixed list or first-name-only validation.
- No voice or video features.
- Collect no personal data: no accounts, emails, birthdays, or analytics that identify a person.
- No purchases, ads, or spending pressure aimed at players. Fragments are earnable only.
- Room codes expire when a room empties.
- If a requested feature would break any of these, stop and flag it instead of building it.

## Engineering rules

- Small modules with one job each, in src/ (world, player, input, orbs, finder, wanderers,
  duel, shop, inventory, keeper, save, ui, net). No file over ~300 lines; split before it grows.
- Shared state lives in src/state.js as a single exported object. No new globals.
- Every change ends in a working game: run the dev server and confirm no console errors before
  declaring done. If a change is risky, make it behind a flag in src/config.js.
- Commits: small, one topic each, imperative message ("Add shoreline foam"), and update
  CHANGELOG.md (one line per user-visible change).
- When index.html or built assets change in a deploy, bump the cache version in sw.js.
- Keep dependencies few. Justify each new package in one sentence in the commit message.
- Formatting/linting: Prettier + ESLint with the default recommended configs; fix warnings
  rather than silencing them.

## Performance budget (this is a phone game)

- Target: smooth on a mid-range Android from ~4 years ago; assume it, don't assume an iPhone Pro.
- Budgets: draw calls under ~150 (use InstancedMesh for repeated scenery), triangles under ~300k
  in view, no per-frame allocations in the game loop (reuse vectors), pixel ratio capped at 2.
- Post-processing must be toggleable: a "low graphics" setting that disables composer passes
  and shadows. Auto-drop to low if average FPS < 45 for 5 seconds.
- Pause the render loop when the tab is hidden.

## Art rules

- All colors come from the palette in src/palette.js. Adding a color means editing that file,
  nothing inline.
- Interactive things are saturated, lit, and moving; scenery is muted and calm.
- Nothing appears or disappears instantly: scale/fade with easing.
- Tone mapping ACESFilmic + sRGB output stays on; don't remove it to "fix" colors — adjust
  the palette instead.

## Testing & verification

- Keep tests for pure logic only (save/load, orb placement spacing, duel math) in *.test.js
  with Vitest; don't attempt to unit-test rendering.
- Maintain docs/TESTPLAN.md: a 2-minute manual checklist (move, collect, duel, buy, ceremony,
  reload-and-save-persists, install-to-home-screen). Run it before every deploy and say you did.
- Test multiplayer with two browser windows before calling any net feature done.

## Communication

- When a task is ambiguous, propose the smallest version, build it, and list the possible
  extensions at the end instead of building them all.
- End each work session by summarizing: what changed, what to test on the phone, and the single
  next most valuable task.
