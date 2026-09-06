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
- The balance test used to assert tier 7 needed _more_ than 10 taps a second: it
  ratified the bug. It now asserts what a nine-year-old can do.

## Duel curve widened, and it now measures the player

Ashura's note that "kids nowadays are fast" turned out to be checkable: `#tapzone`
is a full-width pad bound to `touchstart`, so every finger that lands fires its
own event and two thumbs double the rate. The previous ceiling was a one-thumb
number applied to a two-thumb game.

- Tier 7 raised from 7.0 to 8.0 taps a second, tier 1 held at 3.5. Past tier 5
  one comfortable thumb is not enough, so the last camps are where you either buy
  the grip or work out you may use both hands -- the duel's only real strategy.
- The rules line now says "Two thumbs are allowed", from tier 4 up. The pad always
  took two; nothing ever said so, which made the hard camps look impossible
  instead of looking like a hint.
- The result screen reports your taps per second and flags a personal best, and
  `save.bestTaps` keeps the record. The next balance pass can be measured rather
  than argued about.
- "tosses you 3 fragment" now pluralises.

## Collecting an orb is now an event

Walking into an orb used to call `scene.remove()`. The thing you had hunted for
five minutes stopped existing between one frame and the next, which broke
CLAUDE.md's rule that nothing appears or disappears instantly -- in the most
repeated moment in the game.

- The orb now swells, flares brighter, lifts and shrinks away over 0.42s, with
  its glow shell expanding and thinning as it goes.
- Thirty sparks in the orb's own colour burst out, arc over and fade (`burst.js`).
- The camera takes a 9cm knock, gone in a third of a second -- deliberately too
  small to notice, because visible screen shake on a phone held close to a child's
  face makes them feel sick. Skipped entirely for `prefers-reduced-motion`.
- Costs zero draw calls when idle and allocates nothing after load: one
  pre-allocated `THREE.Points`, hidden when not in use. Still 147 draw calls.
- `updateOrbLights` no longer allocates: `filter().map().sort().slice()` built
  four arrays and seven objects every frame -- roughly 700 throwaway objects a
  second -- against CLAUDE.md's no-per-frame-allocation rule. Now an in-place
  insertion sort into two fixed arrays.

## A wish now stands in the valley

A wish was a string in `save.wishes` and nothing else: you gathered seven orbs,
summoned a dragon, typed what you wanted, and the world was exactly as before.
The only trace was a line of text inside a menu — the one place a nine-year-old
will never look again.

- Each kept wish raises a standing stone with a gold cap, on the spot where you
  picked its token up. It grows out of the ground over a second rather than
  appearing, per CLAUDE.md's art rule.
- Walk within 4.5m and it tells you what you wished for.
- They are solid: pushed into the shared obstacle list, so you cannot walk
  through one and the camera dodges them like any other scenery.
- They survive reloads and world re-rolls. Wishes saved before this existed are
  placed from a hash of their own text, so they land somewhere stable rather than
  in a heap at the origin.
- One `InstancedMesh`, so it is 2 draw calls (mesh plus shadow) whether you have
  one wish or forty, and 0 when you have none.

Three faults found by running it, none of which a test or a read would catch:

- `InstancedMesh.computeBoundingSphere()` throws on a geometry whose own bounding
  sphere is null. The game crashed on the FIRST wish of any save.
- `mergeGeometries` returns `null` rather than complaining when asked to mix
  indexed and non-indexed geometry, so an `OctahedronGeometry` cap produced a null
  geometry and a crash three calls away with nothing pointing back at the cause.
- `emissive` is a material property, not a vertex one, so lighting the cap lit the
  whole shaft: the stones read as ghostly white obelisks rather than rock.

### The budget gate now measures a played save

`npm run audit` opened an empty save, so it measured a world with no wish stones
in it. "Within budget" that only holds for a save nobody has played is a blind
spot, not an assurance. It now seeds five wishes first: **149 calls of 150.**

