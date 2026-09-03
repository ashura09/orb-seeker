// scatter.js — where the scenery goes, and how it is drawn.
//
// Two jobs that belong together: deciding the arrangement (stands, clearings,
// paths, a scale hierarchy) and turning the result into as few draw calls as
// possible (one InstancedMesh per model variant).
import * as THREE from 'three';
import { scene, G } from './state.js';
import { CONFIG } from './config.js';
import { PROPS, PROP_MATERIAL, PROP_RADIUS, PROP_SINK, PROP_HEIGHT } from './props.js';
import { WORLD_R, LANDMARKS, centres, regionAt } from './regions.js';
import { surfaceHeightAt } from './terrain.js';

// Every prop you cannot walk through, as a circle on the ground with a known
// top. Built here because placement is what creates them; read by main.js for
// walking collision and for keeping the camera out of the scenery.
export const obstacles = [];

// One InstancedMesh per prop kind, rebuilt on each re-roll with exactly the
// count that was placed, so no capacity is wasted drawing invisible instances.
let propMeshes = [];
const dummy = new THREE.Object3D();
const tint = new THREE.Color();

/**
 * Records a prop as something you cannot walk through -- and, now, as something
 * of a known HEIGHT.
 *
 * The camera used the same list to decide what blocked its view, but the test
 * was flat: a 2.8 m boulder blocked the camera even when it was ten metres up
 * looking down over the top of it. Walking past boulders therefore yanked the
 * camera in and released it again, every few seconds.
 */
function addObstacle(kind, x, z, s) {
  const r = (PROP_RADIUS[kind] || 0) * s;
  if (r <= 0) return;
  const h = (PROP_HEIGHT[kind] || 2) * s - (PROP_SINK[kind] || 0) * s;
  obstacles.push({ x, z, r, top: surfaceHeightAt(x, z) + h });
}

