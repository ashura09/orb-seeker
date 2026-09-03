# Architecture

The short version, so the rules live next to the code. The full audit with diagrams is
in the project blueprint.

## The one rule

**Imports point downward. Nothing reaches up. Nothing imports sideways.**

```
app/        main.js: builds everything, wires listeners, runs the loop
ui/         DOM only. Never touches three.js.
world/      three.js scene objects. Never touches the DOM.
domain/     Rules and numbers. No three.js, no DOM. Runs without a browser.
platform/   renderer, loop, input, storage, events. Knows nothing about this game.
```

A layer may use anything beneath it. Two files on the _same_ layer never import each
other — they talk through the event bus.

## The test

Pick a file and ask: _could I delete the layer above it, and would this file still make
sense?_ If `orbs.js` breaks when you delete the dragon, the boundary is in the wrong place.

## Why the bus

**Status: done.** The dependency graph is acyclic as of 2 September 2026.

The audit found four import cycles:

```
duel <-> wanderers      inventory <-> keeper
inventory <-> shop      keeper <-> orbs
```

All four are the same mistake: a module reaching _into_ another to announce that something
happened. `orbs.js` counts to seven and calls the dragon itself, so it has to know the
dragon exists.

With a bus, `orbs` emits `"orbs:all-found"` and `keeper` subscribes. Neither imports the
other. Delete `keeper.js` and `orbs.js` still runs.

## Where things go when you add a feature

| You are adding                          | It belongs in |
| --------------------------------------- | ------------- |
| A number you will want to tune          | `config.js`   |
| A rule about what happens when          | `domain/`     |
| Something visible in the 3D scene       | `world/`      |
| A panel, button, or readout             | `ui/`         |
| Something with no game knowledge at all | `platform/`   |

If a change needs edits in three layers at once, that is usually a sign the feature is
really two features.

## Order of work

1. ~~Event bus — removes all four cycles, no behaviour change~~ **done**
2. ~~`config.js` — gather the scattered tuning numbers~~ **done**
3. Split `state.js` into renderer / materials / shared state
4. Separate rules from screens, one feature at a time (duel first — clearest seam)
5. Move files into folders — **last**, once imports already point the right way

Moving folders first just relocates a tangle.

## Owning is not wearing

These were one fact, and that is exactly why there was no way to take anything off:

```js
save.items[id] === 'owned'; // meant BOTH "you have it" AND "it is active"
```

Every effect asked `owned('boots')`, so owning the boots made you fast forever. They are
two facts now:

|                           | means        | changes when               |
| ------------------------- | ------------ | -------------------------- |
| `owned(id)` — `save.js`   | you have it  | you pick it up. Permanent. |
| `worn(id)` — `loadout.js` | it is on you | you choose, any time       |

**Effects ask `worn`. Listings ask `owned`.** The shop showing "already bought" and the
satchel showing what you have to choose from are listings. Everything else — speed, finder
range, duel taps, how far villagers hear you, and every cosmetic — asks `worn`.

`loadout.js` exists as a separate file from `save.js` because _remembering_ and _deciding_
change for different reasons. "You may only wear four things" is a game rule, not storage.
It announces changes on the bus rather than pushing them, so `player.js` redresses the
monkey without anything importing anything.

That split has a practical payoff: the rules run with no browser at all. `npm test` loads
`loadout.js` under a twelve-line fake `localStorage` and checks seventeen cases, including
what happens when the slot limit is lowered under a save that is already over it.

### Making it a decision

`CONFIG.loadout.slots` is `0`, meaning no limit — own eight, wear eight. Set it to `3` and
the shop stops being a checklist: boots _or_ lens, the bell that draws villagers to you _or_
the quiet of going without. The refusal path, the message and the slot counter are already
built and tested. The number is the whole switch.

## Balancing the game

Every number worth tuning lives in `src/config.js`, grouped by what it affects:
world, terrain, sky, shadows, bloom, fog, player, camera, orbs, wanderers, duel,
finder, ceremony, dayNight, loop. Item prices are the `ITEMS` table in the same file.

