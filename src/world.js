// world.js — the valley: its shape, its regions, and everything standing in it.
//
// Three ideas hold this file together.
//
// 1. THE GROUND HAS HEIGHT. heightAt(x, z) is the single source of truth for
//    how high the ground is anywhere, and everything that stands on it -- the
//    player, the villagers, the orbs, the Keeper -- asks this one function.
//    Height is what actually distinguishes a highland from a wetland; colour
//    alone never did.
//
// 2. REGIONS HAVE THEIR OWN VOCABULARY. A region does not just tint the grass,
//    it decides which SHAPES grow there. Firs and ferns in the forest, reeds in
//    the wetland, charred trunks and stumps in the burn.
//
// 3. THE VALLEY SITS IN A BOWL, AND THE WORLD CONTINUES PAST IT. The ground
//    rises toward the rim and a ring of distant hills stands beyond the part
//    you can walk, so the edge reads as landscape rather than as a wall.
//
// Everything derives from one seed through rng.js, so the valley can be rebuilt
// exactly -- which is what lets it re-roll each gathering, and what would let it
// stream in chunks later.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { scene, lam, G } from './state.js';
import { CONFIG } from './config.js';
import { makeRng } from './rng.js';
import { PROPS, PROP_MATERIAL, PROP_RADIUS, PROP_SINK } from './props.js';

export const WORLD_R = CONFIG.world.radius;
export const obstacles = [];

// ---------- what kinds of place exist ----------
//
// A region is not a tint any more. Each one has:
//
//   lift      how far its ground rises or sinks -- the highland is a genuine
//             plateau, the wetland a genuine basin
//   radius    how far it reaches, and therefore how abrupt its edges are
//   edge      0..1: how sharply the lift falls off at the border. High values
//             give a plateau with sides you can see; low values give a swell
//             you barely notice crossing
//   props     what grows there, as relative weights
//   landmark  one built thing at its centre, so there is somewhere to walk TO
//             that is not an orb
const REGIONS = [
  { name: 'meadow',   lift:   1, radius: 74, edge: 0.35,
    ground: [0x55984a, 0x6ab558],
    props: { broadleaf: 1.0, shrub: 0.8, flower: 2.0, grassTuft: 2.5, rock: 0.3 },
    landmark: 'field' },

  { name: 'forest',   lift:   4, radius: 70, edge: 0.5,
    ground: [0x2c6b38, 0x3a7d45],
    props: { conifer: 4.0, fern: 3.0, mushroom: 1.2, stump: 0.6, fallenLog: 0.5, shrub: 0.8 },
    landmark: 'camp' },

  { name: 'highland', lift:  17, radius: 62, edge: 0.86,   // steep sides: a plateau
    ground: [0x8a8f76, 0x9ba190],
    props: { boulder: 2.4, rock: 2.0, shrub: 0.4, grassTuft: 0.5 },
    landmark: 'ruin' },

  { name: 'wetland',  lift:  -7, radius: 68, edge: 0.55,   // a basin that holds water
    ground: [0x4a8f6a, 0x5aa47c],
    props: { reeds: 4.0, bamboo: 1.2, lily: 0.6, fern: 0.8, broadleaf: 0.25 },
    landmark: 'landing' },

  { name: 'burn',     lift:   0, radius: 66, edge: 0.4,
    ground: [0x6b5f45, 0x7d6f52],
    props: { deadTree: 2.2, stump: 1.8, fallenLog: 0.7, rock: 0.5 },
    landmark: 'marker' },
];

// What each landmark is made of: [kind, x, z, rotation, scale] around the
// region's centre. These are the things you see from across the valley and walk
// toward, and they are why the kit's tents, fences and bridges are here at all.
const LANDMARKS = {
  field: [
    ['fence', -6, -4, 0, 1], ['fence', -3, -4, 0, 1], ['fence', 0, -4, 0, 1],
    ['fence', 3, -4, 0, 1],  ['gate', 6, -4, 0, 1],
    ['fence', -6, 5, 0, 1],  ['fence', -3, 5, 0, 1], ['fence', 0, 5, 0, 1],
    ['shrub', -2, 0, 0.4, 1.4], ['shrub', 3, 1.5, 1.1, 1.2],
  ],
  camp: [
    ['tent', -2.5, 0, 0.5, 1.3], ['tent', 2.5, 1, -0.9, 1.1],
    ['campfire', 0, 2.5, 0, 1.1],
    ['fallenLog', -2, 4, 0.3, 1.2], ['fallenLog', 2.5, 4, -0.4, 1.2],
  ],
  ruin: [
    ['column', -6, 0, 0, 1], ['column', 6, 0, 0, 1],
    ['column', 0, -6, 0, 1], ['column', 0, 6, 0, 1],
    ['column', -4.3, -4.3, 0, 0.9], ['column', 4.3, 4.3, 0, 0.9],
    ['statueRing', 0, 0, 0, 1.4], ['statueHead', -2, 3, 0.7, 1],
  ],
  landing: [
    ['bridge', 0, 0, 0, 1.6], ['bridgeSide', -2.2, 0, 0, 1.6], ['bridgeSide', 2.2, 0, 0, 1.6],
    ['canoe', 4, 3, 0.8, 1.2],
    ['reeds', -3, 2, 0, 1.4], ['reeds', 3, -2, 0, 1.4],
  ],
  marker: [
    ['statueBlock', 0, 0, 0, 1.2],
    ['deadTree', -4, 2, 0, 1.1], ['deadTree', 4, -2, 0, 0.9],
    ['stump', -2, -3, 0, 1.3], ['stump', 3, 3, 0, 1.2],
  ],
};

