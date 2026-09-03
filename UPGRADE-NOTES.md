# Three.js r128 → r185

The original single-file game loaded Three.js r128 from a CDN:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

It now comes from npm instead, as a normal import:

```js
import * as THREE from 'three';
```

That is 57 releases of difference. Most of the game needed no changes at all —
it was already written against the modern API (`BufferGeometry`,
`geometry.setAttribute`, no `THREE.Geometry`). Four things did change.

## 1. Colour management is on by default (r152)

**What changed.** r152 turned on `THREE.ColorManagement`. Every hex colour you
write is now read as sRGB, converted to linear for the lighting maths, and
converted back to sRGB on output. In r128 the hex numbers were used raw.

**What we did.** Kept it on — the r185 default. Because the conversion happens
in both directions, the colours you authored still look like themselves.

**What we tried first, and why it was wrong.** The instinct for a
"keep it identical" refactor is to switch colour management off and set
`renderer.outputColorSpace = THREE.LinearSRGBColorSpace` to recreate r128
exactly. Doing that makes the whole game *markedly darker* — the sky goes from
light blue to navy. Colours were confirmed to be passing through unconverted,
so the darkening came from the output side. Leaving both at the r185 defaults
looks far closer to the original.

**Residual difference.** Lighting is now computed in linear space, so shading
gradients are slightly different from r128. Flat colours match; mid-tones on lit
surfaces are a touch different. This is inherent to the change and cannot be
switched off without the darkening above.

## 2. Point lights: decay and falloff (r155)

**What changed.** Two things at once:

- `PointLight.decay` used to default to `1`. It now defaults to `2`.
- The falloff formula changed from a simple ramp that reached zero at the
  light's `distance`, to a physically correct inverse-square:
  `1 / max(d^decay, 0.01)`, windowed by the cutoff distance.

Left alone, every glow in the game — the seven orbs, the lantern, the pickup
boxes, the wish tokens, the Keeper — would be dimmer and much tighter.

**What we did.** Every point light is created through one helper in
`src/state.js`:

```js
export function pointLight(color, intensity, distance){
  const l = new THREE.PointLight(color, intensity, distance);
  l.decay = 0;
  return l;
}
```

`decay = 0` cancels the inverse-square term, leaving only the cutoff window —
a bounded, soft falloff that reaches zero at `distance`, which is the shape r128
had. **This is the one place to change if you ever want the modern look**: delete
the `l.decay = 0` line and the game switches to physically correct lighting.

**Note.** `WebGLRenderer.useLegacyLights`, the flag that used to restore the old
behaviour wholesale, was removed in r165. There is no switch any more; adjusting
`decay` is the way.

## 3. THREE.Clock is deprecated (r183)

`Clock` still works but logs a deprecation warning on every load. `Timer` is the
replacement. The difference is that you call `update()` once per frame, and
`getDelta()` then returns the same value however often you ask:

```js
const timer = new THREE.Timer();   // was: new THREE.Clock()

function frame(){
  timer.update();                            // new line
  const dt = Math.min(timer.getDelta(), 0.05);
```

The `Math.min(..., 0.05)` guard is from the original — it stops the game
lurching forward after the tab has been in the background.

## 4. The service worker cached the CDN URL

`public/sw.js` precached the r128 CDN script by URL. That entry is gone, and the
cache name is bumped to `orb-seeker-v2`. The game's JS and CSS are now built into
`./assets/` with hashed filenames that change every build, so they cannot be
listed by name — the existing runtime cache in the `fetch` handler picks them up
on first request instead.

---

## A trap worth knowing about

**The service worker will serve you stale code while you develop.** It caches
aggressively, and it survives restarting the dev server, clearing Vite's cache,
and ordinary reloads. During this upgrade it spent a while handing back an old
copy of `state.js`, which made it look like code changes were doing nothing.

If the game stops responding to your edits, paste this in the browser console:

```js
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
(await caches.keys()).forEach(k => caches.delete(k));
```

then reload. In Chrome DevTools you can also tick
**Application → Service Workers → Update on reload**, which avoids the problem
for good while you are working.

---

# Things that bit us later

Everything above is about the r128 → r185 move. What follows was learned while
building the terrain, the models and the lighting, and every one of them cost
real time. They are written down so they cost it only once.

## A rotated PlaneGeometry mirrors your Z

