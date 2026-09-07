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
import { player, applyCosmetics, setAirPose } from './player.js';
import { placeOrbs } from './orbs.js';
import { keys, joy, setCamDist } from './input.js';
import { homeWanderers, summonNearest } from './wanderers.js';
import { spawnPickup } from './inventory.js';
import { drawFinder } from './finder.js';
import { toast, updateToast, initStats, echoToast } from './ui.js';
import { markExplored } from './map.js';
import { openingLine, openingButton } from './onboarding.js';
import { seedFromCode, seedCode } from './rules.js';
import './progress.js';
import './run.js';
import { initGraphics, watchFrameRate } from './graphics.js';
import { updateDayNight, updateStates } from './gathering.js';
import { updatePlayer } from './motion.js';
import { updateCamera } from './camera.js';
import { wishEcho } from './voice.js';
import { on, emit, EVENTS } from './events.js';
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
    // ALWAYS seeded from the world seed, not just on the bench.
    //
    // This used to be bench-only, and the valley code feature was born broken
    // because of it: two people entering the same code got the same hills and
    // then hunted orbs in completely different places, which makes racing a
    // shared valley meaningless. The terrain was deterministic and the things
    // you actually look for were not.
    //
    // A seed names a WHOLE valley or it names nothing worth sending.
    const rand = makeRng(G.worldSeed ^ 0x5eed);
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

// ---------- the whistle ----------
//
// CRAWLING IS GONE. It existed with no situation that required it: there is no
// stealth in this game, nothing hunts you, and slipping quietly past a camp was
// never worth being slower for. docs/GAME-DESIGN.md's rule is that a mechanic
// with no answer to "what is this for" does not ship, and inventing a stealth
// system to justify a button would have been the exact mistake that document
// exists to prevent. So it goes.
//
// The whistle stays, because it now has an answer. It used to only widen how far
// you could be heard -- a mechanic you cannot see working. Now it calls somebody
// over: an ambush you endure becomes a fight you choose.

// You cannot jump twice. A refusal here rather than a silent no-op in the loop,
// so the rule lives in one place.
on(EVENTS.JUMP, () => {
  if (G.state !== 'play' || G.airborne) return;
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
  if (navigator.vibrate) navigator.vibrate([15, 40, 15]);

  // Naming who is coming is the whole difference between a noise and a summons.
  const coming = summonNearest();
  toast(coming ? `You whistle. ${coming.short} looks up.` : 'You whistle. Nobody answers.', 2);
});

// The button only exists while you are playing, and greys out while the whistle
// is cooling off -- a control that does nothing when pressed teaches people to
// stop pressing it.
const whistleBtn = $('whistleBtn');
whistleBtn.addEventListener('click', () => emit(EVENTS.WHISTLE));
export function refreshWhistleButton() {
  whistleBtn.disabled = G.whistleCd > 0;
}

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

// The card says one thing and then gets out of the way. What an orb IS gets
// explained after the player has picked one up -- see onboarding.js.
$('introLine').textContent = openingLine();
$('startBtn').textContent = openingButton();

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
  refreshWhistleButton(); // greys out while the whistle is cooling off
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

// ---------------------------------------------------------------------------
// The level-up moment.
//
// Announced from the top layer rather than inside progress.js, which would then
// have to import the UI and stop being testable. Crossing into a new RANK is the
// louder of the two events -- "you are an Orbkeeper" lands harder on a
// nine-year-old than "you are level 15" -- so it gets its own line and a longer
// buzz.
// ---------------------------------------------------------------------------
on(EVENTS.LEVEL_UP, ({ level, rank, newRank, reason }) => {
  if (newRank) {
    toast(`Level ${level}. You are a ${rank.name} now — ${rank.slots} slots.`, 4);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 120]);
  } else {
    toast(`Level ${level}, for ${reason}.`, 2.5);
    if (navigator.vibrate) navigator.vibrate([30, 50, 60]);
  }
});

// ---------------------------------------------------------------------------
// Walking somebody else's valley.
//
// The world is generated from a seed, so a code is all it takes to stand in the
// identical valley: same orbs, same camps, same hills. No server, no accounts,
// no chat to moderate -- it satisfies every child-safety rule in CLAUDE.md by
// construction rather than by policing, and it works over a text message.
//
// Entering one reloads with the code in the address bar rather than rebuilding
// the world in place. A reload is the one way to be certain nothing survives
// from the valley before it, and it also makes the address bar shareable.
// ---------------------------------------------------------------------------
$('haveCode').addEventListener('click', () => {
  const box = $('codeEntry');
  box.hidden = !box.hidden;
  if (!box.hidden) $('codeInput').focus();
});

function goToValley() {
  const raw = $('codeInput').value;
  const seed = seedFromCode(raw);
  if (seed === null) {
    // Says what is wrong rather than just refusing. The alphabet has no O, I or
    // S in it precisely because those are what people mistype.
    $('codeError').textContent = 'That is not a valley code. They look like VALE-7K2M9P.';
    return;
  }
  location.search = `?valley=${encodeURIComponent(seedCode(seed).replace('VALE-', ''))}`;
}
$('codeGo').addEventListener('click', goToValley);
$('codeInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') goToValley();
});
