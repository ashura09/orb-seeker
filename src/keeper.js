// keeper.js — the dragon of the valley, and the wish ceremony.
//
// The whole ending lives here: the Keeper is built the first time it is needed
// (buildKeeper), animated every frame while present (animateKeeper), grants one
// wish or three depending on whether you kept the orbs in order, sets the wishes
// down as tokens, and then departs once you have picked them all up.
import * as THREE from 'three';
import { scene, mat, glow, pointLight, $, G, forward } from './state.js';
import { player } from './player.js';
import { save, persist } from './save.js';
import { toast } from './ui.js';
import { orbs, orbGeo } from './orbs.js';
import { spawnPickup } from './inventory.js';
import { surfaceHeightAt } from './world.js';
import { on, EVENTS } from './events.js';
import { CONFIG } from './config.js';
import { keeperGreeting } from './voice.js';

export const keeper = new THREE.Group();
export const ka = {
  wings: [],
  tail: [],
  neck: [],
  eyes: [],
  sparks: null,
  ring: null,
  built: false,
};
export const ringOrbs = [];

export function buildKeeper() {
  if (ka.built) return;
  ka.built = true;
  const scale = mat(0xf1e2b5, 0.25),
    belly = mat(0xfff5d8, 0.3),
    gold = mat(0xc9a15a, 0.6),
    dark = mat(0x2a2320);
  // stout body
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), scale);
  body.scale.set(2.3, 1.9, 3.0);
  body.position.set(0, 6, -1);
  keeper.add(body);
  const bellyM = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), belly);
  bellyM.scale.set(1.7, 1.3, 2.6);
  bellyM.position.set(0, 5.4, -0.6);
  keeper.add(bellyM);
  // dorsal fins
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9 - i * 0.1, 4), gold);
    f.position.set(0, 7.9 - i * 0.15, 0.6 - i * 0.9);
    f.rotation.x = -0.4;
    keeper.add(f);
  }
  // neck: five segments curving up and forward to the head
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.0 - i * 0.11, 14, 10), scale);
    s.position.set(0, 6.8 + i * 0.85, 1.6 + i * 0.75);
    keeper.add(s);
    ka.neck.push(s);
  }
  // head
  const head = new THREE.Group();
  head.position.set(0, 10.6, 5.2);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), scale);
  skull.scale.set(1, 0.85, 1.25);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.3), scale);
  snout.position.set(0, -0.15, 1.2);
  head.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.28, 1.1), belly);
  jaw.position.set(0, -0.55, 1.05);
  jaw.rotation.x = 0.18;
  head.add(jaw);
  const nostrils = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.2), dark);
  nostrils.position.set(0, 0.05, 1.85);
  head.add(nostrils);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), glow(0x8ff5c8));
    eye.position.set(s * 0.5, 0.2, 0.75);
    head.add(eye);
    ka.eyes.push(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.3), dark);
    brow.position.set(s * 0.5, 0.45, 0.7);
    brow.rotation.z = -s * 0.3;
    head.add(brow);
    // branching horns, swept back
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 1.8, 6), gold);
    horn.position.set(s * 0.55, 0.9, -0.6);
    horn.rotation.set(-0.9, 0, -s * 0.35);
    head.add(horn);
    const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.9, 6), gold);
    tine.position.set(s * 0.9, 1.4, -0.9);
    tine.rotation.set(-0.5, 0, -s * 0.9);
    head.add(tine);
    // whisker-free cheek frills
    const frill = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 4), scale);
    frill.position.set(s * 0.95, -0.1, -0.2);
    frill.rotation.set(0, 0, (s * Math.PI) / 2 + s * 0.4);
    head.add(frill);
  });
  keeper.add(head);
  ka.head = head;
  // wings: two pairs, membrane from a shape, bones as cylinders
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(3.2, 2.4);
  wingShape.lineTo(6.4, 2.0);
  wingShape.lineTo(5.6, 0.2);
  wingShape.lineTo(6.2, -2.0);
  wingShape.lineTo(3.4, -1.4);
  wingShape.lineTo(0, -1.2);
  wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xe6cf95,
    emissive: 0xe6cf95,
    emissiveIntensity: 0.3,
    roughness: 0.6,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  [
    [-1, 0, 6.9, -0.4],
    [1, 0, 6.9, -0.4],
    [-1, 0.7, 6.4, -2.6],
    [1, 0.7, 6.4, -2.6],
  ].forEach(([s, sc, y, z], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 1.6, y, z);
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.scale.set(s * (1 - sc * 0.35), 1 - sc * 0.3, 1);
    wing.rotation.x = -Math.PI / 2;
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 6.4, 6), gold);
    bone.rotation.set(0, s * 0.3, Math.PI / 2);
    bone.position.set(s * 3.0, 0.03, 1.1);
    pivot.add(wing, bone);
    keeper.add(pivot);
    ka.wings.push({ pivot, s, phase: i < 2 ? 0 : 0.6 });
  });
  // legs, dangling
  [
    [-1.3, 1.2],
    [1.3, 1.2],
    [-1.4, -2.4],
    [1.4, -2.4],
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.6, 8), scale);
    leg.position.set(x, 4.4, z);
    leg.rotation.x = 0.35;
    keeper.add(leg);
    for (let k = -1; k <= 1; k++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), gold);
      claw.position.set(x + k * 0.2, 3.5, z + 0.5);
      claw.rotation.x = Math.PI * 0.75;
      keeper.add(claw);
    }
  });
  // tail: eight segments trailing behind
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.75 - i * 0.08, 12, 8),
      i % 2 ? belly : scale,
    );
    keeper.add(s);
    ka.tail.push(s);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 4), gold);
  keeper.add(tip);
  ka.tailTip = tip;
  // rune ring on the ground, sparks, light
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.08, 6, 80), glow(0x8ff5c8, 0.6));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  keeper.add(ring);
  ka.ring = ring;
  const N = 180,
    pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2,
      r = 2 + Math.random() * 5;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 13;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  ka.sparks = new THREE.Points(
    sg,
    new THREE.PointsMaterial({ color: 0xfff3c4, size: 0.16, transparent: true, opacity: 0.9 }),
  );
  keeper.add(ka.sparks);
  const kl = pointLight(0xffe9b0, 3.5, 50);
  kl.position.y = 8;
  keeper.add(kl);
  const mouthLight = pointLight(0x8ff5c8, 1.5, 12);
  mouthLight.position.set(0, 10, 7);
  keeper.add(mouthLight);
}

