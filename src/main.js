// main.js — starts everything, and runs the frame loop.
//
// Read this file first. The imports below are the map of the whole game, and
// frame() at the bottom is the heartbeat: it runs about 60 times a second and
// is the only place that decides what happens in what order.
import * as THREE from 'three';
import './style.css';

import { G, scene, camera, renderer, hemi, sun, DAY, NIGHT, $, forward } from './state.js';
import { save, owned } from './save.js';
import { WORLD_R, obstacles } from './world.js';
import { player, armL, armR, handL, handR, legL, legR, tailSegs, cosmetics, applyCosmetics } from './player.js';
import { orbs, collect, placeOrbs, updateOrbLights } from './orbs.js';
import { keys, joy } from './input.js';
import { updateWanderers, homeWanderers } from './wanderers.js';
import { duel, updateDuel } from './duel.js';
import { pickups, collectPickup, spawnPickup } from './inventory.js';
import { drawFinder } from './finder.js';
import { keeper, ka, ringOrbs, animateKeeper } from './keeper.js';
import { toast, updateToast, initStats, echoToast } from './ui.js';
import { wishEcho } from './voice.js';
import { CONFIG } from './config.js';
import './shop.js';

// Items bought before a reload but never picked up are set down again.
// (In the original this sat in the pickups section; it lives here now so it
// runs after every module has finished loading.)
for (const id in save.items) if (save.items[id] === 'bought') spawnPickup('item', id);
applyCosmetics();

// THREE.Clock was deprecated in r183. Timer is the replacement: you call
// update() once per frame, then getDelta() as often as you like and always get
// the same value for that frame. The Math.min(..., 0.05) below is the original
// guard that stops a huge jump after the tab has been in the background.
const timer = new THREE.Timer();
const camTarget = new THREE.Vector3();
const { player: P, camera: CAM, orbs: ORB, ceremony: CER, dayNight: DN } = CONFIG;
G.camPitch = CAM.pitch;   // starting elevation
let bob = 0;

initStats(renderer);

// The tuning panel, only when asked for with ?tune on the URL. A dynamic import
// means Vite splits lil-gui into its own chunk, so players who never open the
// panel never download it.
if (new URLSearchParams(location.search).has('tune')){
  import('./tuner.js').then(m => m.initTuner()).catch(err => console.error('tuner failed to load:', err));
}

// ---------- the valley remembers ----------
//
// save.wishes has held every sentence the player ever typed, stamped with the
// gathering it belonged to, since the game was written. Nothing ever read it
// back. At the start of a gathering one of them resurfaces, quietly.
//
// Older wishes are preferred: being reminded of something you asked for six
// gatherings ago lands harder than something from last time.
function recallAWish(){
  if (!save.wishes.length) return;
  const oldest = Math.min(...save.wishes.map(w => w.cycle));
  const candidates = save.wishes.filter(w => w.cycle === oldest);
  const pick = candidates[(Math.random() * candidates.length) | 0];
  echoToast(wishEcho(pick.text, save.cycles - pick.cycle));
}

$('startBtn').addEventListener('click', () => {
  $('start').classList.add('hidden');
  G.state = 'play';
  setTimeout(recallAWish, 2200);   // let the panel clear before the memory arrives
});

