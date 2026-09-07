// scatter.js — where the scenery goes, and how it is drawn.
//
// Two jobs that belong together: deciding the arrangement (stands, clearings,
// paths, a scale hierarchy) and turning the result into as few draw calls as
// possible (one InstancedMesh per model variant).
import * as THREE from 'three';
import { scene, G } from './state.js';
import { CONFIG } from './config.js';
import { propScale } from './modifiers.js';
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
function addObstacle(kind, x, z, s, radiusMul = 1) {
  const r = (PROP_RADIUS[kind] || 0) * s * radiusMul;
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
  // dispose(), not just remove(). scene.remove unhooks the mesh from the graph
  // but never frees the GPU buffers behind instanceMatrix and instanceColor, so
  // every re-scattered valley leaked them for the rest of the session.
  for (const m of propMeshes) {
    scene.remove(m);
    m.dispose();
  }
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
        // `p.y` is an explicit height, used by the spire, which stacks blocks
        // on top of each other rather than standing them on the ground.
        dummy.position.set(
          p.x,
          p.y ?? surfaceHeightAt(p.x, p.z) - (PROP_SINK[kind] || 0) * p.s,
          p.z,
        );
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
  //
  // A STAND IS A STAND *OF SOMETHING*. This was the thing missing. Every stand
  // used to re-roll the species at each prop, so a clump in the forest came out
  // as conifer-fern-mushroom-stump-log-shrub mixed evenly -- and so did every
  // other clump in the forest. Measured: 4.6 of the 28 kinds appeared in an
  // average 40 m cell, which is why the valley read as "stuff thrown carelessly".
  //
  // Now each stand rolls ONE dominant species when it is created, and most of
  // what grows in it is that. A stand of conifers, then a patch of ferns.
  const rollKind = (region) => {
    const entries = Object.entries(region.props);
    const sum = entries.reduce((n, [, w]) => n + w, 0);
    let pick = rng() * sum;
    for (const [k, w] of entries) if ((pick -= w) <= 0) return k;
    return entries[0][0];
  };

  // Stands are spread over the WHOLE valley by area, not around the region
  // centres. Placing them per-centre put every one of them in the inner half --
  // measured at 931 props inside the half-area ring against 278 outside it --
  // and the rim came out bare. Each stand takes the species of wherever it
  // happens to land, so a region's character still comes from the region.
  const stands = [];
  const standCount = C.standsPerRegion * centres.length;
  let standGuard = 0;
  while (stands.length < standCount && standGuard++ < standCount * 40) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * (WORLD_R - 12); // sqrt = even across the disc
    const x = Math.cos(a) * d,
      z = Math.sin(a) * d;
    const { region } = regionAt(x, z);
    if (!Object.keys(region.props).length) continue;
    stands.push({ x, z, kind: rollKind(region), r: C.standRadius * (0.55 + rng() * 0.9) });
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

  // Low graphics lowers this, and so does the Thin Woods modifier -- which the
  // player chose, and which incidentally buys back draw calls as well as
  // sightlines.
  const total = Math.round((G.propBudget ?? CONFIG.world.props) * propScale());
  let placed = 0,
    guard = 0;
  while (guard++ < total * 300 && placed < total) {
    let x, z;
    let stand = null;
    if (stands.length && rng() < C.standShare) {
      const st = stands[(rng() * stands.length) | 0];
      stand = st;
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
    if (rng() < Math.min(C.edgeThinningMax, Math.min(1, regionReach(x, z)) * C.edgeThinning))
      continue;

    // Inside a stand, its species wins most of the time. The remainder keeps a
    // stand from being a monoculture, which reads as planted rather than grown.
    const inStandSpecies = stand && region.props[stand.kind] && rng() < C.standPurity;
    const kind = inStandSpecies ? stand.kind : rollKind(region);

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

  // ----- the Spire -----
  //
  // One thing you can see from anywhere, so the valley has a centre and the map
  // has something to be a map OF. Every landmark until now was a tent or a fence
  // three metres tall -- you had to be standing next to one to know it existed,
  // which is not what a landmark is for.
  //
  // It stands on the highland, which gives the plateau a reason to exist and the
  // three passes somewhere to lead. Built from the SAME cliff blocks as the ring,
  // stacked and tapering, so it costs no extra draw call at all: more instances
  // of a mesh that is already being drawn.
  const spireAt = centres.find((c) => c.region.name === 'highland');
  if (spireAt && PROPS.cliff) {
    const C = CONFIG.world;
    const base = surfaceHeightAt(spireAt.x, spireAt.z);
    let y = base - 3; // sunk, so the bottom block is bedrock rather than a boulder
    for (let i = 0; i < C.spireBlocks; i++) {
      const t = i / (C.spireBlocks - 1);
      const s = C.spireBase * (1 - t) + C.spireTop * t;
      // A slight lean and drift as it rises, so it reads as stacked rock and not
      // as a telescope. Deterministic: the same seed builds the same spire.
      const drift = C.spireDrift * s;
      const x = spireAt.x + Math.cos(i * 2.399) * drift;
      const z = spireAt.z + Math.sin(i * 2.399) * drift;
      placements.cliff.push({
        x,
        z,
        y,
        s,
        variant: i % PROPS.cliff.length,
        rot: i * 2.399,
      });
      y += 7 * s * C.spireStack; // 7 m is the block's own height
    }
    // One obstacle at the foot of it. You walk around the Spire, not through it.
    obstacles.push({
      x: spireAt.x,
      z: spireAt.z,
      r: C.spireBase * 2.6,
      top: base + 6,
    });
  }

  // ----- cliffs around the plateau's lip -----
  //
  // The highland's sides drop about 17 m over 20 m of ground. Ringing that lip
  // with cliff blocks turns a steep grass slope into something that reads as
  // rock, which is what makes it a plateau rather than a hill.
  const highland = centres.find((c) => c.region.name === 'highland');
  if (highland && PROPS.cliff) {
    const R = highland.region.radius;

    // How many blocks it takes to wall this particular lip.
    //
    // This was a fixed 60. The highland's radius varies with the seed, so a
    // fixed count walled some valleys and left others as a picket fence:
    // measured across five seeds it ranged from 29% solid to 65%. A count is
    // the wrong thing to configure. The SPACING is the thing that matters, and
    // the count follows from the circle it has to go round.
    const ring = Math.max(24, Math.round((2 * Math.PI * R) / CONFIG.world.cliffSpacing));

    // THE PASSES.
    //
    // The ring used to be spaced so widely that every block had a gap to its
    // neighbour: a row of standing stones you walked between, while looking at
    // what appeared to be a continuous rock face. That is what "you can walk
    // through walls" was.
    //
    // Packed tight enough to overlap now -- and then deliberately opened in a
    // few places. A plateau with no way up is scenery; a plateau with three
    // passes is somewhere to go, and the passes are what makes the wall read as
    // a wall rather than as an accident.
    const passes = CONFIG.world.cliffPasses;
    const passWidth = CONFIG.world.cliffPassWidth;
    for (let i = 0; i < ring; i++) {
      const around = i / ring;
      const atAPass = passes.some((p) => Math.abs(((around - p + 1.5) % 1) - 0.5) < passWidth);
      if (atAPass) continue;
      // 1.1 degrees of wobble, which is about a metre of arc. It used to be 6.9
      // degrees -- seven metres, on an eight metre spacing -- so blocks bunched
      // and left holes wide enough to walk through.
      const a = around * Math.PI * 2 + rng() * 0.02;
      // Only a little radial wobble. At 0.92-1.08 the blocks were spread across
      // a band four metres deep rather than sitting on a ring, so neighbours
      // that looked adjacent were nowhere near each other and the wall was full
      // of holes. Enough jitter to not look extruded, not enough to open gaps.
      const d = R * (0.985 + rng() * 0.03);
      const x = highland.x + Math.cos(a) * d,
        z = highland.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > WORLD_R - 4) continue;
      const kind = rng() < 0.12 && PROPS.cliffCave ? 'cliffCave' : 'cliff';
      const variants = PROPS[kind];
      // The scale the block is DRAWN at, which is also the scale it has to be
      // solid at. This used to place the block at 0.85-1.45 and then hand
      // addObstacle a flat 0.8: a cliff drawn six to ten metres across got a
      // collision circle four metres wide, so you could walk in through its
      // edges and straight out the other side. That was the walking through
      // walls -- not the terrain, which never exceeds a 1.14 rise per metre
      // anywhere and is meant to be walkable.
      const scale = 0.85 + rng() * 0.6;
      placements[kind].push({
        x,
        z,
        s: scale,
        variant: (rng() * variants.length) | 0,
        rot: a + Math.PI / 2 + (rng() - 0.5) * 0.5,
      });
      if (kind === 'cliffCave') {
        // A CAVE IS AN ARCH, not a wall. The model has a hole through the
        // middle, so a single circle over it blocks the one part of it that
        // visibly ought to be walkable -- which is worse than the gap it
        // replaced, because now the game looks like it is lying to you.
        //
        // Two pillars instead, set either side of the opening along the wall's
        // own direction, leaving the arch open. You can walk through it, and you
        // still cannot walk through the rock on either side.
        const C = CONFIG.world;
        const tx = -Math.sin(a);
        const tz = Math.cos(a);
        const off = C.cavePillarOffset * scale;
        addObstacle(kind, x + tx * off, z + tz * off, scale, C.cavePillarRadius);
        addObstacle(kind, x - tx * off, z - tz * off, scale, C.cavePillarRadius);
      } else {
        addObstacle(kind, x, z, scale);
      }
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
}
