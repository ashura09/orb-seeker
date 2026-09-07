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

## The seven move into a content file

`content/villagers.json` now holds who each villager is, what they look like and
everything they say — one row each, name and build and headwear and voice
together.

- They were split across `villagers.js` and `voice.js`, with a comment warning
  that the `short` name had to be kept in step across **three** files. One `id`
  now fetches their coat, hat and skin from the palette, and their lines sit
  beside the face they belong to, so the warning is unnecessary rather than
  merely repeated.
- `villagers.js` shrank to a declaration of what `wandererBody.js` can actually
  build — the headwear and props — handed to the loader. A villager asking for a
  hat nothing can make is now an error at startup instead of somebody walking
  around bare-headed with nothing said about it.
- The writing brief (they are former seekers who stopped at the furthest orb they
  reached, so their difficulty IS their story) moved into the content file, beside
  the writing. What stayed in `voice.js` is the writing with logic in it: the
  Keeper's greeting depends on how many valleys you have finished, and a wish is
  phrased by how long ago you made it. Those are functions, not lists.
- Fixed a stale line: the fallback duel voice still promised **"Ten seconds"**,
  months after the duel became four. Same fault as the rules line, in the one
  place nobody thinks to look.

### A test that could not fail

The new "no duel duration in dialogue" test was worthless when written: the `\b`
word boundaries in its regex had been mangled into literal backspace characters,
so the pattern was `/\x08(ten|four|…)\x08/i` and matched nothing. It passed, and
would have passed forever.

Rewritten, it immediately failed — first on Marla's "Four." and Sable's "Six.",
which are **orb numbers and good writing**, then on Nell's "the second is mine",
which is also an orb. It now matches only a number followed by "seconds", and I
checked it both ways: it catches "Ten seconds" and allows all four of those.

## The first sixty seconds

The strongest single predictor in everything researched about what succeeds is
**time to first action**. Orb Seeker opened with a nine-line wall of text about
orbs, wanderers, fragments, the Keeper and wishes — and then put the nearest thing
to do 48 metres away.

The minute now runs: **one line**, an orb already in sight, and a duel you are
meant to win.

- The start card says _"Something is glowing over the rise."_ and nothing else.
- **Orb one spawns 13 metres away**, on screen. It has to be orb _one_, not
  merely the nearest orb: the order rule rewards 1-to-7, so dropping a stranger's
  number at a newcomer's feet would have them break it in the first fifteen
  seconds without ever being told there was an order.
- Collecting it explains what an orb is — **after** they have picked one up.
  A nine-year-old will not read a paragraph about a mechanic they have not met.
- Bram then walks in from 16 metres for the gentlest duel in the game. He is
  walked in rather than dropped beside you, so the first duel is something you
  see coming.
- All of it gated on `save.taught`. A returning player gets _"The valley has
  shifted. The seven are scattered again."_ and a normal 41-metre walk — a free
  orb at the door is not a welcome once you know the game.
- Saves made before this existed are marked taught if they have any history, so
  nobody is handed a tutorial on their fiftieth valley.

Verified by playing it: one line, orb at 13m on screen, collect, explanation,
Bram arrives at 2.2m, tier-1 duel with his own line. Then reloaded and confirmed
the returning-player path. Four new tests cover the placement.

## Daily quests

Three a day — one easy, one medium, one hard — on a twenty-four hour reset, worth
40, 90 and 200 XP. The reason to open it tomorrow, and it costs no geometry.

- **Today's three come from hashing the date.** There is no server and never will
  be for this, so the same day has to produce the same three on any device with
  nothing stored and nothing to sync. It also means a child cannot reroll a hard
  quest by refreshing, which they absolutely would.
- Counters reset with the day. Yesterday's half-finished walk does not carry
  over, because a quest you are already most of the way through is not a reason
  to come back.
- `bestCampBeaten` takes the maximum rather than a sum: beating orb seven's camp
  once is the achievement, not beating orb one's seven times.
- Shown inside the satchel rather than behind a button of their own — screen space
  on a phone is the scarcest thing this game has. A finished quest is struck
  through and reads "done", not "3/3": a finished thing should stop looking like
  a sum to check.
- **Errands I, II and III** at 10, 50 and 100 lifetime completions, added as
  ordinary titles rather than a second system.
- `content/quests.json` is the pool. A quest naming a counter nothing keeps is
  refused at startup — it would otherwise sit at zero forever and look merely
  difficult rather than broken.

The validator earned its keep immediately: adding the Errands badges made
`titles.json` name a field the test's copy of the field list did not have, and
the whole suite refused to load. The real fault was the duplication, so the list
now has one home and the test imports it.

## Send someone your valley

The start card now takes a code. _"Someone sent me a valley"_ opens a box, you
type `VALE-BUCHJ3` — lowercase and without the prefix both work — and you are
standing in the identical valley.

- Entering a code reloads with `?valley=CODE` rather than rebuilding in place. A
  reload is the one certain way that nothing survives from the valley before it,
  and it makes the address bar itself shareable.