let centres = [];

/** Which region a point belongs to, plus a blend toward its neighbour. */
const DEFAULT_REGION = { name: 'meadow', lift: 0, ground: [0x55984a, 0x6ab558], props: {} };

export function regionAt(x, z){
  // The world is built only once the models have loaded, so this can be asked
  // before there are any regions. Answer sensibly rather than throwing.
  if (!centres.length) return { region: DEFAULT_REGION, neighbour: DEFAULT_REGION, blend: 0 };
  let best = 0, bestD = Infinity, second = 0, secondD = Infinity;
  for (let i = 0; i < centres.length; i++){
    const d = Math.hypot(x - centres[i].x, z - centres[i].z);
    if (d < bestD){ secondD = bestD; second = best; bestD = d; best = i; }
    else if (d < secondD){ secondD = d; second = i; }
  }
  const blend = secondD === Infinity ? 0 : bestD / (bestD + secondD);
  return { region: centres[best].region, neighbour: centres[second].region, blend };
}

// ---------- height ----------
const noise = new ImprovedNoise();
let noiseOffset = 0;

// Two octaves is enough for rolling ground: one for the broad shape of the
// valley floor, one for the bumps you actually walk over.
function terrainNoise(x, z){
  return noise.noise(x * 0.008 + noiseOffset, z * 0.008, 0) * 1.0
       + noise.noise(x * 0.028 + noiseOffset, z * 0.028, 5.3) * 0.35;
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
function smooth01(t){
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
export function heightAt(x, z){
  const T = CONFIG.terrain;
  let h = terrainNoise(x, z) * T.amplitude;

  // ----- regions as landforms -----
  //
  // Each centre contributes its lift, faded out toward its own radius. A high
  // `edge` keeps the lift at full strength almost to the border and then drops
  // it quickly, which is what turns the highland into a plateau with sides
  // rather than a gentle hummock. Weighted average, so overlapping regions
  // blend instead of stacking into a tower.
  let wsum = 0, lsum = 0;
  for (const c of centres){
    const r = c.region.radius;
    const d = Math.hypot(x - c.x, z - c.z);
    const inner = r * (0.25 + 0.65 * c.region.edge);   // held at full lift
    const w = 1 - smooth01((d - inner) / Math.max(1, r * 1.15 - inner));
    if (w > 0){ wsum += w; lsum += c.region.lift * w; }
  }
  if (wsum > 0) h += lsum / wsum * Math.min(1, wsum);

  // ----- the rim, far beyond where you can walk -----
  const rr = Math.hypot(x, z);
  const rise = Math.min(1, Math.max(0, (rr - WORLD_R * T.rimStart) / T.rimSpan));
  h += rise * rise * T.rimHeight;

  return h;
}

// ---------- ground ----------
const GROUND_SEGS = CONFIG.world.groundSegments;
const GROUND_HALF = WORLD_R + CONFIG.terrain.skirt;
const groundGeo = new THREE.PlaneGeometry(GROUND_HALF * 2, GROUND_HALF * 2, GROUND_SEGS, GROUND_SEGS);
groundGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(groundGeo.attributes.position.count * 3), 3));