// A cheap deterministic hash in 0..1. Not for cryptography -- for deciding that
// THIS tree is a shade lighter than the one beside it, the same way every time.
function hash01(a, b) {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function buildInstances(placements) {
  for (const m of propMeshes) scene.remove(m);
  propMeshes = [];

  for (const [kind, list] of Object.entries(placements)) {
    if (!list.length) continue;
    const byVariant = new Map();
    for (const p of list) {
      if (!byVariant.has(p.variant)) byVariant.set(p.variant, []);
      byVariant.get(p.variant).push(p);
    }
    for (const [variant, group] of byVariant) {
      const geo = PROPS[kind]?.[variant];
      if (!geo) continue;
      const mesh = new THREE.InstancedMesh(geo, PROP_MATERIAL, group.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const D = CONFIG.detail;
      group.forEach((p, i) => {
        dummy.position.set(p.x, surfaceHeightAt(p.x, p.z) - (PROP_SINK[kind] || 0) * p.s, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Every copy of a model was the exact same colour, which is why 1900
        // props read as fifteen objects repeated. Three.js multiplies the
        // per-instance colour into the baked vertex colours, so a little spread
        // in brightness and warmth costs nothing but the buffer it rides in.
        // Hashed from position, so a rebuild of the same seed looks the same.
        const h1 = hash01(p.x * 3.1, p.z * 2.7);
        const h2 = hash01(p.z * 5.3, p.x * 4.1);
        const v = 1 - D.propTint * 0.5 + D.propTint * h1;
        const w = (h2 - 0.5) * D.propWarmth;
        tint.setRGB(v * (1 + w), v, v * (1 - w));
        mesh.setColorAt(i, tint);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
      propMeshes.push(mesh);
    }
  }
}

/**
 * Decides what stands where, and builds the instanced meshes for it.
 *
 * Everything here is driven by the seeded rng, so the same seed lays out the same
 * valley. Obstacles are rebuilt from scratch each time.
 */
export function scatterScenery(rng) {
  obstacles.length = 0;

  //
  // Every prop used to land on an independent uniform random point. That is the
  // definition of confetti, and no amount of extra scenery fixes it -- more
  // confetti is still confetti. Three ideas, none of them a new model, turn the
  // same props into a landscape.
  const C = CONFIG.composition;

  // CLEARINGS. A wood is only legible when there are gaps to see across.
  // Wall-to-wall trees is a texture; the openings are what make it a place.
  // The spot you start on is always open. Spawning inside a stand means your
  // first sight of the valley is a tree trunk, and the camera jammed against
  // your back trying to get out of it.
  const clearings = [{ x: 0, z: 0, r: 14 }];
  for (let i = 0; i < C.clearings; i++) {
    const a = rng() * Math.PI * 2,
      d = Math.sqrt(rng()) * (WORLD_R - 30);
    clearings.push({
      x: Math.cos(a) * d,
      z: Math.sin(a) * d,
      r: C.clearingRadius * (0.6 + rng() * 0.9),
    });
  }

  // PATHS. A route from each landmark to the next, kept clear of scenery, so
  // the valley reads as somewhere people have walked rather than somewhere a
  // loop scattered trees. The ground is too coarse to tint a track into (about
  // 4.7 m per quad), so a path is a corridor rather than a colour -- which is
  // legible exactly where it matters, through the dense stands.
  const paths = [];
  for (let i = 0; i < centres.length; i++) {
    const p = centres[i],
      q = centres[(i + 1) % centres.length];
    paths.push({ ax: p.x, az: p.z, bx: q.x, bz: q.z });
  }

  const distToPath = (x, z, p) => {
    const dx = p.bx - p.ax,
      dz = p.bz - p.az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - p.ax) * dx + (z - p.az) * dz) / len2));
    return Math.hypot(x - (p.ax + dx * t), z - (p.az + dz * t));
  };

  const inClearing = (x, z) => clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.r);
  const onPath = (x, z) => paths.some((p) => distToPath(x, z, p) < C.pathWidth);

  // A clearing in a real wood is free of TREES, not of grass -- and a footpath
  // has flowers along its edges. Excluding everything left bare green expanses
  // that looked emptier than the confetti did. So ground cover ignores clearings
  // entirely and only thins on the trodden line itself.
  const GROUND_COVER = new Set(['grassTuft', 'flower', 'mushroom', 'fern', 'lily', 'reeds']);

  // STANDS. Things grow in clumps because they seed near each other. A handful
  // of clump centres per region, and most props are placed inside one.
  const stands = [];
  for (const c of centres) {
    for (let i = 0; i < C.standsPerRegion; i++) {
      const a = rng() * Math.PI * 2,
        d = Math.sqrt(rng()) * c.region.radius * 0.8;
      stands.push({
        x: c.x + Math.cos(a) * d,
        z: c.z + Math.sin(a) * d,
        r: C.standRadius * (0.55 + rng() * 0.9),
      });
    }
  }

  // How far into its region a point is: 0 at the centre, 1 at the edge, more
  // beyond. This is NOT the `blend` that regionAt returns -- blend measures how
  // equidistant you are between two regions, which at the middle of the map is
  // maximal. Thinning by that made the very spot you spawn on the emptiest
  // ground in the valley.
  const regionReach = (x, z) => {
    let d = Infinity,
      best = centres[0];
    for (const c of centres) {
      const dd = Math.hypot(x - c.x, z - c.z);
      if (dd < d) {
        d = dd;
        best = c;
      }
    }
    return d / (best.region.radius * 1.15);
  };

  // Only things with a real silhouette are allowed to be giants. A grass tuft
  // scaled to 2.6 is not a landmark, it is a bug.
  const CANOPY = new Set(['conifer', 'broadleaf', 'deadTree', 'boulder']);

  // ----- decide what stands where -----
  const placements = {}; // kind -> [{x, z, s, rot}]
  for (const kind of Object.keys(PROPS)) placements[kind] = [];

  const total = G.propBudget ?? CONFIG.world.props; // low graphics lowers this
  let placed = 0,
    guard = 0;
  while (guard++ < total * 300 && placed < total) {
    let x, z;
    if (stands.length && rng() < C.standShare) {
      const st = stands[(rng() * stands.length) | 0];
      const a = rng() * Math.PI * 2;
      // sqrt spreads points EVENLY over a disc. Without it they pile up in the
      // middle, and every stand grows a dense core with a thin edge -- which is
      // the same mistake the old whole-world scatter made, just smaller.
      const d = Math.sqrt(rng()) * st.r;
      x = st.x + Math.cos(a) * d;
      z = st.z + Math.sin(a) * d;
    } else {
      const a = rng() * Math.PI * 2,
        d = 6 + Math.sqrt(rng()) * (WORLD_R - 16);
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
    }
    if (Math.hypot(x, z) > WORLD_R - 4) continue;

    // Thin out toward a region's border, so one does not stop dead where the
    // next begins.
    const { region } = regionAt(x, z);
    if (rng() < Math.min(1, regionReach(x, z)) * C.edgeThinning) continue;

    // roulette across this region's own vocabulary
    const entries = Object.entries(region.props);
    const sum = entries.reduce((n, [, w]) => n + w, 0);
    let pick = rng() * sum,
      kind = entries[0][0];
    for (const [k, w] of entries) {
      if ((pick -= w) <= 0) {
        kind = k;
        break;
      }
    }

    const variants = PROPS[kind];
    if (!variants || !variants.length) continue; // that model failed to load
    const variant = (rng() * variants.length) | 0;

    // The clearing rules depend on WHAT this is, so they are applied after the
    // kind is known rather than before.
    if (GROUND_COVER.has(kind)) {
      if (onPath(x, z) && rng() < 0.75) continue; // worn thin underfoot
    } else {
      if (inClearing(x, z) || onPath(x, z)) continue; // nothing tall in the open
    }

    const giant = CANOPY.has(kind) && rng() < C.giantChance;
    const s = giant ? C.giantScale * (0.85 + rng() * 0.4) : 0.8 + rng() * 0.55;

    placements[kind].push({ x, z, s, variant, rot: rng() * Math.PI * 2 });
    placed++;
    addObstacle(kind, x, z, s);
  }

  // ----- cliffs around the plateau's lip -----
  //
  // The highland's sides drop about 17 m over 20 m of ground. Ringing that lip
  // with cliff blocks turns a steep grass slope into something that reads as
  // rock, which is what makes it a plateau rather than a hill.
  const highland = centres.find((c) => c.region.name === 'highland');
  if (highland && PROPS.cliff) {
    const R = highland.region.radius;
    const ring = CONFIG.world.cliffRing;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2 + rng() * 0.12;
      const d = R * (0.92 + rng() * 0.16);
      const x = highland.x + Math.cos(a) * d,
        z = highland.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > WORLD_R - 4) continue;
      const kind = rng() < 0.12 && PROPS.cliffCave ? 'cliffCave' : 'cliff';
      const variants = PROPS[kind];
      placements[kind].push({
        x,
        z,
        s: 0.85 + rng() * 0.6,
        variant: (rng() * variants.length) | 0,
        rot: a + Math.PI / 2 + (rng() - 0.5) * 0.5,
      });
      addObstacle(kind, x, z, 0.8);
    }
  }

  // ----- one landmark per region -----
  for (const c of centres) {
    const parts = LANDMARKS[c.region.landmark];
    if (!parts) continue;
    const spin = rng() * Math.PI * 2;
    for (const [kind, ox, oz, rot, sc] of parts) {
      const variants = PROPS[kind];
      if (!variants || !variants.length) continue;
      // rotate the whole arrangement so it is not identically oriented each time
      const x = c.x + ox * Math.cos(spin) - oz * Math.sin(spin);
      const z = c.z + ox * Math.sin(spin) + oz * Math.cos(spin);
      if (Math.hypot(x, z) > WORLD_R - 3) continue;
      placements[kind].push({
        x,
        z,
        s: sc,
        variant: (rng() * variants.length) | 0,
        rot: rot + spin,
      });
      addObstacle(kind, x, z, sc);
    }
  }

  buildInstances(placements);

  buildInstances(placements);
}
