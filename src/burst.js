// burst.js — the spray of sparks when something is collected.
//
// CLAUDE.md's art rule says nothing appears or disappears instantly. Collecting
// an orb broke it in the most visible place in the game: you walked into the
// thing you had spent five minutes hunting and it simply stopped existing, in
// one frame, with no acknowledgement. That is the single most repeated moment in
// Orb Seeker and it had no reward attached to it at all.
//
// WHY THIS IS ONE OBJECT AND NOT MANY
//
// The obvious way to write this is to make a few dozen little meshes each time
// and throw them away afterwards. That is wrong here twice over. Every mesh is a
// draw call, and this game has three to spare out of a hundred and fifty; and
// making objects mid-game means the garbage collector runs mid-game, which on a
// phone is a visible hitch at exactly the moment you were trying to make feel
// good.
//
// So there is ONE THREE.Points, built once at load, holding every spark. It is
// hidden when idle -- an invisible object is not drawn, so it costs nothing --
// and firing it just rewrites numbers into arrays that already exist. Nothing is
// allocated after this file finishes loading, which is what CLAUDE.md's "no
// per-frame allocations" rule is actually asking for.
import * as THREE from 'three';
import { scene, G } from './state.js';
import { CONFIG } from './config.js';

const C = CONFIG.collect;
const N = C.sparks;

// Position and colour are read by the GPU every frame the burst is visible.
const positions = new Float32Array(N * 3);
const colors = new Float32Array(N * 3);
// Velocity is ours alone and never leaves the CPU, so it is a plain array that
// the GPU never sees.
const velocities = new Float32Array(N * 3);

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// A round spark, drawn once into a tiny canvas.
//
// Without this every spark is a SQUARE -- a bare PointsMaterial draws the whole
// point rectangle, and thirty white squares stacked up looks like a rendering
// fault, which is exactly how it looked the first time this ran. The gradient
// also gives each spark a soft edge, so they read as motes of light instead of
// confetti.
function sparkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const material = new THREE.PointsMaterial({
  size: C.sparkSize,
  map: sparkTexture(),
  vertexColors: true,
  transparent: true,
  opacity: 1,
  // NORMAL blending, not additive. Additive was the first instinct and it was
  // wrong for this game: additive can only ever brighten what is behind it, and
  // this valley is lit daylight over bright green grass, so every spark bleached
  // to white and the orb's own colour -- the whole point of colouring them --
  // was lost. Normal blending keeps red sparks red.
  blending: THREE.NormalBlending,
  // No depth writing, or each spark would punch a hole in the ones behind it.
  depthWrite: false,
  sizeAttenuation: true,
});

const points = new THREE.Points(geo, material);
points.visible = false;
points.frustumCulled = false; // it moves far from where it was built
scene.add(points);

let age = 0;
let alive = false;

const tint = new THREE.Color();

/**
 * Throw a spray of sparks out from a point.
 *
 * @param x,y,z  where in the world it happens
 * @param color  hex; the sparks are the colour of the thing you collected, so
 *               orb 3 bursts yellow and orb 6 bursts blue without being told
 */
export function burstAt(x, y, z, color) {
  tint.setHex(color);
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    // A spray in every direction. `up` is picked flat rather than as an angle,
    // which keeps the sparks from bunching at the top and bottom.
    const up = Math.random() * 2 - 1;
    const ring = Math.sqrt(1 - up * up);
    const around = Math.random() * Math.PI * 2;
    // Speeds vary so the spray has a soft edge rather than a hard shell.
    const speed = C.sparkSpeed * (0.45 + Math.random() * 0.75);
    // Widened on purpose. The first version multiplied the sideways components
    // by `ring`, which collapses to nothing for any spark heading up or down, so
    // most of the spray went straight up and it read as a fountain rather than a
    // burst. The floor of 0.55 guarantees every spark has real sideways travel.
    const out = 0.55 + ring * 0.45;
    velocities[i3] = Math.cos(around) * out * speed;
    // Biased upward, but only gently: sparks that mostly fall look like debris,
    // and sparks that ONLY rise look like a fountain.
    velocities[i3 + 1] = (up * 0.75 + 0.55) * speed;
    velocities[i3 + 2] = Math.sin(around) * out * speed;

    // A little variation in brightness, so it reads as many separate sparks
    // rather than one coloured cloud. Around the orb's colour, never far from it, and never pushed toward white:
    // the first version added a flat 0.15 to every channel and multiplied by up
    // to 1.3, which drove all seven orbs to the same pale cream.
    const heat = 0.7 + Math.random() * 0.45;
    colors[i3] = Math.min(1, tint.r * heat);
    colors[i3 + 1] = Math.min(1, tint.g * heat);
    colors[i3 + 2] = Math.min(1, tint.b * heat);
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  material.opacity = 1;
  points.visible = true;
  age = 0;
  alive = true;
}

/** Called every frame from motion.js. Does nothing at all when idle. */
export function updateBurst(dt) {
  if (!alive) return;
  age += dt;
  if (age >= C.sparkLife) {
    // Hidden, not removed: removing it from the scene would mean adding it back
    // next time, and Three recompiles shaders when the scene changes shape.
    points.visible = false;
    alive = false;
    return;
  }
  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    positions[i3] += velocities[i3] * dt;
    positions[i3 + 1] += velocities[i3 + 1] * dt;
    positions[i3 + 2] += velocities[i3 + 2] * dt;
    velocities[i3 + 1] -= C.sparkGravity * dt; // they arc over and fall
    // Air drag, so the spray blooms fast and then settles instead of flying off
    // forever in a straight line.
    const drag = 1 - C.sparkDrag * dt;
    velocities[i3] *= drag;
    velocities[i3 + 2] *= drag;
  }
  geo.attributes.position.needsUpdate = true;
  // Fade out over the back half only. Fading from the very first frame makes the
  // burst look weak at the moment it should look strongest.
  const t = age / C.sparkLife;
  material.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
}

/**
 * The bench has to produce identical numbers on every run, and this whole file
 * is built on Math.random. It is never fired there, but if anything ever does,
 * this keeps it out of the measurement.
 */
export function burstIsIdle() {
  return !alive || G.bench;
}
