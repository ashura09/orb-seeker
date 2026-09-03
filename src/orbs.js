// orbs.js — the seven orbs: how they look, where they land, and collecting them.
import * as THREE from 'three';
import { scene, mat, glow, hex, pointLight, G, $ } from './state.js';
import { player } from './player.js';
import { surfaceHeightAt } from './world.js';
import { toast, showOrder } from './ui.js';
import { emit, EVENTS } from './events.js';
import { CONFIG } from './config.js';
import { pickOrbSpots } from './rules.js';

export const ORB_COLORS = [0xff6b6b, 0xffa94d, 0xffe066, 0x8ce99a, 0x66d9e8, 0x748ffc, 0xda77f2];
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
  const l = pointLight(0xffffff, 0, CONFIG.orbs.lightRange);
  l.visible = false;
  scene.add(l);
  orbLights.push(l);
}

// Called once per frame from main.js.
export function updateOrbLights() {
  const near = orbs
    .filter((o) => !o.found)
    .map((o) => ({ o, d: Math.hypot(o.x - player.position.x, o.z - player.position.z) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, LIT_ORBS);
  orbLights.forEach((l, i) => {
    const hit = near[i];
    if (hit && hit.d < CONFIG.orbs.lightCutoff) {
      l.visible = true;
      l.color.setHex(hit.o.color);
      l.intensity = CONFIG.orbs.lightIntensity;
      l.position.set(hit.o.x, hit.o.mesh.position.y, hit.o.z);
    } else {
      l.visible = false;
      l.intensity = 0;
    }
  });
}

for (let i = 0; i < 7; i++) {
  const c = ORB_COLORS[i];
  const mesh = new THREE.Mesh(orbGeo, mat(c, 0.6));
  mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), glow(c, 0.18)));
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

export function placeOrbs() {
  G.found = 0;
  G.orderKept = true;
  // Far-flung spots, well apart, dealt out shuffled so an orb's number tells you
  // nothing about where it is. The algorithm lives in rules.js, where it can be
  // tested without a renderer.
  const spots = pickOrbSpots({ playerX: player.position.x, playerZ: player.position.z });
  orbs.forEach((o, i) => {
    o.x = spots[i].x;
    o.z = spots[i].z;
    o.found = false;
    o.mesh.position.set(o.x, surfaceHeightAt(o.x, o.z) + 1.1, o.z);
    scene.add(o.mesh);
    dots[i].classList.remove('on');
  });
  showOrder(true, 0);
}
placeOrbs();

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
  scene.remove(o.mesh);
  dots[orbs.indexOf(o)].classList.add('on');
  if (navigator.vibrate) navigator.vibrate(40);
  showOrder(G.orderKept, G.found);
  if (G.found === 7) {
    toast(G.orderKept ? 'All seven, in perfect order' : 'All seven gathered');
    emit(EVENTS.ORBS_ALL_FOUND);
  }
}
