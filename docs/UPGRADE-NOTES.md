## Verifying a change in a running Vite dev server (and the trap in it)

The dev server serves ES modules, so the browser console can reach the game's
real modules and drive them:

    const o = await import('/src/orbs.js');
    o.collect(o.orbs[0]);        // a genuine collection, real code path

**The trap.** After you edit a file, Vite's HMR serves the entry as
`/src/main.js?t=1788560560425`. That query string makes it a _different module
URL_, so `import('/src/state.js')` from the console loads a SECOND, FRESH COPY of
the whole game. It looks like it is working: `collect()` runs, the toast appears,
the counter dot lights — because those write to the DOM, which is shared. But the
3D scene you are looking at belongs to the first copy and never changes.

This cost an hour and produced a confident, wrong conclusion ("the sparks do not
render"). Check before trusting anything:

    [...document.querySelectorAll('script')].map(x => x.src)

If the entry has `?t=`, you are talking to a phantom. **Restart the dev server**
after editing — a reload is not enough, the timestamp survives it.

## Seeing something that only lasts a fraction of a second

A screenshot round-trip is roughly half a second and not precisely timed, so a
0.75s effect is missed about as often as it is caught. Do not take ten
screenshots hoping. Freeze it instead — the config object is live, so from the
console:

    const c = (await import('/src/config.js')).CONFIG.collect;
    c.sparkLife = 30; c.sparkGravity = 0; c.sparkDrag = 6;

Now the effect hangs in the air and can be inspected properly. This is how the
two real bugs in burst.js were found: bare `PointsMaterial` draws SQUARES unless
you give it a round texture, and `AdditiveBlending` bleaches every colour to
white over bright daylit grass, so all seven orbs burst the same pale cream.
Neither is visible in code review and neither breaks a test.
