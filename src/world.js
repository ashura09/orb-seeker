// world.js — the valley: its regions, ground, scenery and pond.
//
// The valley is divided into REGIONS. Each has its own ground colours and its
// own taste in scenery, so walking for a minute takes you somewhere that looks
// different: out of the meadow, into deep forest, up onto rocky ground.
//
// Everything is generated from a single seed (G.worldSeed) through rng.js, and
// nothing here calls Math.random directly. That is what lets buildWorld() run
// again with a new seed when the orbs scatter, so every gathering is a new
// arrangement of the same kind of place.
//
// It is also the groundwork for streaming terrain later: swap "regions decided
// by a handful of centres" for "regions decided by the chunk you are standing
// in" and the world stops having edges. See rng.js/cellSeed.
import * as THREE from 'three';
import { scene, lam, G } from './state.js';
import { CONFIG } from './config.js';
import { makeRng } from './rng.js';

export const WORLD_R = CONFIG.world.radius;
export const obstacles = [];

// ---------- what kinds of place exist ----------
//
// `trees` and `rocks` are relative weights, not counts: a region with trees 2.6
// gets roughly three times the trees of one with 0.9, out of the same total.
// This is content rather than balance, so it lives here and not in config.js.
const REGIONS = [
  { name: 'meadow',   ground: [0x55984a, 0x6ab558], trees: 1.0, rocks: 0.7, dead: false },
  { name: 'forest',   ground: [0x2c6b38, 0x3a7d45], trees: 3.0, rocks: 0.3, dead: false },
  { name: 'highland', ground: [0x8a8f76, 0x9ba190], trees: 0.3, rocks: 3.0, dead: false },
  { name: 'wetland',  ground: [0x4a8f6a, 0x5aa47c], trees: 0.6, rocks: 0.4, dead: false },
  { name: 'burn',     ground: [0x6b5f45, 0x7d6f52], trees: 0.8, rocks: 0.8, dead: true  },
];

// Where each region sits this time round. Filled in by buildWorld().
let centres = [];

/**
 * Which region a point belongs to, and how strongly.
 *
 * Returns the nearest region plus a blend weight toward the second nearest, so
 * ground colour can fade across a boundary instead of changing on a hard line.
 */
function regionAt(x, z){
  let best = 0, bestD = Infinity, second = 0, secondD = Infinity;
  for (let i = 0; i < centres.length; i++){
    const d = Math.hypot(x - centres[i].x, z - centres[i].z);
    if (d < bestD){ secondD = bestD; second = best; bestD = d; best = i; }
    else if (d < secondD){ secondD = d; second = i; }
  }
  // 0 at the centre of a region, approaching 0.5 at the border with its neighbour
  const blend = secondD === Infinity ? 0 : (bestD / (bestD + secondD));
  return { region: centres[best].region, neighbour: centres[second].region, blend, index: best };
}
export { regionAt };

// ---------- ground ----------
//
// One mesh with the colour painted into its vertices. The valley used to be a
// flat disc with 70 darker circles laid on top, which caused mottled streaking:
// all 70 sat at the same height and overlapped, so they fought for pixels.
// Vertex colours cannot fight themselves, blend smoothly, and cost 70 fewer
// draw calls.
const GROUND_SEGS = CONFIG.world.groundSegments;
const groundGeo = new THREE.PlaneGeometry((WORLD_R + 20) * 2, (WORLD_R + 20) * 2, GROUND_SEGS, GROUND_SEGS);
groundGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(groundGeo.attributes.position.count * 3), 3));

const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Fine mottling on top of the region colour, so a region is not a flat wash.
function mottle(x, z){
  const n = 0.5
    + 0.26 * Math.sin(x * 0.050) * Math.cos(z * 0.043)
    + 0.16 * Math.sin(x * 0.110 + 1.7) * Math.cos(z * 0.090 - 0.4)
    + 0.08 * Math.sin((x + z) * 0.021 + 2.3);
  return Math.min(1, Math.max(0, n));
}

const colA = new THREE.Color(), colB = new THREE.Color(), colOut = new THREE.Color();

function paintGround(){
  const pos = groundGeo.attributes.position;
  const col = groundGeo.attributes.color;
  for (let i = 0; i < pos.count; i++){
    // the plane is unrotated here, so its x/y are world x/z
    const x = pos.getX(i), z = pos.getY(i);
    const { region, neighbour, blend } = regionAt(x, z);
    const m = mottle(x, z);

    colA.setHex(region.ground[0]).lerp(colB.setHex(region.ground[1]), m);
    colB.setHex(neighbour.ground[0]).lerp(colOut.setHex(neighbour.ground[1]), m);
    colOut.copy(colA).lerp(colB, blend);          // soften the border

    col.setXYZ(i, colOut.r, colOut.g, colOut.b);
  }
  col.needsUpdate = true;
}

// ---------- scenery, drawn with InstancedMesh ----------
//
// 90 trees used to be 180 separate objects and up to 180 GPU instructions. An
// InstancedMesh draws them all in one, with a per-copy position and colour.
// The counts are fixed so the buffers never need reallocating -- a re-roll just
// rewrites the matrices.
const COUNTS = { trees: CONFIG.world.trees, rocks: CONFIG.world.rocks, pillars: CONFIG.world.pillars };

const trunkGeo  = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6);
const leafGeo   = new THREE.ConeGeometry(1.2, 3.2, 7);
const rockGeo   = new THREE.DodecahedronGeometry(1, 0);
const pillarGeo = new THREE.CylinderGeometry(0.6, 0.7, 5, 8);