const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;   // casts nothing -- there is nothing beneath it
scene.add(ground);

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
export function surfaceHeightAt(x, z){
  const gx = (x + GROUND_HALF) / GROUND_CELL;
  const gz = (z + GROUND_HALF) / GROUND_CELL;
  const i = Math.floor(gx), j = Math.floor(gz);

  // outside the mesh entirely: fall back to the smooth function
  if (i < 0 || j < 0 || i >= GROUND_SEGS || j >= GROUND_SEGS) return heightAt(x, z);

  const fx = gx - i, fz = gz - j;
  const x0 = i * GROUND_CELL - GROUND_HALF, x1 = x0 + GROUND_CELL;
  const z0 = j * GROUND_CELL - GROUND_HALF, z1 = z0 + GROUND_CELL;

  const ha = heightAt(x0, z0);   // a
  const hb = heightAt(x0, z1);   // b
  const hc = heightAt(x1, z1);   // c
  const hd = heightAt(x1, z0);   // d

  // the diagonal runs from b to d, so fx + fz <= 1 is the a-b-d triangle
  return (fx + fz <= 1)
    ? ha + (hd - ha) * fx + (hb - ha) * fz
    : hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}

// Fine mottling so a region is not a flat wash of one colour.
function mottle(x, z){
  const n = 0.5
    + 0.26 * Math.sin(x * 0.050) * Math.cos(z * 0.043)
    + 0.16 * Math.sin(x * 0.110 + 1.7) * Math.cos(z * 0.090 - 0.4);
  return Math.min(1, Math.max(0, n));
}

const colA = new THREE.Color(), colB = new THREE.Color(), colOut = new THREE.Color();

function shapeGround(){
  const pos = groundGeo.attributes.position;
  const col = groundGeo.attributes.color;
  for (let i = 0; i < pos.count; i++){
    // MIND THE SIGN. The plane is still unrotated here: it lies in local XY and
    // gets rotated -90 degrees about X to lie flat. That rotation maps local +y
    // to world -z, so the world coordinate of this vertex is (x, height, -y).
    //
    // Sampling heightAt(x, +y) built the terrain from a MIRRORED copy of the
    // height function, while the player, props, orbs and villagers all used the
    // true one. Everything was placed up to 9 m off the visible surface: props
    // floated or sank, and walking onto high ground dropped you through the
    // floor.
    const x = pos.getX(i), z = -pos.getY(i);
    pos.setZ(i, heightAt(x, z));

    // same corrected z: the ground colours were mirrored too, which is why the
    // forest's dark green never sat under the actual forest
    const { region, neighbour, blend } = regionAt(x, z);
    const m = mottle(x, z);
    colA.setHex(region.ground[0]).lerp(colB.setHex(region.ground[1]), m);
    colB.setHex(neighbour.ground[0]).lerp(colOut.setHex(neighbour.ground[1]), m);
    colOut.copy(colA).lerp(colB, blend);
    col.setXYZ(i, colOut.r, colOut.g, colOut.b);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  groundGeo.computeVertexNormals();   // so the light catches the slopes
}

// ---------- the horizon ----------
//
// Hills standing beyond the part of the valley you can walk. They have no
// collision and are never reached; their whole job is to be visible past the
// rim so the world reads as continuing rather than stopping.
const hillGeo = new THREE.ConeGeometry(1, 1, 7);
let hills = null;

function buildHorizon(rng){
  const T = CONFIG.terrain;
  if (hills){ scene.remove(hills); hills.geometry.dispose(); }
  const count = T.hillCount;
  hills = new THREE.InstancedMesh(hillGeo, lam(0x6f8570), count);
  hills.frustumCulled = false;
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++){
    const a = (i / count) * Math.PI * 2 + rng() * 0.35;
    const r = T.hillNear + rng() * (T.hillFar - T.hillNear);
    const h = T.hillMin + rng() * (T.hillMax - T.hillMin);
    const w = h * (0.9 + rng() * 1.3);
    // Planted ON the far ground, which is itself 90 m up by then, with the base
    // sunk a little so they grow out of the mountains rather than sitting on
    // top of them like hats.
    const hx = Math.cos(a) * r, hz = Math.sin(a) * r;
    d.position.set(hx, heightAt(hx, hz) + h * 0.5 - h * 0.28, hz);
    d.rotation.set(0, rng() * Math.PI, 0);
    d.scale.set(w, h, w);
    d.updateMatrix();
    hills.setMatrixAt(i, d.matrix);
  }
  hills.instanceMatrix.needsUpdate = true;
  scene.add(hills);
}

// ---------- scenery ----------
//
// One InstancedMesh per prop kind, rebuilt on each re-roll with exactly the
// count that was placed, so no capacity is wasted drawing invisible instances.
let propMeshes = [];
const dummy = new THREE.Object3D();