## Seeker levels — steps 1 and 2 of the design spec

`docs/GAME-DESIGN.md` sections 4 and 7. The game had no reason to play a second
valley. XP is the answer, and it is earned for playing at all rather than playing
well: a child who loses every duel still climbs.

- **XP** from orbs (10), duels (10 + 5×tier won, 5 lost), completing a valley
  (150) and perfect order (100 — the first time that rule has been worth anything
  but a cosmetic label).
- **30 levels**, curve `60 + 30 × level`, about 35 valleys to the cap. Six ranks
  from Wanderer to Dragonfriend, with a HUD chip showing rank, level and the way
  to the next one.
- **Equipment slots finally do something.** `CONFIG.loadout.slots` was `0` —
  meaning no limit — for the life of the game, so a complete working system
  granted nothing. Slots now come from your rank: 1 at level 1, 5 by level 25.
- **A returning save is never punished.** Past play converts to XP once
  (wins, cycles and items), with a floor of level 5 for anyone who has played at
  all. Nothing is ever taken off: a player over the cap keeps everything they
  chose and simply cannot add more until they are under it.
- 0 draw calls. Still 149 of 150 — this is all save fields, rules and HUD.

Two things the tests caught, and one the browser did:

- Wiring slots through `progress.js` made `loadout.js` import the renderer, so a
  module that had always been testable stopped loading in node. The migration
  moved to `save.js` beside the `worn` migration it mirrors, and `loadout.js` now
  reads the level from pure arithmetic in `rules.js`.
- The old loadout tests asserted "slots are unlimited by default" — they encoded
  the inert system rather than a rule. Rewritten around rank.
- The rank chip was laid straight on top of the fragment pouch. The whole left
  column is restacked.

## A ladder and titles, the Rocket League way

Three things Rocket League keeps apart, which this game had conflated into one:
the **level** says how much you have played, the **ladder** says how well, and
**titles** record specific things you once did.

- **The ladder tiers are the seven orbs in rainbow order** — Ember, Amber,
  Sunlit, Verdant, Tidewater, Indigo, Violet — each in three divisions, with
  **Keeper's Own** above them and no divisions, the way Supersonic Legend has
  none. Climbing it is literally walking the rainbow.
- Rating comes from a **valley score**: 300 base, 20 an orb, 400 for perfect
  order, 60 a duel won, −40 a duel lost, and a point per second under a fifteen
  minute par. **Going over par costs nothing** — a child who wanders must never
  watch a number fall for enjoying themselves.
- **It never goes down.** Rating is your best run, not an average. A deliberate
  departure from Rocket League: demotion is half its tension, and for a
  nine-year-old that sting is not worth it. One config line to reverse.
- **Fifteen titles**, each naming a specific act rather than a grind threshold,
  including The Unhurried for taking more than twenty-five minutes — because a
  game that only rewards speed tells a child there is a wrong way to enjoy it.
  Hints for unearned titles are always visible.
- Both appear on the run card, with the promotion animated once and skipped
  under `prefers-reduced-motion`.

Four faults caught by looking at it:

- Ember spanned 700 rating against 250 for every tier above, so a beginner's
  divisions were the **slowest** to climb. Bands evened.
- The card auto-wore the _first_ title earned, handing someone "First Light" in
  the same breath as "Walked the Rainbow". It now wears the best of the batch.
- Onward fell below the fold again once the card grew.
- The sticky-footer fix for that was worse: it floated the button over the title
  chips behind a cream halo. The card is now a proper column — heading, scrolling
  body, fixed footer — so the only way out can never be hidden or on top of
  anything.

## The monkey gets a skeleton

The game had no animation. Arms and legs were swung by writing `Math.sin` into
their rotations every frame — a metronome: both arms on one sine wave, both legs
on its inverse, the same swing at every speed, and nothing at all for jumping,
landing, crouching or standing still.

