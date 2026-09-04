// keeper.js — the wish ceremony.
//
// The dragon itself is dragon.js. This file is what it comes FOR: the orbs
// rising into a ring, one wish or three depending on whether you kept the order,
// the wishes set down as tokens, and the Keeper leaving once you have them.
import * as THREE from 'three';
import { scene, mat, pointLight, $, G, forward } from './state.js';
import { player } from './player.js';
import { save, persist } from './save.js';
import { toast } from './ui.js';
import { orbs, orbGeo } from './orbs.js';
import { spawnPickup } from './inventory.js';
import { surfaceHeightAt } from './world.js';
import { on, EVENTS } from './events.js';
import { CONFIG } from './config.js';
import { keeperGreeting } from './voice.js';
import { keeper, ringOrbs, buildKeeper } from './dragon.js';

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