export function animateKeeper(dt) {
  const t = G.t;
  keeper.position.y = Math.sin(t * 1.1) * 0.35 + 0.4;
  ka.wings.forEach((w) => {
    w.pivot.rotation.z = w.s * (0.25 + Math.sin(t * 2.2 + w.phase) * 0.45);
  });
  ka.head.position.y = 10.6 + Math.sin(t * 1.6) * 0.15;
  ka.head.rotation.x = Math.sin(t * 0.9) * 0.08;
  ka.neck.forEach((s, i) => {
    s.position.x = (Math.sin(t * 1.6 + i * 0.5) * 0.15 * i) / 4;
  });
  ka.tail.forEach((s, i) => {
    const k = i + 1;
    s.position.set(
      Math.sin(t * 1.5 - k * 0.5) * 0.35 * k * 0.5,
      6 - k * 0.45 + Math.sin(t * 1.2 - k * 0.4) * 0.2,
      -3.6 - k * 0.75,
    );
  });
  const last = ka.tail[7];
  ka.tailTip.position.set(last.position.x, last.position.y, last.position.z - 0.8);
  ka.tailTip.rotation.x = -Math.PI / 2;
  const blink = 0.7 + 0.3 * Math.sin(t * 4);
  ka.eyes.forEach((e) => (e.material.opacity = blink));
  ka.eyes.forEach((e) => (e.material.transparent = true));
  ka.ring.rotation.z += dt * 0.4;
  ka.ring.scale.setScalar(1 + Math.sin(t * 2) * 0.03);
  const p = ka.sparks.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i) + dt * 1.6;
    if (y > 13) y = 0;
    p.setY(i, y);
  }
  p.needsUpdate = true;
}