// ---------- water ----------
//
// The pond used to be an 8 m opaque blue disc sitting on the grass. This is a
// wide, slightly translucent sheet at a FIXED height in the wetland basin, so
// the shoreline is wherever the terrain happens to cross that level -- an
// outline the landscape draws for itself rather than one drawn by hand.
const waterMat = new THREE.MeshLambertMaterial({
  color: 0x3f8fbf, transparent: true, opacity: 0.78,
  depthWrite: false,          // reeds and lilies read through the surface
});
const water = new THREE.Mesh(new THREE.CircleGeometry(CONFIG.water.radius, 48), waterMat);
water.rotation.x = -Math.PI / 2;
water.renderOrder = 1;
scene.add(water);

// The height of the water sheet, so main.js can tell when you are wading, and
// how far it reaches -- which is decided by the basin, not by config alone.
export let waterLevel = -999;
export let waterRadius = 0;
export function isInWater(x, z){
  return Math.hypot(x - water.position.x, z - water.position.z) < waterRadius
      && surfaceHeightAt(x, z) < waterLevel;
}

// The ruin uses the kit's columns rather than plain cylinders, so it is built
// with the rest of the world once the models are in.
let pillars = null;

/**
 * Turns the collected placements into instanced meshes.
 *
 * Called once at the END of buildWorld, after scenery, cliffs and landmarks
 * have all been decided -- it used to run mid-way, which would have left the
 * cliffs and landmarks placed but never drawn.
 *
 * One mesh per (kind, variant): three shapes of pine cost three draw calls, not
 * one per tree.
 */
