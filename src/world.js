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
import { PROPS, PROP_MATERIAL, PROP_RADIUS } from './props.js';

export const WORLD_R = CONFIG.world.radius;
export const obstacles = [];

// ---------- what kinds of place exist ----------
//
// `lift` raises or lowers the ground, which is what makes a region read as a
// different landscape rather than a different colour. `props` are relative
// weights, not counts.
const REGIONS = [
  { name: 'meadow',   lift:  0, ground: [0x55984a, 0x6ab558],
    props: { broadleaf: 1.0, shrub: 0.9, flower: 1.2, rock: 0.4 } },
  { name: 'forest',   lift:  2, ground: [0x2c6b38, 0x3a7d45],
    props: { conifer: 3.0, fern: 2.0, mushroom: 0.7, stump: 0.5, fallenLog: 0.4, rock: 0.3 } },
  { name: 'highland', lift: 11, ground: [0x8a8f76, 0x9ba190],
    props: { boulder: 2.2, rock: 1.8, shrub: 0.5 } },
  { name: 'wetland',  lift: -4, ground: [0x4a8f6a, 0x5aa47c],
    props: { reeds: 3.5, broadleaf: 0.3, fern: 0.5, rock: 0.2 } },
  { name: 'burn',     lift:  1, ground: [0x6b5f45, 0x7d6f52],
    props: { deadTree: 1.8, stump: 1.4, fallenLog: 0.5, rock: 0.5 } },
];

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
export function heightAt(x, z){
  const T = CONFIG.terrain;
  let h = terrainNoise(x, z) * T.amplitude;

  const { region, neighbour, blend } = regionAt(x, z);
  h += region.lift * (1 - blend) + neighbour.lift * blend;

  // Distance out from the middle, turned into a 0..1 climb. Squared so the
  // ground stays almost flat where you actually walk and only rears up far away.
  const r = Math.hypot(x, z);
  const rise = Math.min(1, Math.max(0, (r - WORLD_R * T.rimStart) / T.rimSpan));
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
    // the plane is unrotated here, so its x/y are world x/z and z is height
    const x = pos.getX(i), z = pos.getY(i);
    pos.setZ(i, heightAt(x, z));

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

const pondMat = lam(0x4aa6d9);
pondMat.polygonOffset = true; pondMat.polygonOffsetFactor = -2; pondMat.polygonOffsetUnits = -2;
const pond = new THREE.Mesh(new THREE.CircleGeometry(8, 32), pondMat);
pond.rotation.x = -Math.PI / 2;
scene.add(pond);

// The ruin uses the kit's columns rather than plain cylinders, so it is built
// with the rest of the world once the models are in.
let pillars = null;

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

  // ----- build one instanced mesh per kind -----
  for (const m of propMeshes){ scene.remove(m); }
  propMeshes = [];
  // One mesh per (kind, variant): three shapes of pine cost three draw calls,
  // not one per tree.
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
        dummy.position.set(p.x, heightAt(p.x, p.z), p.z);
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

  // ----- the ruin stands on the high ground, the pond lies in the low -----
  const highland = centres.find(c => c.region.name === 'highland') || centres[0];
  if (pillars) scene.remove(pillars);
  const columns = PROPS.column;
  if (columns && columns.length){
    const n = CONFIG.world.pillars;
    pillars = new THREE.InstancedMesh(columns[0], PROP_MATERIAL, n);
    pillars.castShadow = true;
    pillars.receiveShadow = true;
    for (let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2;
      const x = highland.x + Math.cos(a) * 7.5, z = highland.z + Math.sin(a) * 7.5;
      dummy.position.set(x, heightAt(x, z), z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + rng() * 0.5);
      dummy.updateMatrix();
      pillars.setMatrixAt(i, dummy.matrix);
      obstacles.push({ x, z, r: 0.8 });
    }
    pillars.instanceMatrix.needsUpdate = true;
    scene.add(pillars);
  }

  const wetland = centres.find(c => c.region.name === 'wetland') || centres[1] || centres[0];
  pond.position.set(wetland.x, heightAt(wetland.x, wetland.z) + 0.06, wetland.z);
}

