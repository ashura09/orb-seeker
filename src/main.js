// main.js — starts everything, and runs the frame loop.
//
// Read this file first. The imports below are the map of the whole game, and
// frame() at the bottom is the heartbeat: it runs about 60 times a second and
// is the only place that decides what happens in what order.
import * as THREE from 'three';
import './style.css';

import { G, camera, renderer, $, forward } from './state.js';
import { save } from './save.js';
import { buildWorld, surfaceHeightAt } from './world.js';
import { makeRng } from './rng.js';
import { loadProps } from './props.js';
import { setupShadows, buildEnvironment } from './sky.js';
import { setupBloom, render as renderFrame, resize as resizeBloom } from './bloom.js';
import { player, applyCosmetics, setCrawlPose, setAirPose } from './player.js';
import { placeOrbs } from './orbs.js';
import { keys, joy, setCamDist } from './input.js';
import { homeWanderers } from './wanderers.js';
import { spawnPickup } from './inventory.js';
import { drawFinder } from './finder.js';
import { toast, updateToast, initStats, echoToast } from './ui.js';
import { markExplored } from './map.js';
import { initGraphics, watchFrameRate } from './graphics.js';
import { updateDayNight, updateStates } from './gathering.js';
import { updatePlayer } from './motion.js';
import { updateCamera } from './camera.js';
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
const CAM = CONFIG.camera;
G.camPitch = CAM.pitch; // starting elevation
// Zoom is a comfort setting, so it is remembered between visits rather than
// reset to the default every time you open the game.
setCamDist(save.camDist ?? CAM.distance);

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
    // On the bench everything is seeded from the world seed, so orbs and the
    // villagers camped beside them are in the same place on every run.
    const rand = G.bench ? makeRng(G.worldSeed ^ 0x5eed) : undefined;
    placeOrbs(rand);
    homeWanderers(rand);
    if (G.bench) enterBench(); // the terrain exists now, so the player can be stood on it
  })
  .catch((err) => console.error('the valley could not be built:', err));

setupShadows();
buildEnvironment(); // sky-bounce light for every Standard material
initGraphics(); // start low if this phone has struggled before
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

// You cannot jump from a crawl, and you cannot jump twice. Both are refusals
// rather than silent no-ops elsewhere in the loop, so the rule lives in one place.
on(EVENTS.JUMP, () => {
  if (G.state !== 'play' || G.airborne || G.crawling) return;
  G.airborne = true;
  G.vy = CONFIG.player.jumpSpeed;
  G.airY = surfaceHeightAt(player.position.x, player.position.z);
  setAirPose(true);
  if (navigator.vibrate) navigator.vibrate(12);
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
if (new URLSearchParams(location.search).has('tune')) {
  import('./tuner.js')
    .then((m) => m.initTuner())
    .catch((err) => console.error('tuner failed to load:', err));
}

// ---------- the valley remembers ----------
//
// save.wishes has held every sentence the player ever typed, stamped with the
// gathering it belonged to, since the game was written. Nothing ever read it
// back. At the start of a gathering one of them resurfaces, quietly.
//
// Older wishes are preferred: being reminded of something you asked for six
// gatherings ago lands harder than something from last time.
function recallAWish() {
  if (!save.wishes.length) return;
  const oldest = Math.min(...save.wishes.map((w) => w.cycle));
  const candidates = save.wishes.filter((w) => w.cycle === oldest);
  const pick = candidates[(Math.random() * candidates.length) | 0];
  echoToast(wishEcho(pick.text, save.cycles - pick.cycle));
}

$('startBtn').addEventListener('click', () => {
  $('start').classList.add('hidden');
  G.state = 'play';
  setTimeout(recallAWish, 2200); // let the panel clear before the memory arrives
});

// ?bench starts straight away and stands still. Nothing about the view may
// depend on when you happened to press a button or where you happened to walk,
// or the numbers it produces are not comparable with the last run's.
function enterBench() {
  $('start').classList.add('hidden');
  G.state = 'play';
  const B = CONFIG.bench;
  player.position.set(B.x, surfaceHeightAt(B.x, B.z), B.z);
  G.camYaw = B.yaw;
  G.camPitch = B.pitch;
  G.camDist = B.distance;
  G.night = G.nightTarget = B.night;
}

/** Holds the bench scene still against anything the loop would otherwise change. */
function holdBench() {
  const B = CONFIG.bench;
  player.position.x = B.x;
  player.position.z = B.z;
  G.camYaw = B.yaw;
  G.camPitch = B.pitch;
  G.camDist = B.distance;
  G.night = G.nightTarget = B.night;
}

// A hidden tab is a phone in a pocket. Browsers throttle requestAnimationFrame
// there but do not stop it, so the loop kept running and kept spending battery.
// Now it stops scheduling entirely, and on return the timer is stepped once to
// swallow the gap -- otherwise the first frame back carries the whole absence as
// its delta and the game lurches forward.
let running = true;
let rafId = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false;
    // Cancel the frame ALREADY SCHEDULED, not just future ones. Without this,
    // hiding and showing before that callback fires starts a second loop while
    // the first is still queued, and both keep rescheduling -- so every quick
    // app-switch doubled the frame rate cost. A child switching apps hits this
    // constantly.
    cancelAnimationFrame(rafId);
    rafId = 0;
  } else if (!running) {
    running = true;
    timer.update();
    if (!rafId) rafId = requestAnimationFrame(frame);
  }
});

function frame() {
  if (!running) return;
  rafId = requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), CONFIG.loop.maxDelta);
  G.t += dt;
  let mx = joy.x,
    my = joy.y;
  if (G.bench) {
    holdBench();
    mx = my = 0; // input is ignored entirely; the bench does not move
  }
  if (!G.bench && (keys['w'] || keys['arrowup'])) my = -1;
  if (!G.bench && (keys['s'] || keys['arrowdown'])) my = 1;
  if (!G.bench && (keys['a'] || keys['arrowleft'])) mx = -1;
  if (!G.bench && (keys['d'] || keys['arrowright'])) mx = 1;
  if (!G.bench && keys['q']) G.camYaw += CAM.turnSpeed * dt;
  if (!G.bench && keys['e']) G.camYaw -= CAM.turnSpeed * dt;
  // R and F tilt the view up and down on a keyboard
  if (!G.bench && (keys['r'] || keys['f'])) {
    const tilt = (keys['f'] ? 1 : 0) - (keys['r'] ? 1 : 0);
    G.camPitch = Math.max(
      CAM.pitchMin,
      Math.min(CAM.pitchMax, G.camPitch + tilt * CAM.pitchKeySpeed * dt),
    );
  }
  const f = forward(),
    rx = -f.z,
    rz = f.x;

  updateDayNight(dt);
  updatePlayer(dt, mx, my, f, rx, rz);
  updateStates(dt, recallAWish);
  updateCamera(dt);

  watchFrameRate(dt); // drops quality on its own if this phone cannot keep up
  markExplored(dt); // the map remembers where you have walked
  updateToast(dt);
  drawFinder(dt, f.x, f.z, rx, rz);
  renderFrame(); // through the bloom composer when it is on
}
frame();

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  resizeBloom(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
