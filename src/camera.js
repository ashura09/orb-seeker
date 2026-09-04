// camera.js — where the camera sits, and what it refuses to sit inside.
//
// The camera orbits the player on a sphere: camYaw spins around, camPitch rides
// up and down, and G.camDist is the radius, which pinch and the wheel change.
import * as THREE from 'three';
import { G, camera } from './state.js';
import { CONFIG } from './config.js';
import { player } from './player.js';
import { surfaceHeightAt, obstacles } from './world.js';

const CAM = CONFIG.camera;
const camTarget = new THREE.Vector3();

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
function clearBehind(dirX, dirZ, want, aimY, camY) {
  const px = player.position.x,
    pz = player.position.z;
  let best = want;
  for (const o of obstacles) {
    if (o.r < CAM.blockRadius) continue; // ferns and flowers do not block a view
    const ox = o.x - px,
      oz = o.z - pz;
    const along = ox * dirX + oz * dirZ;
    if (along <= 0.5 || along - o.r > best) continue; // behind you, or past where we already stop
    const reach = o.r + CAM.clearance;
    const perp = Math.abs(ox * dirZ - oz * dirX);
    if (perp >= reach) continue; // the line passes wide of it

    // DOES THE VIEW PASS OVER IT? This test was missing, and its absence was
    // the whole bug: flat in plan, a 2.8 m boulder blocked the camera even when
    // the camera was ten metres up looking down over its top. Every boulder you
    // walked past therefore hauled the camera in and let it go again.
    //
    // Only a handful of obstacles ever survive the two cheap tests above, so
    // this costs nothing despite being last.
    const f = want > 0.01 ? along / want : 0;
    if (aimY + (camY - aimY) * f > o.top + CAM.overClearance) continue;

    best = Math.min(best, along - Math.sqrt(reach * reach - perp * perp));
  }
  // The floor is minClear, EXCEPT when you have deliberately zoomed closer than
  // that -- then your own choice wins. Clamping to minClear unconditionally
  // pushed the camera back out at the closest zoom, overriding the pinch.
  return Math.max(Math.min(CAM.minClear, want), best);
}

// A hidden tab is a phone in a pocket. Browsers throttle requestAnimationFrame
// there but do not stop it, so the loop kept running and kept spending battery.
// Now it stops scheduling entirely, and on return the timer is stepped once to
// swallow the gap -- otherwise the first frame back carries the whole absence as
// its delta and the game lurches forward.

/** Moves the camera one frame. Called after the player has finished moving. */
export function updateCamera(dt) {
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
  const dist = cine ? CAM.cinematicDistance : G.camDist; // yours, not a constant
  const pitch = G.camPitch; // yours during the ceremony too, so you can look up at the Keeper
  const aimAt = cine ? CAM.cinematicLookAt : CAM.lookAtHeight;
  const ease = Math.min(1, dt * CAM.ease);

  const horizWanted = Math.cos(pitch) * dist; // ground distance
  const groundY = surfaceHeightAt(player.position.x, player.position.z);

  // Scenery must not come between you and the camera -- with trees now up to
  // 2.6x, sitting inside a canopy is easy and there is nothing to see from in
  // there. No raycasting needed: `obstacles` already holds a ground circle per
  // prop, built for walking collision, so this is a line-versus-circle test.
  const dirX = Math.sin(G.camYaw),
    dirZ = Math.cos(G.camYaw);
  const aimY = groundY + aimAt; // the point it looks at
  const camYWanted = aimY + Math.sin(pitch) * dist; // where it would sit unobstructed
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
  const camY = Math.max(wantY, groundUnderCamera + CAM.minHeight);
  const targetY = aimAt + Math.max(0, -pitch) * dist * CAM.lookUpGain;

  camera.position.x += (wantX - camera.position.x) * ease;
  camera.position.z += (wantZ - camera.position.z) * ease;
  camera.position.y += (camY - camera.position.y) * ease;
  camTarget.set(player.position.x, groundY + targetY, player.position.z);
  camera.lookAt(camTarget);
}
