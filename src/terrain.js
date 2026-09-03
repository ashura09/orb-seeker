// terrain.js — how high the ground is, anywhere.
//
// heightAt(x, z) is the single source of truth for the shape of the valley.
// surfaceHeightAt is the one to ask when PLACING something: see the comment on it.
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { CONFIG } from './config.js';
import { WORLD_R, centres } from './regions.js';

export const GROUND_SEGS = CONFIG.world.groundSegments;
export const GROUND_HALF = WORLD_R + CONFIG.terrain.skirt;

const noise = new ImprovedNoise();
let noiseOffset = 0;

// Two octaves is enough for rolling ground: one for the broad shape of the
// valley floor, one for the bumps you actually walk over.
function terrainNoise(x, z) {
  return (
    noise.noise(x * 0.008 + noiseOffset, z * 0.008, 0) * 1.0 +
    noise.noise(x * 0.028 + noiseOffset, z * 0.028, 5.3) * 0.35
  );
}

/**
 * How high the ground is at a point. The one source of truth.
 *
 * Three things add up: rolling noise, the lift of whichever region you are in,
 * and the rim that turns the valley into a bowl. The rim is the piece that
 * stops the world from ending at a visible line -- the ground climbs away from
 * you instead.
 */
// Smooth 0..1 ramp. Used for region edges, because a linear blend gives a swell
// and a smoothstep gives something with a defined lip you can see and walk up.
function smooth01(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

/**
 * How high the ground is at a point. The underlying shape of the valley.
 *
 * Note that almost nothing calls this directly -- things standing on the ground
 * use surfaceHeightAt below, which returns the surface actually being drawn.
 *
 * Three things add up: rolling noise, the region plateaus and basins, and the
 * rim far out that stops the world ending at a visible line.
 */
export function heightAt(x, z) {
  const T = CONFIG.terrain;
  let h = terrainNoise(x, z) * T.amplitude;

  // ----- regions as landforms -----
  //
  // Each centre contributes its lift, faded out toward its own radius. A high
  // `edge` keeps the lift at full strength almost to the border and then drops
  // it quickly, which is what turns the highland into a plateau with sides
  // rather than a gentle hummock. Weighted average, so overlapping regions
  // blend instead of stacking into a tower.
  let wsum = 0,
    lsum = 0;
  for (const c of centres) {
    const r = c.region.radius;
    const d = Math.hypot(x - c.x, z - c.z);
    const inner = r * (0.25 + 0.65 * c.region.edge); // held at full lift
    const w = 1 - smooth01((d - inner) / Math.max(1, r * 1.15 - inner));
    if (w > 0) {
      wsum += w;
      lsum += c.region.lift * w;
    }
  }
  if (wsum > 0) h += (lsum / wsum) * Math.min(1, wsum);

  // ----- the rim, far beyond where you can walk -----
  const rr = Math.hypot(x, z);
  const rise = Math.min(1, Math.max(0, (rr - WORLD_R * T.rimStart) / T.rimSpan));
  h += rise * rise * T.rimHeight;

  return h;
}

// ---------- standing on the ground you can actually SEE ----------
//
// heightAt() is a smooth continuous function. The ground you look at is a mesh
// of flat triangles sampled from it every GROUND_CELL metres. On any curve the
// two disagree, and they disagree in opposite directions depending on which way
// the ground bends:
//
//   convex, like the rising rim  -- the flat triangle sits ABOVE the true curve,
//                                   so you end up walking UNDER the mountain
//   concave, like a hilltop      -- the triangle sits BELOW it, so you walk on
//                                   air and then drop at the next cell edge
//
// So nothing stands on heightAt any more. surfaceHeightAt reproduces the exact
// triangles PlaneGeometry builds, which means the player is always on the
// surface being drawn, however coarse that surface is.
const GROUND_CELL = (GROUND_HALF * 2) / GROUND_SEGS;

/**
 * The height of the rendered ground at a world point.
 *
 * PlaneGeometry splits every cell into two triangles -- (a,b,d) and (b,c,d) --
 * and this picks the same one and interpolates across it, so the answer is the
 * mesh's own surface rather than an approximation of it.
 */
export function surfaceHeightAt(x, z) {
  const gx = (x + GROUND_HALF) / GROUND_CELL;
  const gz = (z + GROUND_HALF) / GROUND_CELL;
  const i = Math.floor(gx),
    j = Math.floor(gz);

  // outside the mesh entirely: fall back to the smooth function
  if (i < 0 || j < 0 || i >= GROUND_SEGS || j >= GROUND_SEGS) return heightAt(x, z);

  const fx = gx - i,
    fz = gz - j;
  const x0 = i * GROUND_CELL - GROUND_HALF,
    x1 = x0 + GROUND_CELL;
  const z0 = j * GROUND_CELL - GROUND_HALF,
    z1 = z0 + GROUND_CELL;

  const ha = heightAt(x0, z0); // a
  const hb = heightAt(x0, z1); // b
  const hc = heightAt(x1, z1); // c
  const hd = heightAt(x1, z0); // d

  // the diagonal runs from b to d, so fx + fz <= 1 is the a-b-d triangle
  return fx + fz <= 1
    ? ha + (hd - ha) * fx + (hb - ha) * fz
    : hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}

// Fine mottling so a region is not a flat wash of one colour.
export function mottle(x, z) {
  const n =
    0.5 +
    0.26 * Math.sin(x * 0.05) * Math.cos(z * 0.043) +
    0.16 * Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.09 - 0.4);
  return Math.min(1, Math.max(0, n));
}

/** A different landscape shape for each seed. Set once, when the world is built. */
export function setNoiseOffset(v) {
  noiseOffset = v;
}
