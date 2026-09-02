// world.js — the ground, trees, rocks, pillars and pond.
//
// Everything here is built once when the module is first imported. `obstacles`
// is the list the player collides with, read by main.js each frame.
import * as THREE from 'three';
import { scene, lam } from './state.js';

export const WORLD_R = 150;
export const obstacles = [];

// ---------- ground ----------
//
// This used to be a flat green disc with 70 darker circles laid on top as
// "grass patches". That caused the mottled streaking on the meadow: all 70 sat
// at exactly y = 0.02, and 102 pairs of them overlapped, so wherever two
// patches crossed they were perfectly coplanar and fought for the same pixels.
// No depth-offset trick fixes that, because every patch had the same offset.
//
// Instead the variation is now painted into the ground itself as vertex
// colours. One surface means nothing can z-fight, the colour blends smoothly
// instead of ending at a hard circular edge, and it costs 70 fewer draw calls,
// which is what actually matters on a phone.
// 48 x 48 is plenty: the slowest colour wave has a ~57 m period and each cell
// is ~7 m, so the variation is captured with room to spare. 64 doubled the
// triangle count for no visible gain.
const GROUND_SEGS = 48;
const groundGeo = new THREE.PlaneGeometry((WORLD_R + 20) * 2, (WORLD_R + 20) * 2, GROUND_SEGS, GROUND_SEGS);

// Layered sine waves standing in for noise: cheap, and good enough for broad
// meadow mottling. Returns roughly 0..1.
function meadow(x, z){
  const n = 0.50
    + 0.26 * Math.sin(x * 0.050) * Math.cos(z * 0.043)
    + 0.16 * Math.sin(x * 0.110 + 1.7) * Math.cos(z * 0.090 - 0.4)
    + 0.08 * Math.sin((x + z) * 0.021 + 2.3);
  return Math.min(1, Math.max(0, n));
}

// Three greens, blended by that value. Colours are constructed through
// THREE.Color so colour management converts them the same way materials do.
const GRASS_DARK = new THREE.Color(0x55984a);
const GRASS_MID  = new THREE.Color(0x5fa84f);
const GRASS_LIT  = new THREE.Color(0x6ab558);
{
  const pos = groundGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++){
    // the plane is still unrotated here, so its x/y are the world x/z
    const n = meadow(pos.getX(i), pos.getY(i));
    if (n < 0.5) c.copy(GRASS_DARK).lerp(GRASS_MID, n * 2);
    else         c.copy(GRASS_MID).lerp(GRASS_LIT, (n - 0.5) * 2);
    colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// ---------- scenery, drawn with InstancedMesh ----------
//
// Every tree used to be a Group of two Meshes, so 90 trees were 180 separate
// objects and up to 180 separate instructions to the GPU. A phone spends real
// CPU time on each one of those. An InstancedMesh draws any number of copies of
// the same geometry in ONE instruction, with a per-copy position, rotation,
// scale and colour.
//
// The trade: an InstancedMesh is culled all-or-nothing, so every tree is drawn
// even when behind you. That is a good deal here -- triangles are cheap and
// draw calls are not.
const COUNTS = { trees: 90, rocks: 40, pillars: 8 };

const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6);
const leafGeo  = new THREE.ConeGeometry(1.2, 3.2, 7);
const rockGeo  = new THREE.DodecahedronGeometry(1, 0);
const pillarGeo = new THREE.CylinderGeometry(0.6, 0.7, 5, 8);

const trunks  = new THREE.InstancedMesh(trunkGeo,  lam(0x6b4a2a), COUNTS.trees);
const leaves  = new THREE.InstancedMesh(leafGeo,   lam(0xffffff), COUNTS.trees);
const rocks   = new THREE.InstancedMesh(rockGeo,   lam(0x8a8f96), COUNTS.rocks);
const pillars = new THREE.InstancedMesh(pillarGeo, lam(0xd9cfb4), COUNTS.pillars);

// The three leaf greens survive as per-instance colours on one mesh, instead of
// three separate materials. lam(0xffffff) above is a white base so the instance
// colour comes through unchanged.
const LEAF_COLORS = [0x2f7a3c, 0x3d8f45, 0x276b3a].map(c => new THREE.Color(c));

// Scratch objects reused for every instance, so placing 138 things allocates
// nothing. THREE reads .matrix off this dummy rather than taking a new one.
const dummy = new THREE.Object3D();
let nTree = 0, nRock = 0, nPillar = 0;

function addTree(x, z){
  const s = 1 + Math.random()*1.4;
  dummy.position.set(x, 0.8*s, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(s);
  dummy.updateMatrix(); trunks.setMatrixAt(nTree, dummy.matrix);
  dummy.position.set(x, 3.1*s, z);
  dummy.updateMatrix(); leaves.setMatrixAt(nTree, dummy.matrix);
  leaves.setColorAt(nTree, LEAF_COLORS[(Math.random()*3)|0]);
  nTree++;
  obstacles.push({x, z, r:0.9*s});
}

function addRock(x, z){
  const s = 0.6 + Math.random()*1.6;
  dummy.position.set(x, s*0.35, z);
  dummy.rotation.set(0, Math.random()*Math.PI, 0);
  dummy.scale.set(s, s*0.7, s);
  dummy.updateMatrix(); rocks.setMatrixAt(nRock++, dummy.matrix);
  obstacles.push({x, z, r:s*0.9});
}

function addPillar(x, z, h){
  dummy.position.set(x, 2.5*h, z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, h, 1);
  dummy.updateMatrix(); pillars.setMatrixAt(nPillar++, dummy.matrix);
  obstacles.push({x, z, r:0.9});
}

// The pond is the one flat thing still laid over the ground, so it keeps a
// depth bias to guarantee it wins against the meadow beneath it.
const pondMat = lam(0x4aa6d9);
pondMat.polygonOffset = true; pondMat.polygonOffsetFactor = -2; pondMat.polygonOffsetUnits = -2;
const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 32), pondMat);
pond.rotation.x = -Math.PI/2; pond.position.set(-28, 0.04, 22); scene.add(pond);

function scatter(n, fn, minR, maxR){
  for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, r = minR + Math.random()*(maxR-minR); fn(Math.cos(a)*r, Math.sin(a)*r); }
}
scatter(COUNTS.trees, addTree, 8, WORLD_R); scatter(COUNTS.rocks, addRock, 6, WORLD_R);
for (let i=0;i<COUNTS.pillars;i++){ const a=i/COUNTS.pillars*Math.PI*2; addPillar(40+Math.cos(a)*6, -35+Math.sin(a)*6, 0.5+Math.random()*0.7); }

// Instance data is uploaded once, after every instance is placed. Without these
// flags the GPU never sees the matrices and nothing appears.
trunks.instanceMatrix.needsUpdate = true;
leaves.instanceMatrix.needsUpdate = true;
if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
rocks.instanceMatrix.needsUpdate = true;
pillars.instanceMatrix.needsUpdate = true;
scene.add(trunks, leaves, rocks, pillars);