He now hangs off seven bones driven by real animation clips, and **he is the same
monkey**: same geometry, same colours, same heights. Hood, headband, scarf tail,
ears, muzzle, sash and tail all kept.

- `seeker.glb` (Kenney Mini Characters, CC0) is loaded for its **skeleton shape
  and its 32 clips only** — its meshes are discarded. Swapping the monkey for a
  generic blocky human would have lost more character than animation gained.
- **The bones are ours, not theirs.** Kenney's figure has hips at 51% of head
  height; the monkey's sit at 28%. Parenting him to their skeleton would have
  quietly re-proportioned him into somebody else. We build seven bones at his
  measurements and give them Kenney's names — a clip that says "rotate the left
  arm" works on an arm of any length.
- Translation tracks are dropped for the same reason: they are in Kenney's
  centimetres. Every rotation is kept.
- `idle`, `walk`, `sprint`, `jump`, `fall` and `crouch` are wired to what the
  player is actually doing. Boots now visibly matter — the sprint clip is the
  first time buying them changed anything on screen.
- **141 draw calls, down from 149.** The tail was six spheres and six calls; it
  is now one `InstancedMesh` with the ripple intact.

Retargeting faults, both found by looking:

- The idle clip left him standing with his arms splayed like a scarecrow. Kenney's
  shoulders assume short stubby arms; the monkey's are twice as long relative to
  his body, so the same angle swings much wider. Limb rotations are now damped.
- Damping hard enough to fix that flattened the walk — he strode along with his
  arms hanging dead. Damping is now per clip: standing damped hard, moving barely
  at all.

## The villagers get the same skeleton

All seven now hang off the same seven bones as the monkey and play the same
clips, downloaded and retargeted **once** and shared by eight characters.

- **No extra draw calls at all — still 141.** Their static parts were already one
  merged mesh; it now hangs off the torso bone rather than the group, offset back
  down by the bone's own height so not one vertex moved. Their arms and legs were
  already groups at the shoulder and hip, which is exactly where the bones are.
- Deliberately _not_ split into head and torso pieces the way the monkey is. That
  would double seven villagers' draw calls to buy a head that turns on its own —
  not worth it for someone you mostly see walking past.
- `animateLimbs` was four lines of `Math.sin` per villager: the same metronome
  the monkey had, run seven more times. It is now one line stating what they are
  doing.
- Villagers standing still now play `idle` instead of freezing mid-stride.

A measurement correction: an earlier note here said the walk left arms "hanging
dead". That was wrong — it came from reading `rotation.x`, and the swing is on a
combined axis. Measured properly as quaternion spread it is **77° of arm and 92°
of leg**. The per-clip damping stays, because idle genuinely did need it and walk
genuinely did not.

## Content moves out of the code

Adding a hat to the shop used to mean editing JavaScript. It now means adding a
line to `content/items.json`.

- `content/items.json` and `content/titles.json` hold the shop and the fifteen
  achievements. `src/content.js` loads and **validates** both.
- **The validation is the point.** Moving data into JSON without checking it just
  moves the mistakes somewhere quieter: a title whose condition named a
  misspelt field would never fire, and would look exactly like one nobody had
  earned yet. A bad row now throws at startup with the id and the reason.
- Titles carry a tiny condition language — `[field, operator, value]`, all of
  which must hold. Small enough that a wrong operator or unknown field is caught
  on load; expressive enough for every achievement we have.
- **Colours in content files are palette names, never hex.** `"color": "boots"`
  resolves through `palette.js`; an unknown name is an error. A content file
  carrying its own `#ff0000` would have quietly ended CLAUDE.md's art rule the
  first time anyone was in a hurry.
- Seven new tests cover exactly this, including that a condition naming a
  non-existent field refuses to load and says which title is wrong.

This is the half of the tooling plan that is portable: a JSON list of items is as
readable to Roblox's Luau, or to PlayCanvas, as it is to us.