Nothing in that file imports anything or does anything — it is only values, so you can
change one, reload, and see the result without reading any other file.

What deliberately stays out: shapes, proportions and colours. Those are art, not
balance. Prop colours live in the `PALETTE` table in `props.js`; character and
creature proportions live beside the code that builds them.

### The live tuning panel

Add `?tune` to the URL and a slider appears for every value in `config.js`:

    http://localhost:5173/?tune
    https://ashura09.github.io/orb-seeker/?tune      (works on your phone)

Drag one and the game responds immediately. **Copy what I changed** gives a short diff
of only the values you moved, to edit into `config.js` by hand — which keeps the
comments there. Sliders marked with a circular arrow are read once at startup and need
a reload.

It is a dynamic import, so lil-gui is a separate 9 KB chunk that players who never use
`?tune` never download.

### Seeing the cost

Add `?stats` for frames per second (including the worst seen), draw calls and triangles.
Both flags can be combined.

## What each module is for

    config    every tunable number, plus the shop's ITEMS table
    voice     everything anyone says: villager lines, the Keeper's greetings
    events    the publish/subscribe bus that keeps the graph acyclic
    rng       seeded randomness, so a whole valley rebuilds from one number
    props     the glTF models: loaded, recoloured, scaled, merged for instancing
    save      load and save to browser storage -- remembers, never judges
    loadout   the rules about what you may wear, and what wearing means
    state     renderer, scene, camera, lights, and the shared G object
    palette   every colour in the game; nothing else may hold a hex literal
    rules     the game's arithmetic -- orb placement, duel maths. No three.js, no DOM
    graphics  the quality level, and the watchdog that lowers it for you
    regions   what kinds of place exist, and where they landed this gathering
    terrain   heightAt and surfaceHeightAt: the shape of the valley
    ground    the mesh you walk on -- geometry, colour and grain
    horizon   hills beyond the part you can reach
    scatter   where scenery goes, and the instancing that draws it
    water     the lake, and how far it can fill before it would drain
    world     the assembler: builds the valley and is its public face
    sky       the gradient dome, the sun, shadows, and the environment light
    bloom     the glow pass, behind CONFIG.bloom.enabled
    input     joystick, look-drag, keyboard; emits intent, decides nothing
    player    the monkey, its cosmetics and its crawl pose
    ui        HUD, toasts, the order chain, the stats overlay
    orbs      the seven orbs: placement, collection, their pooled lights
    shop      the trader's cart
    inventory pickups you walk over, and the Inventory panel
    wanderers the seven villagers, their camps and their hearing
    duel      the tap duel
    finder    the radar
    map       the valley map: what you have walked, and what is there
    keeper    the dragon and the wish ceremony
    tuner     the ?tune panel
    main      builds everything, wires listeners, runs the frame loop

## Current layering

The graph sorts itself, no folders required yet. **Zero cycles** across 33 modules:

```
0   events, palette, rng, save, voice     depend on nothing
1   config
2   loadout, props, regions, rules, state, tuner
3   bloom, input, player, sky, terrain, ui
4   graphics, ground, horizon, scatter, shop, water
5   world
6   inventory, orbs
7   keeper, map, wanderers
8   duel, finder
9   main
```

Nothing at a lower number imports anything at a higher one.

Two things worth knowing about this shape. `config` is no longer at the bottom: it
imports `palette`, because a colour in a config table is still a colour and the art
rule admits no exceptions. And `world` sits in the middle rather than near the bottom
— it is an assembler now, built on the six modules it replaced, and it re-exports
their public API so nothing above it had to change when the split happened.

**Re-check it after any restructure**, and read the import statements rather than the
file: an early version of this check counted the example imports written inside
`events.js` and `palette.js` comments, and reported a cycle from `palette` to itself.

```py
# only lines that are actually import statements
for line in open(f):
    t = line.strip()
    if t.startswith(('//', '*', '/*')): continue
    ...
```

If a cycle ever does appear, the fix is almost always an event rather than an import.
