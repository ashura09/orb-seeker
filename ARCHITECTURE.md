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

## Balancing the game live

Open the game with `?tune` on the URL and a panel appears with a slider for every
value in `config.js`:

    http://localhost:5173/?tune
    https://ashura09.github.io/orb-seeker/?tune      (works on your phone)

Drag and the game responds immediately. "Copy what I changed" gives you a short
list of just the values you moved, to edit into `config.js` by hand -- which
keeps the comments there. Sliders marked with a circular arrow are read once at
startup, so those need a reload.

The panel is a dynamic import, so lil-gui is a separate 9 KB chunk that players
who never use `?tune` never download.

## Balancing the game

Every number worth tuning lives in `src/config.js`, grouped by what it affects:
world, player, camera, orbs, wanderers, duel, finder, ceremony, dayNight, loop.
Item prices are the `ITEMS` table in the same file.

Nothing in that file imports anything or does anything — it is only values, so you can
change one, reload, and see the result without reading any other file.

What deliberately stays out: shapes and proportions (the dragon's neck, the monkey's
ears) and colours. Those are art, not balance, and they live beside the code that
builds them.

## Current layering

With the bus in place the graph sorts itself, no folders required yet:

```
0   config, events, save, state   depend on nothing
1   input, player, ui, world
2   orbs, shop
3   inventory, wanderers
4   duel, finder, keeper
5   main
```

Nothing at a lower number imports anything at a higher one.