This was the worst one. A ground plane is built in local XY and rotated −90° about
X to lie flat. That rotation maps local **+y** to world **−z**.

Sample your height function with the local y as though it were world z, and you
build the terrain from a *mirrored* copy of it — while the player, props and
everything else use the true one. Nothing looks obviously wrong: a mirrored
valley is still a valley. But objects sit up to 9 m off the visible surface, so
they float, and walking onto high ground drops you through the floor.

```js
const x = pos.getX(i), z = -pos.getY(i);   // note the minus
pos.setZ(i, heightAt(x, z));
```

**How to catch it:** raycast the actual mesh from above and compare with what the
height function claims. If `heightAt(x, -z)` matches and `heightAt(x, z)` does
not, you have this bug.

## glTF colours are linear — but exporters lie

glTF says `baseColorFactor` is linear, so `GLTFLoader` stores it as linear. Some
exporters (Kenney's among them) write **sRGB** values into that field. Rendered
as linear they come out far too bright: bark went salmon, leaves went turquoise.

Proof, if you suspect it: the kit's `.mtl` files carried the *identical* numbers
as `Kd`, which is sRGB by convention. Fix with `.convertSRGBToLinear()` on the
material colour before baking it into vertices.

## Scale models by their longest axis, not their height

Scaling everything to a target *height* wrecks anything wider than it is tall.
`rock_largeA` is far broader than high, so forcing it to 2.4 m tall made it 8 m
across and it filled the screen. Use the longest of the three dimensions.

## EffectComposer breaks renderer.info

`renderer.info` resets on every `render()` call, so once a composer is in the
picture, any stats readout reports only the *final* pass — "1 call, 0 triangles".

```js
renderer.info.autoReset = false;   // once, at setup
renderer.info.reset();             // yourself, before composer.render()
```

Counts then accumulate across passes, which is the honest number anyway.

## A hemisphere light's ground colour matters once you have hills

A dark ground colour is invisible on a flat plane and brutal on terrain: every
slope facing away from the sun falls to near-black. Lighter bounce colour, plus a
low `AmbientLight`, so shadows read as *darker* rather than as holes.

## The build passing does not mean the game runs

`npm run build` catches syntax errors and nothing else. A dropped `>` turned
`const ordinal = n => ...` into `const ordinal = n = ...`, which is perfectly
valid JavaScript and a runtime `ReferenceError`. The build was happy; the game
was dead. **Load the page before believing a change works.**

## Background tabs are throttled

Frame rate looked halved and it was not: the browser throttles `requestAnimationFrame`
in tabs that are not in front, and several copies of the game were open at once.
Measure with one tab, fronted.

## sin(a*u) * cos(b*v) is a grid, not a texture

Building a tiling noise texture out of products of sines seems reasonable -- whole
number frequencies make it seamless for free. But `f(u) * g(v)` is **separable**,
and separable functions draw axis-aligned lattices. Summing four of them still
draws a lattice. Stamped across a 600 m ground plane it was a visible grid, which
is worse than the flat colour it replaced.

Raising the frequencies did not help, because the STRUCTURE was wrong, not the
scale -- it just produced a finer grid.

What works is value noise on an integer lattice whose coordinates wrap at each
octave's own period. It is seamless for the same reason and has no preferred
direction. About 25 lines, in `makeGroundDetail`.

Two more things that ground detail needs:

- The texture is a **multiplier** over the region colours, so it has to sit near
  white. A mid-grey noise texture halves the brightness of the whole valley.
- Mipmaps and `anisotropy` are not optional at 70 tiles across the plane, or the
  distance shimmers.

## Slope is what makes terrain read as terrain

A cliff face painted the same green as the meadow beside it is most of why ground
looks like a bedsheet thrown over furniture. Blending toward rock by the local
gradient costs four extra `heightAt` calls per vertex, at build time only.

Take the gradient from the height FUNCTION, not from the mesh normals --
`computeVertexNormals()` has not run yet at that point in `shapeGround`.

## One colour per instance is nearly free

Every copy of a model was the exact same colour, which is why 1900 props read as
fifteen objects repeated. `InstancedMesh.setColorAt` multiplies into the baked
vertex colours and rides in the same buffer as the transform: no extra draw call,
no extra material. Hash the tint from the prop's position so a rebuild of the same
seed looks the same.

## Scattering things uniformly is why a world looks generated

Every prop landed on an independent uniform random point. That is the definition
of confetti, and adding more of it never helps -- more confetti is still confetti.
What turns the same models into a landscape is arrangement: clumps (things seed
near each other), clearings (a wood is only legible when there are gaps to see
across), paths (routes people would have walked), and a scale hierarchy (a few
things much larger, so the eye can judge distance).

Two mistakes in doing that, both found by looking rather than by reasoning:

**A clearing is free of trees, not of grass.** Excluding every prop from clearings
and paths left bare green expanses that looked *emptier* than the confetti did.
Ground cover has to keep growing there; only the tall things stay out.

**`regionAt().blend` is not a distance.** It is `nearest / (nearest + second)` --
a measure of how EQUIDISTANT you are between two regions, which is maximal in the
middle of the map. Thinning density by it made the exact spot you spawn on the
emptiest ground in the valley. What you want is distance from the nearest region
centre relative to that region's own radius.

Also: `Math.sqrt(rng()) * radius` spreads points evenly over a disc. Plain
`rng() * radius` piles them into the middle, so every clump grows a dense core
and a thin edge -- the same mistake as uniform scatter, just smaller.

## Keeping the camera out of the scenery costs no raycasting

Once trees can be 2.6x, sitting inside a canopy is easy. The obstacle list built
for WALKING collision is already a circle per prop on the ground, so how far the
camera can back away is a line-versus-circle test against a list that exists --
about 1900 cheap iterations, versus raycasting instanced meshes.

Two things it needs: ignore small props (a fern has no business shoving the camera
into your back), and keep the spawn point clear, or your first sight of the valley
is a trunk with the camera jammed behind you.

## An environment map REPLACES your fake fill lights, it does not join them

Switching Lambert materials to Standard and adding `scene.environment` made the
valley look *worse* at first: washed out, low contrast, everything tinted the sky's
blue. Nothing was wrong with the environment map.

The hemisphere light and the ambient light were **cheap stand-ins for sky light**,
put there back when Lambert could not be lit by an environment at all. Adding the
real thing on top meant three helpings of fill at once. Fill light has no direction,
so three of it means no contrast anywhere, and the strongest tint wins.

The fix is to turn the stand-ins right down (hemi 0.85 -> 0.20, ambient 0.22 -> 0.05)
and turn the sun UP (1.05 -> 1.75), so the light has a direction again.

Related: with no tone mapping, everything over 1.0 clips to flat white. `ACESFilmic`
plus an exposure of about 1.0 rolls highlights off instead and puts contrast back
into the midtones. It restyles the whole game, so it is worth doing before tuning
any colour by hand.

## Comparing two versions needs the same world

Every reload re-rolls the valley from a random seed, so two screenshots of "before"
and "after" are of different landscapes and prove nothing. `?seed=4242` pins it:

    http://localhost:5173/?seed=4242

Use it for any change you intend to judge by eye.

## On a phone, "two fingers" is not a gesture

Pinch-to-zoom looks like a five-line feature and is not, because **walking while
looking around is already two fingers**. Treat any second finger as a pinch and the
camera zooms every time the player moves and turns at once -- which is most of the game.

Nor is "the gap between the fingers changed" enough on its own: in walk-and-look the
thumbs drift apart constantly.

What works is making the pinch prove itself against BOTH tests before it takes the
fingers away from walking and looking:

1. the gap changed by more than a threshold (~24 px), **and**
2. the walking thumb is sitting near the centre of its stick, so it is resting
   rather than steering.

Two fingers down only opens a *candidate*; the joystick and look-drag keep working
until those hold. See `pinch` in `src/input.js`.

Two smaller things that matter more than they look:

- Measure the zoom from where the fingers are when the pinch **commits**, not from
  where they first landed, or the view jumps by the threshold at that moment.
- When one finger lifts, hand the remaining one back to look-drag *at its current
  position*. Otherwise the next drag is measured from a stale point and the view snaps.

## Sharing the link never shares your progress

Worth knowing before someone asks. `save.js` writes to `localStorage`, which is scoped to
the origin **and to the device**, and the game makes no network calls at all -- no `fetch`,
no socket, no server. So:

- Whoever opens your link starts with an empty save. They cannot see or inherit your items.
- Your own phone and laptop keep *separate* saves, same URL, same person.
- Clearing site data wipes yours, and nothing can restore it.

Shared or cross-device progress would need accounts and a server. There are none, by design.