export function beginEnding() {
  G.state = 'ending';
  G.ceremony = true;
  G.endT = 0;
  G.nightTarget = 1;
  // Frame the ceremony, but leave the camera in the player's hands afterwards --
  // the Keeper stands overhead and is worth looking up at.
  G.camPitch = CONFIG.camera.cinematicPitch;
  $('hint').style.opacity = 0;
  orbs.forEach((o, i) => {
    const m = new THREE.Mesh(orbGeo, mat(o.color, 0.9));
    m.add(pointLight(o.color, 1.5, 12));
    scene.add(m);
    ringOrbs.push({ m, i });
  });
  buildKeeper();
  const f = forward();
  const kx = player.position.x + f.x * CONFIG.ceremony.keeperDistance;
  const kz = player.position.z + f.z * CONFIG.ceremony.keeperDistance;
  keeper.position.set(kx, surfaceHeightAt(kx, kz), kz);
  keeper.lookAt(player.position.x, 0, player.position.z);
  keeper.scale.setScalar(0.001);
  scene.add(keeper);
  const n = G.orderKept ? CONFIG.ceremony.wishesInOrder : CONFIG.ceremony.wishesOutOfOrder;
  // save.cycles is how many gatherings came before this one, so the Keeper
  // greets a first-time seeker differently from a familiar one.
  $('wishIntro').textContent = keeperGreeting(save.cycles, G.orderKept);
  $('wishBtn').textContent = n === 1 ? 'Make the wish' : 'Make the wishes';
  $('wishAsk').style.display = 'block';
  $('wishDone').style.display = 'none';
  $('wishInputs').innerHTML = '';
  for (let i = 0; i < n; i++) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = 80;
    inp.autocomplete = 'off';
    inp.placeholder = n === 1 ? 'I wish for…' : `Wish ${i + 1}…`;
    inp.className = 'wishInput';
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') makeWish();
    });
    $('wishInputs').appendChild(inp);
  }
}

let pendingWishes = [];

export function makeWish() {
  const vals = [...document.querySelectorAll('.wishInput')]
    .map((i) => i.value.trim())
    .filter(Boolean);
  pendingWishes = vals.length ? vals : ['A wish kept secret'];
  const echo = $('wishEcho');
  echo.innerHTML = '';
  pendingWishes.forEach((v) => {
    const d = document.createElement('div');
    d.textContent = `“${v}”`;
    echo.appendChild(d);
  });
  $('wishAsk').style.display = 'none';
  $('wishDone').style.display = 'block';
  if (navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 120]);
}
$('wishBtn').addEventListener('click', makeWish);

$('claimBtn').addEventListener('click', () => {
  $('wish').classList.add('hidden');
  G.state = 'play';
  // tokens land between you and the Keeper
  const base = Math.atan2(
    keeper.position.z - player.position.z,
    keeper.position.x - player.position.x,
  );
  pendingWishes.forEach((w, i) =>
    spawnPickup('wish', w, base + (i - (pendingWishes.length - 1) / 2) * 0.5),
  );
  ringOrbs.forEach(({ m }) => scene.remove(m));
  ringOrbs.length = 0;
  save.cycles++;
  persist();
  toast('Walk over the tokens to keep your wishes', 3);
});

export function keeperDeparts() {
  G.departT = 0;
  toast('The Keeper rises and the valley sleeps. The orbs will scatter again soon.', 3.5);
}

// ---------- what wakes the Keeper ----------
// orbs.js does not know this file exists; it only announces that the seventh
// orb was collected. The same for the last wish token being picked up.
on(EVENTS.ORBS_ALL_FOUND, beginEnding);
on(EVENTS.WISHES_ALL_COLLECTED, keeperDeparts);
