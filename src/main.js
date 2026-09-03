// main.js — starts everything, and runs the frame loop.
//
// Read this file first. The imports below are the map of the whole game, and
// frame() at the bottom is the heartbeat: it runs about 60 times a second and
// is the only place that decides what happens in what order.
import * as THREE from 'three';
import './style.css';

import { G, scene, camera, renderer, hemi, sun, DAY, NIGHT, $, forward } from './state.js';
import { save } from './save.js';
import { worn } from './loadout.js';
import { WORLD_R, obstacles, buildWorld, surfaceHeightAt, isInWater } from './world.js';
import { randomSeed } from './rng.js';
import { loadProps } from './props.js';
import { paintSky, setupShadows, followPlayer, setNightLevel, buildEnvironment } from './sky.js';
import { setupBloom, render as renderFrame, resize as resizeBloom } from './bloom.js';
import { player, armL, armR, handL, handR, legL, legR, tailSegs, cosmetics, applyCosmetics, setCrawlPose } from './player.js';
import { orbs, collect, placeOrbs, updateOrbLights } from './orbs.js';
import { keys, joy, setCamDist } from './input.js';
import { updateWanderers, homeWanderers } from './wanderers.js';
import { duel, updateDuel } from './duel.js';
import { pickups, collectPickup, spawnPickup } from './inventory.js';
import { drawFinder } from './finder.js';
import { keeper, ka, ringOrbs, animateKeeper } from './keeper.js';
import { toast, updateToast, initStats, echoToast } from './ui.js';
import { wishEcho } from './voice.js';
import { on, EVENTS } from './events.js';
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
// Zoom is a comfort setting, so it is remembered between visits rather than
// reset to the default every time you open the game.
setCamDist(save.camDist ?? CAM.distance);
let bob = 0;

// ---------- build the valley once the models are here ----------
//
// The scenery is 30 glTF models, which load over the network, so the world
// cannot be built at import time any more. The frame loop starts immediately
// and the valley appears a moment later -- which is invisible in practice,
// because the start card is covering the screen while it happens.
//
// Orbs and villagers are placed a second time afterwards: their first placement
// happened on flat ground before the terrain existed, so they would otherwise
// be standing at the wrong height.
loadProps()
  .then(() => {
    buildWorld(G.worldSeed);
    placeOrbs();
    homeWanderers();
  })
  .catch(err => console.error('the valley could not be built:', err));

setupShadows();
buildEnvironment();   // sky-bounce light for every Standard material
setupBloom();

initStats(renderer);

// ---------- crawl and whistle ----------
//
// The two ends of one dial. Villagers notice you at CONFIG.wanderers.hearingRange;
// crawling multiplies that down and whistling forces it up, so you can choose to
// slip past the camp guarding the orb you want -- or call its keeper over when
// you would rather have the fragments.
on(EVENTS.CRAWL_TOGGLE, () => {
  if (G.state !== 'play') return;
  G.crawling = !G.crawling;
  setCrawlPose(G.crawling);
  toast(G.crawling ? 'Crawling. Slower, and harder to hear.' : 'Standing.', 1.6);
});

on(EVENTS.WHISTLE, () => {
  if (G.state !== 'play' || G.whistleCd > 0) return;
  const W = CONFIG.wanderers;
  G.whistleT = W.whistleSeconds;
  G.whistleCd = W.whistleCooldown;
  toast('You whistle. It carries.', 1.8);
  if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
});

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


/**
 * How far the camera may sit behind you before scenery gets in the way.
 *
 * Each obstacle is a circle on the ground. Project it onto the camera's own
 * direction: `along` is how far down that line it sits, `perp` how far it
 * misses to the side. If it misses by less than its own radius plus a margin,
 * the camera has to stop short of it.
 *
 * Roughly 1900 obstacles, a few multiplications each -- cheaper by far than
 * raycasting instanced meshes, and it uses a list that already exists.
 */
