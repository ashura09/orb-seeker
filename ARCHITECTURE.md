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

A layer may use anything beneath it. Two files on the *same* layer never import each
other — they talk through the event bus.

## The test

Pick a file and ask: *could I delete the layer above it, and would this file still make
sense?* If `orbs.js` breaks when you delete the dragon, the boundary is in the wrong place.

## Why the bus

**Status: done.** The dependency graph is acyclic as of 2 September 2026.

The audit found four import cycles:

```
duel <-> wanderers      inventory <-> keeper
inventory <-> shop      keeper <-> orbs
```

All four are the same mistake: a module reaching *into* another to announce that something
happened. `orbs.js` counts to seven and calls the dragon itself, so it has to know the
dragon exists.

With a bus, `orbs` emits `"orbs:all-found"` and `keeper` subscribes. Neither imports the
other. Delete `keeper.js` and `orbs.js` still runs.

## Where things go when you add a feature

| You are adding | It belongs in |
| --- | --- |
| A number you will want to tune | `config.js` |
| A rule about what happens when | `domain/` |
| Something visible in the 3D scene | `world/` |
| A panel, button, or readout | `ui/` |
| Something with no game knowledge at all | `platform/` |

If a change needs edits in three layers at once, that is usually a sign the feature is
really two features.

## Order of work

1. ~~Event bus — removes all four cycles, no behaviour change~~ **done**
2. ~~`config.js` — gather the scattered tuning numbers~~ **done**
3. Split `state.js` into renderer / materials / shared state
4. Separate rules from screens, one feature at a time (duel first — clearest seam)
5. Move files into folders — **last**, once imports already point the right way

Moving folders first just relocates a tangle.

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
    save      load and save to browser storage
    state     renderer, scene, camera, lights, and the shared G object
    world     terrain height, regions, scenery placement, the horizon
    sky       the gradient dome, the sun, and shadow setup
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
    keeper    the dragon and the wish ceremony
    tuner     the ?tune panel
    main      builds everything, wires listeners, runs the frame loop

## Current layering

The graph sorts itself, no folders required yet. **Zero cycles** across 20 modules:

```
0   config, events, props, rng, save, voice     depend on nothing
1   state, tuner
2   bloom, input, player, sky, ui, world
3   orbs, shop
4   inventory, wanderers
5   duel, finder, keeper
6   main
```

Nothing at a lower number imports anything at a higher one. Re-check it any time with a
quick scan of the `import ... from './x.js'` lines; if a cycle ever appears, the fix is
almost always an event rather than an import.