const trunks  = new THREE.InstancedMesh(trunkGeo,  lam(0x6b4a2a), COUNTS.trees);
const leaves  = new THREE.InstancedMesh(leafGeo,   lam(0xffffff), COUNTS.trees);
const rocks   = new THREE.InstancedMesh(rockGeo,   lam(0x8a8f96), COUNTS.rocks);
const pillars = new THREE.InstancedMesh(pillarGeo, lam(0xd9cfb4), COUNTS.pillars);
scene.add(trunks, leaves, rocks, pillars);

// Leaf colour is per-instance, so one mesh covers every shade -- including the
// burnt region, where the leaves are scaled away entirely and only trunks stand.
const LEAF_GREENS = [0x2f7a3c, 0x3d8f45, 0x276b3a].map(c => new THREE.Color(c));

const dummy = new THREE.Object3D();

// The pond is the one flat thing still laid over the ground, so it keeps a
// depth bias to guarantee it wins against the meadow beneath it.
const pondMat = lam(0x4aa6d9);
pondMat.polygonOffset = true; pondMat.polygonOffsetFactor = -2; pondMat.polygonOffsetUnits = -2;
const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 32), pondMat);
pond.rotation.x = -Math.PI / 2;
pond.position.y = 0.04;
scene.add(pond);

/**
 * Builds (or rebuilds) the whole valley from a seed.
 *
 * Called once at startup, and again every time the orbs scatter, so each
 * gathering happens somewhere recognisably the same but arranged anew.
 */
export function buildWorld(seed){
  const rng = makeRng(seed);
  obstacles.length = 0;

  // Scatter the region centres, shuffling which kind of place goes where.
  const order = REGIONS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--){
    const j = (rng() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Spread the centres around the valley rather than letting them clump, and
  // hand each one a region. The shuffle above means the forest is somewhere new
  // every gathering.
  centres = order.map((regionIndex, i) => {
    const a = (i / order.length) * Math.PI * 2 + rng() * 0.9;
    const r = WORLD_R * (0.25 + rng() * 0.5);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, region: REGIONS[regionIndex] };
  });

  paintGround();

  // ----- trees and rocks, weighted by the region they land in -----
  const maxTree = Math.max(...REGIONS.map(r => r.trees));
  const maxRock = Math.max(...REGIONS.map(r => r.rocks));

  // Rejection sampling: throw a dart, keep it with a probability set by how
  // much that region likes this kind of prop. Dense forest therefore fills up
  // and the highland stays bare, without anyone deciding counts by hand.
  function scatter(count, maxWeight, weightOf, place){
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 400){
      const a = rng() * Math.PI * 2;
      const r = 6 + rng() * (WORLD_R - 6);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const { region } = regionAt(x, z);
      if (rng() > weightOf(region) / maxWeight) continue;
      place(x, z, region, placed++);
    }
    return placed;
  }

  const treesPlaced = scatter(COUNTS.trees, maxTree, r => r.trees, (x, z, region, i) => {
    const s = 1 + rng() * 1.4;
    dummy.position.set(x, 0.8 * s, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(s);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);

    // a burnt region keeps its trunks and loses its canopy
    dummy.position.set(x, 3.1 * s, z);
    dummy.scale.setScalar(region.dead ? 0.0001 : s);
    dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(i, LEAF_GREENS[(rng() * 3) | 0]);

    obstacles.push({ x, z, r: 0.9 * s });
  });

  const rocksPlaced = scatter(COUNTS.rocks, maxRock, r => r.rocks, (x, z, region, i) => {
    const s = 0.6 + rng() * 1.6;
    dummy.position.set(x, s * 0.35, z);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.scale.set(s, s * 0.7, s);
    dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
    obstacles.push({ x, z, r: s * 0.9 });
  });

  // Anything not placed is parked out of sight rather than left at the origin,
  // where it would appear as a pile of trees on the player's head.
  for (let i = treesPlaced; i < COUNTS.trees; i++){
    dummy.position.set(0, -500, 0); dummy.scale.setScalar(0.0001); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix); leaves.setMatrixAt(i, dummy.matrix);
  }
  for (let i = rocksPlaced; i < COUNTS.rocks; i++){
    dummy.position.set(0, -500, 0); dummy.scale.setScalar(0.0001); dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }

  // ----- the ruin stands in the rocky ground, the pond sits in the wetland -----
  const highland = centres.find(c => c.region.name === 'highland') || centres[0];
  for (let i = 0; i < COUNTS.pillars; i++){
    const a = (i / COUNTS.pillars) * Math.PI * 2;
    const x = highland.x + Math.cos(a) * 6, z = highland.z + Math.sin(a) * 6;
    const h = 0.5 + rng() * 0.7;
    dummy.position.set(x, 2.5 * h, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, h, 1);
    dummy.updateMatrix(); pillars.setMatrixAt(i, dummy.matrix);
    obstacles.push({ x, z, r: 0.9 });
  }

  const wetland = centres.find(c => c.region.name === 'wetland') || centres[1] || centres[0];
  pond.position.x = wetland.x;
  pond.position.z = wetland.z;

  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  rocks.instanceMatrix.needsUpdate = true;
  pillars.instanceMatrix.needsUpdate = true;
}

// The valley the player arrives in.
buildWorld(G.worldSeed);
