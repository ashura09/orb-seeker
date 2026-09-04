// orbs.js — the seven orbs: how they look, where they land, and collecting them.
import * as THREE from 'three';
import * as P from './palette.js';
import { scene, mat, glow, hex, pointLight, G, $ } from './state.js';
import { player } from './player.js';
import { surfaceHeightAt } from './world.js';
import { toast, showOrder } from './ui.js';
import { emit, EVENTS } from './events.js';
import { CONFIG } from './config.js';
import { pickOrbSpots } from './rules.js';
import { burstAt } from './burst.js';
import { shakeCamera } from './camera.js';

const C = CONFIG.collect;

const ORB_COLORS = P.ORB;
// The resting values the flare animates away from and restores afterwards.
const ORB_EMISSIVE = 0.6;
const GLOW_OPACITY = 0.18;
export const orbGeo = new THREE.SphereGeometry(0.55, 18, 14);
export const orbs = [];

// ---------- orb lighting ----------
//
// Each orb used to carry its own PointLight, so seven lights were always in the
// scene. Three.js is a forward renderer: EVERY lit pixel loops over EVERY light
// in the scene, and the ground fills the whole screen. That was seven lighting
// calculations per pixel per frame -- the single most expensive thing in the
// game on a phone.
//
// The lights only reach 9 metres, so an orb 40 m away lit nothing at all while
// still being paid for on every pixel. Instead we keep a small fixed pool and
// each frame lend them to the nearest orbs. Visually identical; a third of the
// per-pixel cost.
//
// The pool is FIXED in size and never added to or removed from the scene. That
// matters: changing the number of lights makes Three recompile every shader,
// which is a visible stutter on a phone -- and the old code did exactly that
// every time you collected an orb.
const LIT_ORBS = CONFIG.orbs.litAtOnce;
const orbLights = [];
for (let i = 0; i < LIT_ORBS; i++) {
  const l = pointLight(P.WHITE, 0, CONFIG.orbs.lightRange);
  l.visible = false;
  scene.add(l);
  orbLights.push(l);
}

// Called once per frame from main.js.
// Which orbs currently hold a light, nearest first. Two fixed arrays, filled in
// place: this used to be `.filter().map().sort().slice()`, which built four
// arrays and seven little objects EVERY FRAME -- about 700 throwaway objects a
// second, and CLAUDE.md's budget says no per-frame allocations for exactly this
// reason. Garbage collection on a phone is a dropped frame you cannot predict.
//
// With only seven orbs and three lights, an insertion sort into a fixed array is
// both faster than sorting and allocates nothing at all.
const nearOrb = new Array(LIT_ORBS).fill(null);
const nearDist = new Float32Array(LIT_ORBS);

export function updateOrbLights() {
  for (let i = 0; i < LIT_ORBS; i++) {
    nearOrb[i] = null;
    nearDist[i] = Infinity;
  }
  for (const o of orbs) {
    if (o.found) continue;
    const dx = o.x - player.position.x;
    const dz = o.z - player.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    // Slide it into the ranking, pushing the rest down; drops off the end if it
    // is not among the nearest few.
    for (let i = 0; i < LIT_ORBS; i++) {
      if (d < nearDist[i]) {
        for (let j = LIT_ORBS - 1; j > i; j--) {
          nearDist[j] = nearDist[j - 1];
          nearOrb[j] = nearOrb[j - 1];
        }
        nearDist[i] = d;
        nearOrb[i] = o;
        break;
      }
    }
  }
  for (let i = 0; i < LIT_ORBS; i++) {
    const l = orbLights[i];
    const o = nearOrb[i];
    if (o && nearDist[i] < CONFIG.orbs.lightCutoff) {
      l.visible = true;
      l.color.setHex(o.color);
      l.intensity = CONFIG.orbs.lightIntensity;
      l.position.set(o.x, o.mesh.position.y, o.z);
    } else {
      l.visible = false;
      l.intensity = 0;
    }
  }
}

for (let i = 0; i < 7; i++) {
  const c = ORB_COLORS[i];
  const mesh = new THREE.Mesh(orbGeo, mat(c, ORB_EMISSIVE));
  mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), glow(c, GLOW_OPACITY)));
  const tc = document.createElement('canvas');
  tc.width = tc.height = 128;
  const tx = tc.getContext('2d');
  tx.fillStyle = '#f6efdf';
  tx.beginPath();
  tx.arc(64, 64, 54, 0, Math.PI * 2);
  tx.fill();
  tx.lineWidth = 8;
  tx.strokeStyle = hex(c);
  tx.stroke();
  tx.fillStyle = '#1b1a17';
  tx.font = 'bold 72px Trebuchet MS, sans-serif';
  tx.textAlign = 'center';
  tx.textBaseline = 'middle';
  tx.fillText(String(i + 1), 64, 68);
  const tag = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(tc), transparent: true }),
  );
  tag.position.y = 1.35;
  tag.scale.setScalar(0.8);
  mesh.add(tag);
  orbs.push({ x: 0, z: 0, mesh, color: c, found: false, phase: Math.random() * 6, n: i + 1 });
}

