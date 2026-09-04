// gathering.js — the arc of one gathering: the light, the ceremony, the re-roll.
//
// A "gathering" is one run through the seven orbs. This file owns the things that
// happen across it rather than in any one frame of walking: night falling, the
// Keeper arriving, the wish, and the valley rearranging itself afterwards.
import { G, scene, DAY, NIGHT, $ } from './state.js';
import { CONFIG } from './config.js';
import { player, cosmetics } from './player.js';
import { paintSky, setNightLevel, followPlayer } from './sky.js';
import { buildWorld } from './world.js';
import { placeOrbs } from './orbs.js';
import { homeWanderers } from './wanderers.js';
import { forgetExplored } from './map.js';
import { randomSeed } from './rng.js';
import { toast } from './ui.js';
import { duel, updateDuel } from './duel.js';
import { keeper, ka, ringOrbs, animateKeeper } from './keeper.js';

const DN = CONFIG.dayNight;
const CER = CONFIG.ceremony;

/** The light for this moment of the day, and the sun's shadow box following you. */
export function updateDayNight(dt) {
  // Repainting the sky walks every dome vertex, so it only happens when the
  // light has actually moved rather than on every single frame.
  const nightBefore = G.night;
  G.night += (G.nightTarget - G.night) * Math.min(1, dt * DN.easeRate);
  if (Math.abs(G.night - nightBefore) > 0.001 || G.t < 0.2) paintSky(G.night);

  // Fog still tracks the sky so the horizon dissolves into it rather than
  // ending against it.
  scene.fog.color.copy(DAY).lerp(NIGHT, G.night);
  setNightLevel(G.night);
  // Gated on `visible`, not just on existence: the lantern is built once and
  // hidden when unworn, and a lantern you took off must not still glow.
  if (cosmetics.lantern?.visible)
    cosmetics.lanternLight.intensity = DN.lanternBase + G.night * DN.lanternNightBoost;

  // the sun and its shadow box travel with you
  followPlayer(player.position.x, player.position.y, player.position.z);

  // the whistle fades, then the cooldown clears
  if (G.whistleT > 0) G.whistleT = Math.max(0, G.whistleT - dt);
  if (G.whistleCd > 0) G.whistleCd = Math.max(0, G.whistleCd - dt);
}

/**
 * The ceremony and what follows it: the orbs rising, the wish, and the valley
 * rearranging itself for the next gathering.
 */
export function updateStates(dt, recallAWish) {
  if (G.state === 'duel') {
    updateDuel(dt);
    const w = duel.w,
      dx = w.g.position.x - player.position.x,
      dz = w.g.position.z - player.position.z;
    player.rotation.y = Math.atan2(dx, dz);
    w.g.rotation.y = Math.atan2(-dx, -dz);
    w.g.position.y = duel.over ? 0 : Math.abs(Math.sin(G.t * 14)) * 0.08;
  }

  if (G.state === 'ending') {
    G.endT += dt;
    const rise = Math.min(G.endT / CER.riseSeconds, 1);
    ringOrbs.forEach(({ m, i }) => {
      const a = (i / 7) * Math.PI * 2 + G.endT * 1.2;
      m.position.set(
        player.position.x + Math.cos(a) * (1.5 + 2 * rise),
        1.5 + 5 * rise + Math.sin(G.endT * 3 + i) * 0.2,
        player.position.z + Math.sin(a) * (1.5 + 2 * rise),
      );
    });
    if (G.endT > CER.keeperGrowDelay)
      keeper.scale.setScalar(
        0.001 + Math.min((G.endT - CER.keeperGrowDelay) / CER.keeperGrowSeconds, 1),
      );
    if (G.endT > CER.wishPromptAt) {
      G.state = 'wish';
      $('wish').classList.remove('hidden');
      const fi = document.querySelector('.wishInput');
      if (fi) fi.focus();
    }
  }
  if (G.state === 'wish')
    ringOrbs.forEach(({ m, i }) => {
      const a = (i / 7) * Math.PI * 2 + G.t * 1.2;
      m.position.set(
        player.position.x + Math.cos(a) * 3.5,
        6.5 + Math.sin(G.t * 3 + i) * 0.2,
        player.position.z + Math.sin(a) * 3.5,
      );
    });
  if (G.ceremony && ka.built) animateKeeper(dt);
  if (G.departT >= 0) {
    G.departT += dt;
    const k = Math.min(G.departT / CER.departSeconds, 1);
    keeper.position.y += dt * 6 * k;
    keeper.scale.setScalar(1 - k * 0.9);
    if (G.departT >= CER.departSeconds) {
      scene.remove(keeper);
      G.departT = -1;
      G.ceremony = false;
      G.nightTarget = 0;
      G.respawnT = CER.respawnSeconds;
      $('hint').style.opacity = 0.75;
    }
  }
  if (G.respawnT > 0) {
    G.respawnT -= dt;
    if (G.respawnT <= 0) {
      G.respawnT = -1;
      // A new gathering is a new arrangement of the valley: the forest, the
      // rocky ground and the wetland all move. Same kind of place, never the
      // same walk twice.
      G.worldSeed = randomSeed();
      buildWorld(G.worldSeed);
      // The valley you mapped no longer exists, so the map starts blank again.
      forgetExplored();
      placeOrbs();
      homeWanderers();
      toast('The valley has shifted, and the seven orbs are scattered again', 3.5);
      setTimeout(recallAWish, 3600);
    }
  }
}