function frame(){
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), CONFIG.loop.maxDelta); G.t += dt;
  let mx = joy.x, my = joy.y;
  if (keys['w']||keys['arrowup']) my = -1; if (keys['s']||keys['arrowdown']) my = 1;
  if (keys['a']||keys['arrowleft']) mx = -1; if (keys['d']||keys['arrowright']) mx = 1;
  if (keys['q']) G.camYaw += CAM.turnSpeed*dt; if (keys['e']) G.camYaw -= CAM.turnSpeed*dt;
  // R and F tilt the view up and down on a keyboard
  if (keys['r'] || keys['f']){
    const tilt = (keys['f'] ? 1 : 0) - (keys['r'] ? 1 : 0);
    G.camPitch = Math.max(CAM.pitchMin, Math.min(CAM.pitchMax, G.camPitch + tilt*CAM.pitchKeySpeed*dt));
  }
  const f = forward(), rx = -f.z, rz = f.x;

  // day / night easing
  G.night += (G.nightTarget - G.night) * Math.min(1, dt*DN.easeRate);
  scene.background.copy(DAY).lerp(NIGHT, G.night); scene.fog.color.copy(scene.background);
  hemi.intensity = DN.hemiDay - DN.hemiNightDrop*G.night; sun.intensity = DN.sunDay - DN.sunNightDrop*G.night;
  if (cosmetics.lanternLight) cosmetics.lanternLight.intensity = DN.lanternBase + G.night*DN.lanternNightBoost;

  if (G.state === 'play'){
    const len = Math.hypot(mx, my);
    let moving = false;
    if (len > 0.08){
      const k = Math.min(len, 1) * (owned('boots') ? P.bootsMultiplier : 1);
      const vx = f.x*(-my) + rx*mx, vz = f.z*(-my) + rz*mx, vl = Math.hypot(vx, vz) || 1;
      player.position.x += vx/vl*P.speed*k*dt; player.position.z += vz/vl*P.speed*k*dt;
      player.rotation.y = Math.atan2(vx, vz); bob += dt*P.bobRate*k; moving = true;
    }
    const pr = Math.hypot(player.position.x, player.position.z);
    if (pr > WORLD_R){ player.position.x *= WORLD_R/pr; player.position.z *= WORLD_R/pr; }
    for (const ob of obstacles){
      const dx = player.position.x - ob.x, dz = player.position.z - ob.z, d = Math.hypot(dx, dz), min = ob.r + P.radius;
      if (d < min && d > 0.0001){ player.position.x = ob.x + dx/d*min; player.position.z = ob.z + dz/d*min; }
    }
    player.position.y = Math.abs(Math.sin(bob))*P.bobHeight;
    // arms swing, tail sways
    armL.rotation.x = moving ? Math.sin(bob)*0.6 : 0; armR.rotation.x = moving ? -Math.sin(bob)*0.6 : 0;
    handL.position.z = Math.sin(armL.rotation.x)*0.3; handR.position.z = Math.sin(armR.rotation.x)*0.3;
    // legs swing opposite the arms, which is what walking looks like
    legL.rotation.x = moving ? -Math.sin(bob)*0.5 : 0; legR.rotation.x = moving ? Math.sin(bob)*0.5 : 0;
    for (const o of orbs){
      if (o.found) continue;
      o.mesh.position.y = 1.1 + Math.sin(G.t*2 + o.phase)*0.25; o.mesh.rotation.y += dt;
      if (Math.hypot(o.x - player.position.x, o.z - player.position.z) < ORB.pickupRadius) collect(o);
    }
    for (let i = pickups.length-1; i >= 0; i--){
      const p = pickups[i];
      p.g.position.y = 0.7 + Math.sin(G.t*2.5 + p.phase)*0.15; p.g.rotation.y += dt*1.2;
      if (Math.hypot(p.g.position.x - player.position.x, p.g.position.z - player.position.z) < 1.5) collectPickup(p, i);
    }
    updateWanderers(dt);
  }
  updateOrbLights();
  tailSegs.forEach((s, i) => { const k = i+1; s.position.set(Math.sin(G.t*3 - k*0.6)*0.06*k, 0.35 + k*0.06 + Math.sin(G.t*2 + k)*0.02, -0.38 - k*0.09); });
  if (cosmetics.charm) cosmetics.charm.rotation.z += dt*1.5;

  if (G.state === 'duel'){
    updateDuel(dt);
    const w = duel.w, dx = w.g.position.x - player.position.x, dz = w.g.position.z - player.position.z;
    player.rotation.y = Math.atan2(dx, dz); w.g.rotation.y = Math.atan2(-dx, -dz);
    w.g.position.y = duel.over ? 0 : Math.abs(Math.sin(G.t*14))*0.08;
  }

  if (G.state === 'ending'){
    G.endT += dt;
    const rise = Math.min(G.endT/CER.riseSeconds, 1);
    ringOrbs.forEach(({m, i}) => { const a = i/7*Math.PI*2 + G.endT*1.2; m.position.set(player.position.x + Math.cos(a)*(1.5+2*rise), 1.5 + 5*rise + Math.sin(G.endT*3+i)*0.2, player.position.z + Math.sin(a)*(1.5+2*rise)); });
    if (G.endT > CER.keeperGrowDelay) keeper.scale.setScalar(0.001 + Math.min((G.endT-CER.keeperGrowDelay)/CER.keeperGrowSeconds, 1));
    if (G.endT > CER.wishPromptAt){ G.state = 'wish'; $('wish').classList.remove('hidden'); const fi = document.querySelector('.wishInput'); if (fi) fi.focus(); }
  }
  if (G.state === 'wish') ringOrbs.forEach(({m,i}) => { const a=i/7*Math.PI*2 + G.t*1.2; m.position.set(player.position.x+Math.cos(a)*3.5, 6.5+Math.sin(G.t*3+i)*0.2, player.position.z+Math.sin(a)*3.5); });
  if (G.ceremony && ka.built) animateKeeper(dt);
  if (G.departT >= 0){
    G.departT += dt;
    const k = Math.min(G.departT/CER.departSeconds, 1);
    keeper.position.y += dt*6*k; keeper.scale.setScalar(1 - k*0.9);
    if (G.departT >= CER.departSeconds){ scene.remove(keeper); G.departT = -1; G.ceremony = false; G.nightTarget = 0; G.respawnT = CER.respawnSeconds; $('hint').style.opacity = 0.75; }
  }
  if (G.respawnT > 0){ G.respawnT -= dt; if (G.respawnT <= 0){ G.respawnT = -1; placeOrbs(); homeWanderers(); toast('The seven orbs have scattered across the valley again', 3); setTimeout(recallAWish, 3600); } }

  // ---------- camera ----------
  //
  // The camera orbits the player on a sphere. camYaw spins it around; camPitch
  // rides it up and down. `dist` is the radius of that sphere, so the ground
  // distance shrinks as you climb -- which is what makes looking down feel
  // right rather than like sliding backwards.
  //
  // Looking UP is the awkward case: pitch alone would push the camera below the
  // ground. So past level, the camera stops descending (minHeight) and instead
  // the point it aims at climbs, which tips the view skyward. That is how you
  // get to see the Keeper overhead.
  const cine = G.state === 'ending' || G.state === 'wish';
  const dist  = cine ? CAM.cinematicDistance : CAM.distance;
  const pitch = G.camPitch;   // yours during the ceremony too, so you can look up at the Keeper
  const aimAt = cine ? CAM.cinematicLookAt   : CAM.lookAtHeight;
  const ease  = Math.min(1, dt*CAM.ease);

  const horiz  = Math.cos(pitch) * dist;                        // ground distance
  const camY   = Math.max(CAM.minHeight, aimAt + Math.sin(pitch) * dist);
  const targetY = aimAt + Math.max(0, -pitch) * dist * CAM.lookUpGain;

  camera.position.x += ((player.position.x + Math.sin(G.camYaw)*horiz) - camera.position.x)*ease;
  camera.position.z += ((player.position.z + Math.cos(G.camYaw)*horiz) - camera.position.z)*ease;
  camera.position.y += (camY - camera.position.y)*ease;
  camTarget.set(player.position.x, targetY, player.position.z); camera.lookAt(camTarget);

  updateToast(dt);
  drawFinder(dt, f.x, f.z, rx, rz);
  renderer.render(scene, camera);
}
frame();

window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); });