function buildInstances(placements){
  for (const m of propMeshes) scene.remove(m);
  propMeshes = [];

  for (const [kind, list] of Object.entries(placements)){
    if (!list.length) continue;
    const byVariant = new Map();
    for (const p of list){
      if (!byVariant.has(p.variant)) byVariant.set(p.variant, []);
      byVariant.get(p.variant).push(p);
    }
    for (const [variant, group] of byVariant){
      const geo = PROPS[kind]?.[variant];
      if (!geo) continue;
      const mesh = new THREE.InstancedMesh(geo, PROP_MATERIAL, group.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.forEach((p, i) => {
        dummy.position.set(p.x, surfaceHeightAt(p.x, p.z) - (PROP_SINK[kind] || 0) * p.s, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      propMeshes.push(mesh);
    }
  }
}

/** Builds, or rebuilds, the entire valley from one seed. */
export function buildWorld(seed){
  const rng = makeRng(seed);
  obstacles.length = 0;
  noiseOffset = (seed % 1000) * 0.37;   // a different landscape shape each time

  // ----- where the regions sit -----
  const order = REGIONS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--){
    const j = (rng() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  centres = order.map((regionIndex, i) => {
    const a = (i / order.length) * Math.PI * 2 + rng() * 0.9;
    const r = WORLD_R * (0.25 + rng() * 0.45);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, region: REGIONS[regionIndex] };
  });

  shapeGround();
  buildHorizon(rng);

  // ----- decide what stands where -----
  const placements = {};                      // kind -> [{x, z, s, rot}]
  for (const kind of Object.keys(PROPS)) placements[kind] = [];

  const total = CONFIG.world.props;
  let guard = 0;
  while (guard++ < total * 300){
    const placed = Object.values(placements).reduce((n, a) => n + a.length, 0);
    if (placed >= total) break;

    const a = rng() * Math.PI * 2;
    const r = 6 + rng() * (WORLD_R - 10);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const { region } = regionAt(x, z);

    // roulette across this region's own vocabulary
    const entries = Object.entries(region.props);
    const sum = entries.reduce((n, [, w]) => n + w, 0);
    let pick = rng() * sum, kind = entries[0][0];
    for (const [k, w] of entries){ if ((pick -= w) <= 0){ kind = k; break; } }

    const variants = PROPS[kind];
    if (!variants || !variants.length) continue;          // that model failed to load
    const variant = (rng() * variants.length) | 0;
    const s = 0.8 + rng() * 0.55;
    placements[kind].push({ x, z, s, variant, rot: rng() * Math.PI * 2 });
    const rad = (PROP_RADIUS[kind] || 0) * s;
    if (rad > 0) obstacles.push({ x, z, r: rad });
  }

  // ----- cliffs around the plateau's lip -----
  //
  // The highland's sides drop about 17 m over 20 m of ground. Ringing that lip
  // with cliff blocks turns a steep grass slope into something that reads as
  // rock, which is what makes it a plateau rather than a hill.
  const highland = centres.find(c => c.region.name === 'highland');
  if (highland && PROPS.cliff){
    const R = highland.region.radius;
    const ring = CONFIG.world.cliffRing;
    for (let i = 0; i < ring; i++){
      const a = (i / ring) * Math.PI * 2 + rng() * 0.12;
      const d = R * (0.92 + rng() * 0.16);
      const x = highland.x + Math.cos(a) * d, z = highland.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > WORLD_R - 4) continue;
      const kind = (rng() < 0.12 && PROPS.cliffCave) ? 'cliffCave' : 'cliff';
      const variants = PROPS[kind];
      placements[kind].push({
        x, z,
        s: 0.85 + rng() * 0.6,
        variant: (rng() * variants.length) | 0,
        rot: a + Math.PI / 2 + (rng() - 0.5) * 0.5,
      });
      obstacles.push({ x, z, r: PROP_RADIUS[kind] * 0.8 });
    }
  }

  // ----- one landmark per region -----
  for (const c of centres){
    const parts = LANDMARKS[c.region.landmark];
    if (!parts) continue;
    const spin = rng() * Math.PI * 2;
    for (const [kind, ox, oz, rot, sc] of parts){
      const variants = PROPS[kind];
      if (!variants || !variants.length) continue;
      // rotate the whole arrangement so it is not identically oriented each time
      const x = c.x + ox * Math.cos(spin) - oz * Math.sin(spin);
      const z = c.z + ox * Math.sin(spin) + oz * Math.cos(spin);
      if (Math.hypot(x, z) > WORLD_R - 3) continue;
      placements[kind].push({ x, z, s: sc, variant: (rng() * variants.length) | 0, rot: rot + spin });
      const rad = (PROP_RADIUS[kind] || 0) * sc;
      if (rad > 0) obstacles.push({ x, z, r: rad });
    }
  }

  buildInstances(placements);

  // ----- water fills the wetland basin, but only as far as it can HOLD -----
  //
  // This line used to read `waterLevel = floor + CONFIG.water.depth`: put the
  // surface a fixed 2.4 m above the ground at the basin's centre and hope the
  // land around it was higher. Usually it was not, so the sheet ended in open
  // air -- measured at up to 8.7 m above the ground beneath its own rim, in 46
  // of 73 directions. That is what a lake floating over the valley looks like.
  //
  // A real lake's level is set by its LOWEST LIP: fill past that and it drains
  // out. So for any candidate shoreline, the level can never be higher than the
  // lowest ground on that ring. Start from the widest shore and pull inward
  // until the basin is genuinely deep enough to be worth drawing; if none is,
  // draw no water at all rather than a sheet hanging in the air.
  //
  // `depth` in config is now a maximum rather than a promise.
  const wetland = centres.find(c => c.region.name === 'wetland') || centres[0];
  const W = CONFIG.water;

  // FIRST, find where the water would actually go. The region's nominal centre
  // is not its low point: the whole valley sits in a bowl of its own, which
  // tilts the wetland so the ground keeps falling away on one side. Filling
  // from the centre of a slope is what produced a sheet hanging in open air.
  // So sweep the region for its genuine low point and pour from there.
  let cx = wetland.x, cz = wetland.z, low = surfaceHeightAt(cx, cz);
  const search = wetland.region.radius * 0.8;
  for (let dx = -search; dx <= search; dx += 4){
    for (let dz = -search; dz <= search; dz += 4){
      if (dx*dx + dz*dz > search*search) continue;
      const x = wetland.x + dx, z = wetland.z + dz;
      const h = surfaceHeightAt(x, z);
      if (h < low){ low = h; cx = x; cz = z; }
    }
  }

  // The lowest ground on a ring is that shoreline's lip. Fill above it and the
  // lake would drain out over the edge -- which on screen means a sheet with
  // nothing beneath its rim.
  const lipAt = r => {
    let lip = Infinity;
    for (let a = 0; a < Math.PI*2; a += Math.PI/48){
      lip = Math.min(lip, surfaceHeightAt(cx + Math.cos(a)*r, cz + Math.sin(a)*r));
    }
    return lip - 0.05;   // a hair under, for the ground between samples
  };

  // Widest shore first, pulling in until the basin is deep enough to be worth
  // drawing. If none is, draw no water rather than water in the air.
  waterRadius = 0;
  for (let r = W.radius; r >= W.minRadius; r -= 2){
    const level = Math.min(low + W.depth, lipAt(r));
    if (level - low >= W.minDepth){ waterRadius = r; waterLevel = level; break; }
  }

  water.visible = waterRadius > 0;
  if (water.visible){
    // The geometry is built once at CONFIG.water.radius, so the chosen shore is
    // a scale rather than a rebuilt mesh.
    water.scale.setScalar(waterRadius / W.radius);
    water.position.set(cx, waterLevel, cz);
  }
}