const counterEl = $('counter');
export const dots = orbs.map((o) => {
  const d = document.createElement('i');
  d.textContent = o.n;
  d.style.setProperty('--c', hex(o.color));
  counterEl.appendChild(d);
  return d;
});

/**
 * @param random  where the randomness comes from. Defaults to Math.random; the
 *                bench passes a seeded one so the orbs -- and therefore the
 *                villagers who camp beside them -- land in the same place every run.
 */
export function placeOrbs(random = Math.random) {
  G.found = 0;
  G.orderKept = true;
  // Far-flung spots, well apart, dealt out shuffled so an orb's number tells you
  // nothing about where it is. The algorithm lives in rules.js, where it can be
  // tested without a renderer.
  const spots = pickOrbSpots({ playerX: player.position.x, playerZ: player.position.z, random });
  orbs.forEach((o, i) => {
    o.x = spots[i].x;
    o.z = spots[i].z;
    o.found = false;
    o.mesh.position.set(o.x, surfaceHeightAt(o.x, o.z) + 1.1, o.z);
    resetLook(o); // an orb mid-flare when the valley is rebuilt must come back whole
    scene.add(o.mesh);
    dots[i].classList.remove('on');
  });
  showOrder(true, 0);
}
placeOrbs();

// ---------------------------------------------------------------------------
// THE FLARE — an orb taking its leave.
//
// The mesh stays in the scene and animates out, so `found` and "gone from the
// screen" are no longer the same instant. Everything that reads `o.found` --
// the lights, the pickup test, the counter -- treats it as collected right
// away; only the picture lags behind. That ordering matters: the reward may
// never delay the game reacting to you.
// ---------------------------------------------------------------------------
const vanishing = [];

function resetLook(o) {
  o.mesh.scale.setScalar(1);
  o.mesh.material.emissiveIntensity = ORB_EMISSIVE;
  o.mesh.children[0].material.opacity = GLOW_OPACITY;
  o.mesh.children[0].scale.setScalar(1);
}

function startVanish(o) {
  vanishing.push({ o, age: 0 });
}

/** Called every frame from motion.js, outside the play gate. Idle when empty. */
export function updateVanish(dt) {
  for (let i = vanishing.length - 1; i >= 0; i--) {
    const v = vanishing[i];
    v.age += dt;
    const t = v.age / C.orbFlare;
    if (t >= 1) {
      scene.remove(v.o.mesh);
      resetLook(v.o); // ready for the next round, since placeOrbs re-adds this mesh
      vanishing.splice(i, 1);
      continue;
    }
    // Swell fast, collapse slower: the shape of something being pulled away
    // rather than something being deflated. The squared collapse means most of
    // the shrinking happens at the end, so it holds its size and then goes.
    const swell = 0.3;
    const scale =
      t < swell
        ? 1 + (C.orbPop - 1) * (t / swell)
        : C.orbPop * (1 - (t - swell) / (1 - swell)) ** 2;
    v.o.mesh.scale.setScalar(Math.max(0.0001, scale));
    v.o.mesh.position.y += C.orbRise * dt;
    // Brightest at the moment it is biggest, then out.
    v.o.mesh.material.emissiveIntensity = ORB_EMISSIVE * (1 + (C.orbFlash - 1) * (1 - t));
    // The soft shell around it grows past the orb and thins to nothing, which is
    // what makes the flare read as light rather than as a balloon.
    const shell = v.o.mesh.children[0];
    shell.scale.setScalar(1 + t * 1.6);
    shell.material.opacity = GLOW_OPACITY * (1 - t);
  }
}

export function collect(o) {
  if (o.n !== G.found + 1 && G.orderKept) {
    G.orderKept = false;
    toast(`Order broken at ${o.n}. One wish.`);
  } else if (G.found < 6)
    toast(
      G.orderKept
        ? `Orb ${o.n} found, in order. ${G.found + 1} of 7`
        : `Orb ${o.n} found. ${G.found + 1} of 7`,
    );
  o.found = true;
  G.found++;
  // NOT scene.remove(o.mesh). That single line was the game's worst moment: the
  // thing you had been hunting for five minutes stopped existing between one
  // frame and the next, with nothing to mark it. The orb now takes itself out --
  // it swells, flares, lifts and shrinks away over four tenths of a second --
  // while the sparks fly and the camera takes a small knock.
  startVanish(o);
  burstAt(o.mesh.position.x, o.mesh.position.y, o.mesh.position.z, o.color);
  shakeCamera(C.shake);
  dots[orbs.indexOf(o)].classList.add('on');
  if (navigator.vibrate) navigator.vibrate(40);
  showOrder(G.orderKept, G.found);
  if (G.found === 7) {
    toast(G.orderKept ? 'All seven, in perfect order' : 'All seven gathered');
    emit(EVENTS.ORBS_ALL_FOUND);
  }
}