function clearBehind(dirX, dirZ, want, aimY, camY){
  const px = player.position.x, pz = player.position.z;
  let best = want;
  for (const o of obstacles){
    if (o.r < CAM.blockRadius) continue;   // ferns and flowers do not block a view
    const ox = o.x - px, oz = o.z - pz;
    const along = ox*dirX + oz*dirZ;
    if (along <= 0.5 || along - o.r > best) continue;   // behind you, or past where we already stop
    const reach = o.r + CAM.clearance;
    const perp = Math.abs(ox*dirZ - oz*dirX);
    if (perp >= reach) continue;                        // the line passes wide of it

    // DOES THE VIEW PASS OVER IT? This test was missing, and its absence was
    // the whole bug: flat in plan, a 2.8 m boulder blocked the camera even when
    // the camera was ten metres up looking down over its top. Every boulder you
    // walked past therefore hauled the camera in and let it go again.
    //
    // Only a handful of obstacles ever survive the two cheap tests above, so
    // this costs nothing despite being last.
    const f = want > 0.01 ? along / want : 0;
    if (aimY + (camY - aimY) * f > o.top + CAM.overClearance) continue;

    best = Math.min(best, along - Math.sqrt(reach*reach - perp*perp));
  }
  // The floor is minClear, EXCEPT when you have deliberately zoomed closer than
  // that -- then your own choice wins. Clamping to minClear unconditionally
  // pushed the camera back out at the closest zoom, overriding the pinch.
  return Math.max(Math.min(CAM.minClear, want), best);
}

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

  // ---------- day and night ----------
  // Repainting the sky walks every dome vertex, so it only happens when the
  // light has actually moved rather than on every single frame.
  const nightBefore = G.night;
  G.night += (G.nightTarget - G.night) * Math.min(1, dt*DN.easeRate);
  if (Math.abs(G.night - nightBefore) > 0.001 || G.t < 0.2) paintSky(G.night);

  // Fog still tracks the sky so the horizon dissolves into it rather than
  // ending against it.
  scene.fog.color.copy(DAY).lerp(NIGHT, G.night);
  setNightLevel(G.night);
  // Gated on `visible`, not just on existence: the lantern is built once and
  // hidden when unworn, and a lantern you took off must not still glow.
  if (cosmetics.lantern?.visible) cosmetics.lanternLight.intensity = DN.lanternBase + G.night*DN.lanternNightBoost;

  // the sun and its shadow box travel with you
  followPlayer(player.position.x, player.position.y, player.position.z);

  // the whistle fades, then the cooldown clears
  if (G.whistleT > 0) G.whistleT = Math.max(0, G.whistleT - dt);
  if (G.whistleCd > 0) G.whistleCd = Math.max(0, G.whistleCd - dt);

  if (G.state === 'play'){
    const len = Math.hypot(mx, my);
    let moving = false;
    if (len > 0.08){
      // Wading slows you, so water is something you feel rather than something
      // you only look at -- and it gives the wetland a cost as well as a look.
      const wading = isInWater(player.position.x, player.position.z);
      const k = Math.min(len, 1)
        * (worn('boots') ? P.bootsMultiplier : 1)
        * (G.crawling ? P.crawlSpeedMultiplier : 1)
        * (wading ? CONFIG.water.wadeSpeed : 1);
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
    // the walk bounce rides on top of the terrain rather than on top of zero
    player.position.y = surfaceHeightAt(player.position.x, player.position.z) + Math.abs(Math.sin(bob))*P.bobHeight;
    // arms swing, tail sways
    armL.rotation.x = moving ? Math.sin(bob)*0.6 : 0; armR.rotation.x = moving ? -Math.sin(bob)*0.6 : 0;
    handL.position.z = Math.sin(armL.rotation.x)*0.3; handR.position.z = Math.sin(armR.rotation.x)*0.3;
    // legs swing opposite the arms, which is what walking looks like
    legL.rotation.x = moving ? -Math.sin(bob)*0.5 : 0; legR.rotation.x = moving ? Math.sin(bob)*0.5 : 0;
    for (const o of orbs){
      if (o.found) continue;
      o.mesh.position.y = surfaceHeightAt(o.x, o.z) + 1.1 + Math.sin(G.t*2 + o.phase)*0.25; o.mesh.rotation.y += dt;
      if (Math.hypot(o.x - player.position.x, o.z - player.position.z) < ORB.pickupRadius) collect(o);
    }
    for (let i = pickups.length-1; i >= 0; i--){
      const p = pickups[i];
      p.g.position.y = surfaceHeightAt(p.g.position.x, p.g.position.z) + 0.7 + Math.sin(G.t*2.5 + p.phase)*0.15; p.g.rotation.y += dt*1.2;
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
  if (G.respawnT > 0){
    G.respawnT -= dt;
    if (G.respawnT <= 0){
      G.respawnT = -1;
      // A new gathering is a new arrangement of the valley: the forest, the
      // rocky ground and the wetland all move. Same kind of place, never the
      // same walk twice.
      G.worldSeed = randomSeed();
      buildWorld(G.worldSeed);
      placeOrbs(); homeWanderers();
      toast('The valley has shifted, and the seven orbs are scattered again', 3.5);
      setTimeout(recallAWish, 3600);
    }
  }

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
  const dist  = cine ? CAM.cinematicDistance : G.camDist;   // yours, not a constant
  const pitch = G.camPitch;   // yours during the ceremony too, so you can look up at the Keeper
  const aimAt = cine ? CAM.cinematicLookAt   : CAM.lookAtHeight;
  const ease  = Math.min(1, dt*CAM.ease);

  const horizWanted = Math.cos(pitch) * dist;                   // ground distance
  const groundY = surfaceHeightAt(player.position.x, player.position.z);

  // Scenery must not come between you and the camera -- with trees now up to
  // 2.6x, sitting inside a canopy is easy and there is nothing to see from in
  // there. No raycasting needed: `obstacles` already holds a ground circle per
  // prop, built for walking collision, so this is a line-versus-circle test.
  const dirX = Math.sin(G.camYaw), dirZ = Math.cos(G.camYaw);
  const aimY = groundY + aimAt;                          // the point it looks at
  const camYWanted = aimY + Math.sin(pitch) * dist;      // where it would sit unobstructed
  const horiz = clearBehind(dirX, dirZ, horizWanted, aimY, camYWanted);
  // The camera is pulled straight down its own line, so height scales with it
  // and the angle you chose is preserved.
  const k = horizWanted > 0.01 ? horiz / horizWanted : 1;

  // Where the camera wants to sit, in world terms.
  const wantX = player.position.x + dirX * horiz;
  const wantZ = player.position.z + dirZ * horiz;

  // The camera sits BEHIND you, which on a slope can put it over ground higher
  // than the ground you are standing on -- and it would then be inside the hill,
  // looking out through the back of it at nothing. So it is held clear of the
  // terrain beneath ITSELF, not beneath the player.
  const groundUnderCamera = surfaceHeightAt(wantX, wantZ);
  const wantY = groundY + aimAt + Math.sin(pitch) * dist * k;
  const camY  = Math.max(wantY, groundUnderCamera + CAM.minHeight);
  const targetY = aimAt + Math.max(0, -pitch) * dist * CAM.lookUpGain;

  camera.position.x += (wantX - camera.position.x)*ease;
  camera.position.z += (wantZ - camera.position.z)*ease;
  camera.position.y += (camY - camera.position.y)*ease;
  camTarget.set(player.position.x, groundY + targetY, player.position.z); camera.lookAt(camTarget);

  updateToast(dt);
  drawFinder(dt, f.x, f.z, rx, rz);
  renderFrame();   // through the bloom composer when it is on
}
frame();

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  resizeBloom(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});
