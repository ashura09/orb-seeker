// motion.js — walking, wading, collision, gravity and the walk cycle.
//
// Everything here is about where the player's body is this frame. What that body
// LOOKS like lives in player.js; what the camera does about it lives in camera.js.
import { G } from './state.js';
import { CONFIG } from './config.js';
import { player, cosmetics, setAirPose, setAnim, updateAnim, updateTail } from './player.js';
import { WORLD_R, obstacles, surfaceHeightAt, supportHeightAt, isInWater } from './world.js';
import { worn } from './loadout.js';
import { orbs, collect, updateOrbLights, updateVanish } from './orbs.js';
import { updateBurst } from './burst.js';
import { updateWishStones, readNearbyWish } from './wishstones.js';
import { updateOnboarding } from './onboarding.js';
import { updateQuests } from './quests.js';
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
    let fast = false;
    if (len > 0.08) {
      // Wading slows you, so water is something you feel rather than something
      // you only look at -- and it gives the wetland a cost as well as a look.
      const wading = isInWater(player.position.x, player.position.z);
      const k =
        Math.min(len, 1) *
        (worn('boots') ? P.bootsMultiplier : 1) *
        (wading ? CONFIG.water.wadeSpeed : 1);
      const vx = f.x * -my + rx * mx,
        vz = f.z * -my + rz * mx,
        vl = Math.hypot(vx, vz) || 1;
      player.position.x += (vx / vl) * P.speed * k * dt;
      player.position.z += (vz / vl) * P.speed * k * dt;
      // No slope limit here, deliberately. I wrote one, then measured the
      // terrain: the steepest metre anywhere in a valley rises 1.14, which any
      // sane limit allows. The hills are meant to be walked. What you could walk
      // through was the CLIFF BLOCKS, whose collision circle was half the size of
      // the block -- fixed in scatter.js. A rule that never fires is dead code.
      player.rotation.y = Math.atan2(vx, vz);
      bob += dt * P.bobRate * k;
      moving = true;
      // Boots make him properly quick, and the sprint clip is the only way that
      // ever showed on screen -- the old sine wave swung at the same angle
      // whatever your speed, so buying boots looked like nothing.
      fast = k > 1.05;
    }
    const pr = Math.hypot(player.position.x, player.position.z);
    if (pr > WORLD_R) {
      player.position.x *= WORLD_R / pr;
      player.position.z *= WORLD_R / pr;
    }
    for (const ob of obstacles) {
      // Low things are STEPS and tall things are WALLS, and the one number
      // that separates them is stepUp. Below it you walk straight on and the
      // support height carries you up; above it you are stopped until you jump
      // over -- or land on top, which now holds you.
      //
      // The old rule needed your feet strictly above `top + clearance`, which
      // meant that the instant you landed on a rock you were exactly level with
      // it, failed the test, and were shoved off sideways. That is why nothing
      // in this valley could be stood on.
      if (ob.top <= player.position.y + P.stepUp) continue;
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
    // What is under your feet, which is the ground OR the top of something you
    // are above. Jumping now has somewhere to land.
    const feetGround = supportHeightAt(player.position.x, player.position.z, player.position.y);
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
    // What he is DOING, stated once a frame. player.js decides whether that is a
    // change and cross-fades if so, so nothing here has to remember what he was
    // doing last frame.
    //
    // This replaces four lines of Math.sin. Those were a metronome: both arms on
    // one sine wave, both legs on its inverse, the same swing at every speed, and
    // nothing whatsoever for jumping, landing, crouching or standing still.
    if (G.airborne) setAnim(G.vy > 0 ? 'jump' : 'fall');
    else if (moving) setAnim(fast ? 'sprint' : 'walk');
    else setAnim('idle');
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
  updateAnim(dt); // advances whichever clip is playing
  updateOnboarding(dt); // only does anything during a player's first valley
  updateQuests(); // counts the metres walked, for the daily quests
  updateTail(G.t);
  if (cosmetics.charm) cosmetics.charm.rotation.z += dt * 1.5;
}
