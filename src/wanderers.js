// wanderers.js — the seven villagers: where they camp, what they hear, when they
// come for you.
//
// Who they are is villagers.js; what they look like is wandererBody.js.
import { G } from './state.js';
import { player } from './player.js';
import { worn } from './loadout.js';
import { orbs } from './orbs.js';
import { CONFIG } from './config.js';
import { emit, EVENTS } from './events.js';
import { WANDERERS } from './villagers.js';
import { WORLD_R, surfaceHeightAt } from './world.js';
import { buildWanderer } from './wandererBody.js';

export const wanderers = WANDERERS.map((w, i) => {
  const { g, limbs } = buildWanderer(w);
  return {
    ...w,
    g,
    limbs,
    tier: i + 1,
    hx: 0,
    hz: 0,
    tx: 0,
    tz: 0,
    wait: 0,
    cooldown: 0,
    bob: Math.random() * 6,
  };
});

/** @param random  seeded on the bench, so camps land identically every run. */
export function homeWanderers(random = Math.random) {
  wanderers.forEach((w, i) => {
    w.hx = orbs[i].x;
    w.hz = orbs[i].z;
    const W = CONFIG.wanderers;
    const a = random() * Math.PI * 2,
      r = W.campRadiusMin + random() * (W.campRadiusMax - W.campRadiusMin);
    const wx = w.hx + Math.cos(a) * r,
      wz = w.hz + Math.sin(a) * r;
    w.g.position.set(wx, surfaceHeightAt(wx, wz), wz);
    pickTarget(w);
  });
}

export function pickTarget(w) {
  // roam within about 22 m of camp
  const W = CONFIG.wanderers;
  const a = Math.random() * Math.PI * 2,
    r = Math.random() * W.roamRadius;
  w.tx = Math.max(-WORLD_R + 5, Math.min(WORLD_R - 5, w.hx + Math.cos(a) * r));
  w.tz = Math.max(-WORLD_R + 5, Math.min(WORLD_R - 5, w.hz + Math.sin(a) * r));
  w.wait = W.waitMin + Math.random() * (W.waitMax - W.waitMin);
}
homeWanderers();

// Swings arms and legs while walking, and settles them when standing still.
function animateLimbs(w, moving) {
  const swing = moving ? Math.sin(w.bob) : 0;
  w.limbs.arms[0].rotation.x = swing * 0.55;
  w.limbs.arms[1].rotation.x = -swing * 0.55;
  w.limbs.legs[0].rotation.x = -swing * 0.5;
  w.limbs.legs[1].rotation.x = swing * 0.5;
}

export function updateWanderers(dt) {
  // The bench is a still life. Villagers wandering in and out of frame was the
  // last thing making two runs disagree -- 158 draw calls against 176, from the
  // same code.
  if (G.bench) return;

  const W = CONFIG.wanderers;
  // How far you carry. Crawling multiplies the base so it still stacks with the
  // Silver bell; whistling overrides both for as long as the noise lasts.
  let hear = worn('bell') ? W.hearingWithBell : W.hearingRange;
  if (G.crawling) hear *= W.crawlHearingMultiplier;
  if (G.whistleT > 0) hear = Math.max(hear, W.whistleRange);
  for (const w of wanderers) {
    w.cooldown = Math.max(0, w.cooldown - dt);
    const pdx = player.position.x - w.g.position.x,
      pdz = player.position.z - w.g.position.z,
      pd = Math.hypot(pdx, pdz);
    const hunting = pd < hear && w.cooldown === 0 && !G.ceremony;
    if (hunting) {
      w.tx = player.position.x;
      w.tz = player.position.z;
      w.wait = 0;
    }
    const dx = w.tx - w.g.position.x,
      dz = w.tz - w.g.position.z,
      d = Math.hypot(dx, dz);
    if (d > 0.5) {
      const sp = hunting ? W.huntSpeed : W.roamSpeed;
      w.g.position.x += (dx / d) * sp * dt;
      w.g.position.z += (dz / d) * sp * dt;
      w.g.rotation.y = Math.atan2(dx, dz);
      w.bob += dt * W.bobRate;
      w.g.position.y =
        surfaceHeightAt(w.g.position.x, w.g.position.z) + Math.abs(Math.sin(w.bob)) * 0.1;
      animateLimbs(w, true);
    } else {
      w.g.position.y = surfaceHeightAt(w.g.position.x, w.g.position.z);
      w.wait -= dt;
      if (w.wait <= 0) pickTarget(w);
      animateLimbs(w, false);
    }
    if (G.state === 'play' && hunting && pd < W.challengeRange) emit(EVENTS.DUEL_CHALLENGE, w);
  }
}