- The score card keeps **your best time per seed**, so a shared valley is
  something to race. It says "first time in this valley", "beat your 7:41" or
  "your best here 6:12", and tells a visitor to send their time back.
- No server, no accounts, no chat. It satisfies every child-safety rule in
  `CLAUDE.md` by construction rather than by policing, and it works over a text
  message.

### The feature shipped broken and testing caught it

Terrain was seeded from the world seed. **Orb placement was not** — it used
`Math.random` unless running on the bench. So two children entering the same code
got the same hills and then hunted orbs in completely different places, which
makes racing a shared valley pointless. The deterministic part was the scenery;
the part you actually look for was random.

Orbs and villagers are now seeded from the world seed always, not just on the
bench. Verified by loading the same code twice: all seven orb positions and
Bram's camp match to the decimal. Three tests now hold that invariant, because
**a seed names a whole valley or it names nothing worth sending.**

ESLint caught a second one on the way: the seed was chosen with a `??` chain, and
`Number()` returns `NaN` rather than null for nonsense — so `?seed=banana` would
have been accepted and produced a puzzling blank world.

## The Turning

The valley regenerates after every ceremony. It always did, and it always granted
nothing — the world you had learned simply went. Naming it **the Turning** and
letting you choose what the next one becomes turns the game's largest subtraction
into its reason to keep going, and cost almost nothing to build because the
re-roll was already there.

You keep everything: level, items, titles, wish stones, best times. The only
thing that changes is the valley, which was going to change anyway.

- Five modifiers, opening as you climb: **An ordinary valley** (level 1), **Thin
  Woods** (5), **Night Valley** (10), **Rich Vein** (15) and **Fierce Camps**
  (20). The card names the next one and the level it opens at, so there is always
  something still to come.
- **Fierce Camps pays more as well as demanding more.** Difficulty without reward
  is a punishment, and this is something the player chose.
- Turnings show as marks rather than a number — a record, not a score — and
  collapse to `·×N` past a dozen so a devoted player is not given a wall of dots.
- `content/modifiers.json` carries each one's name, hint and unlock level; the
  effects are code, because an effect is logic. A modifier with no effect written
  for it is refused at startup rather than being offered, chosen, and then
  changing nothing.
- Verified rather than assumed: Thin Woods took a valley from 633 obstacles to 366.

One fault found by looking: the Turning's own hint read _"Send it to a friend and
they walk the same valley"_. `document.querySelector('#score .seedhint')` takes
the FIRST hint in the card, and adding the Turning above the seed box made that
the wrong one. Targeted by id now.

## Crawl is cut. The whistle earned its button back.

The two mechanics that had no answer to "what is this for" are settled rather
than left hanging.

**Crawling is gone.** No situation in the game ever required it: nothing hunts
you, and slipping quietly past a camp was never worth being slower for. Inventing
a stealth system to justify a button is the exact mistake `docs/GAME-DESIGN.md`
exists to prevent, so the mechanic goes rather than the design bending around it.
Removed from the config, the state, the movement, the villagers' hearing and the
jump rule. The crouch animation stays in the file — one line away if a reason
ever turns up.

**The whistle has a button again, because it now does something.** It used to
only widen how far you could be heard, which is a mechanic you cannot see
working. It now calls the nearest villager over for a duel and names them —
_"You whistle. Sable looks up."_ An ambush you endure becomes a fight you choose,
and it makes "win three duels" playable instead of a matter of waiting around.

It greys out while cooling off, because a control that does nothing when pressed
teaches people to stop pressing it. Verified: whistled at 37m, the Pilgrim walked
to 2.2m, button re-enabled.

That is every step of the build order that costs no geometry. Still 141 draw
calls, and none of the eight steps spent one.

## Sound, synthesised

The game had none. Every beat built this week happened in silence: the collection
burst, the level, the promotion, the won duel.

**There are no audio files.** Everything is synthesised at runtime with the Web
Audio API. That is a choice, not a shortcut: nothing to download so the game stays
instant on a phone, no licence to track, and every sound is a handful of numbers
tunable from `config.js` like the rest of the game. It cannot make a realistic
noise, and does not need to — this is a valley of coloured boxes.

- **The orbs play a scale.** Orb one is C and orb seven is B, so gathering them in
  order plays a rising C major scale — measured at 262, 294, 330, 349, 392, 440,
  494 Hz. The reward for keeping the order becomes something you can _hear_
  before anyone explains it.
- Duel taps are pitched by how full your bar is, so a duel you are winning sounds
  like a rising run.
- **Losing sounds like a shrug, not a buzzer.** A nine-year-old loses a lot and
  must not be punished for it in the ears.
- Level, rank, quest, title, whistle and jump all have their own shape.
- Every note has an attack and a decay. A tone that starts instantly clicks.
- Master volume is deliberately modest: a game that is loud by default is a game
  that gets muted permanently. Mute lives in the satchel and persists.

Verified by instrumenting the audio graph rather than by listening: context
running after the first gesture, correct note counts per event, the seven orb
frequencies forming a major scale, and zero oscillators created while muted.
