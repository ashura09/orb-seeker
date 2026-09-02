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
