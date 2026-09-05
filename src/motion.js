// motion.js — walking, wading, collision, gravity and the walk cycle.
//
// Everything here is about where the player's body is this frame. What that body
// LOOKS like lives in player.js; what the camera does about it lives in camera.js.
import { G } from './state.js';
import { CONFIG } from './config.js';
import {
  player,
  armL,
  armR,
  handL,
  handR,
  legL,
  legR,
  tailSegs,
  cosmetics,
  setAirPose,
} from './player.js';
import { WORLD_R, obstacles, surfaceHeightAt, isInWater } from './world.js';
import { worn } from './loadout.js';
import { orbs, collect, updateOrbLights, updateVanish } from './orbs.js';
import { updateBurst } from './burst.js';
import { updateWishStones, readNearbyWish } from './wishstones.js';
import { toast } from './ui.js';
import { pickups, collectPickup } from './inventory.js';
import { updateWanderers } from './wanderers.js';

const P = CONFIG.player;
const ORB = CONFIG.orbs;
let bob = 0;

/** One frame of the player's body: where it goes, and how it is holding itself. */
export function updatePlayer(dt, mx, my, f, rx, rz) {
  if (G.state === 'play') {
    const len = Math.hypot(mx, my);
    let moving = false;
    if (len > 0.08) {
      // Wading slows you, so water is something you feel rather than something
      // you only look at -- and it gives the wetland a cost as well as a look.
      const wading = isInWater(player.position.x, player.position.z);
      const k =
        Math.min(len, 1) *
        (worn('boots') ? P.bootsMultiplier : 1) *
        (G.crawling ? P.crawlSpeedMultiplier : 1) *
        (wading ? CONFIG.water.wadeSpeed : 1);
      const vx = f.x * -my + rx * mx,
        vz = f.z * -my + rz * mx,
        vl = Math.hypot(vx, vz) || 1;
      player.position.x += (vx / vl) * P.speed * k * dt;
      player.position.z += (vz / vl) * P.speed * k * dt;
      player.rotation.y = Math.atan2(vx, vz);
      bob += dt * P.bobRate * k;
      moving = true;
    }
    const pr = Math.hypot(player.position.x, player.position.z);
    if (pr > WORLD_R) {
      player.position.x *= WORLD_R / pr;
      player.position.z *= WORLD_R / pr;
    }
    for (const ob of obstacles) {
      // If your feet are above it, you pass over it. This is what makes jumping
      // a verb rather than a flourish: rocks, stumps and logs can be cleared,
      // boulders and trees cannot. The height came from the camera work -- the
      // obstacle already had to know how tall it was.
      if (player.position.y > ob.top + P.jumpClearance) continue;
      const dx = player.position.x - ob.x,
        dz = player.position.z - ob.z,
        d = Math.hypot(dx, dz),
        min = ob.r + P.radius;
      if (d < min && d > 0.0001) {
        player.position.x = ob.x + (dx / d) * min;
        player.position.z = ob.z + (dz / d) * min;
      }
    }

    // ----- vertical -----
    const feetGround = surfaceHeightAt(player.position.x, player.position.z);
    if (G.airborne) {
      G.vy -= P.gravity * dt;
      G.airY += G.vy * dt;
      if (G.airY <= feetGround) {
        // landed
        G.airY = feetGround;
        G.vy = 0;
        G.airborne = false;
        setAirPose(false);
        if (navigator.vibrate) navigator.vibrate(18);
      }
      player.position.y = G.airY;
    } else {
      // the walk bounce rides on top of the terrain rather than on top of zero
      player.position.y = feetGround + Math.abs(Math.sin(bob)) * P.bobHeight;
    }
    // arms swing, tail sways -- but not in mid-air, where the jump pose owns
    // the same rotations and the walk cycle would overwrite it every frame.
    if (!G.airborne) {
      armL.rotation.x = moving ? Math.sin(bob) * 0.6 : 0;
      armR.rotation.x = moving ? -Math.sin(bob) * 0.6 : 0;
      handL.position.z = Math.sin(armL.rotation.x) * 0.3;
      handR.position.z = Math.sin(armR.rotation.x) * 0.3;
      // legs swing opposite the arms, which is what walking looks like
      legL.rotation.x = moving ? -Math.sin(bob) * 0.5 : 0;
      legR.rotation.x = moving ? Math.sin(bob) * 0.5 : 0;
    }
    for (const o of orbs) {
      if (o.found) continue;
      o.mesh.position.y = surfaceHeightAt(o.x, o.z) + 1.1 + Math.sin(G.t * 2 + o.phase) * 0.25;
      o.mesh.rotation.y += dt;
      if (Math.hypot(o.x - player.position.x, o.z - player.position.z) < ORB.pickupRadius)
        collect(o);
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.g.position.y =
        surfaceHeightAt(p.g.position.x, p.g.position.z) +
        0.7 +
        Math.sin(G.t * 2.5 + p.phase) * 0.15;
      p.g.rotation.y += dt * 1.2;
      if (Math.hypot(p.g.position.x - player.position.x, p.g.position.z - player.position.z) < 1.5)
        collectPickup(p, i);
    }
    // Standing near a wish stone tells you what you wished for. Only while
    // playing: it would be absurd to read out over a duel or the ceremony.
    readNearbyWish(player.position.x, player.position.z, toast);
    updateWanderers(dt);
  }
  updateOrbLights();
  // Outside the play gate on purpose: a collected orb must finish flaring even
  // if collecting the seventh one opened the ceremony half a second ago.
  updateVanish(dt);
  updateBurst(dt);
  updateWishStones(dt);
  tailSegs.forEach((s, i) => {
    const k = i + 1;
    s.position.set(
      Math.sin(G.t * 3 - k * 0.6) * 0.06 * k,
      0.35 + k * 0.06 + Math.sin(G.t * 2 + k) * 0.02,
      -0.38 - k * 0.09,
    );
  });
  if (cosmetics.charm) cosmetics.charm.rotation.z += dt * 1.5;
}
