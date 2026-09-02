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

const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6), leafGeo = new THREE.ConeGeometry(1.2, 3.2, 7);
const trunkMat = lam(0x6b4a2a), leafMats = [0x2f7a3c, 0x3d8f45, 0x276b3a].map(c => lam(c));
function addTree(x, z){
  const g = new THREE.Group();
  const tr = new THREE.Mesh(trunkGeo, trunkMat); tr.position.y = 0.8;
  const l = new THREE.Mesh(leafGeo, leafMats[(Math.random()*3)|0]); l.position.y = 3.1;
  g.add(tr, l); const s = 1 + Math.random()*1.4; g.scale.setScalar(s); g.position.set(x, 0, z);
  scene.add(g); obstacles.push({x, z, r:0.9*s});
}

const rockGeo = new THREE.DodecahedronGeometry(1, 0), rockMat = lam(0x8a8f96);
function addRock(x, z){
  const m = new THREE.Mesh(rockGeo, rockMat); const s = 0.6 + Math.random()*1.6;
  m.scale.set(s, s*0.7, s); m.position.set(x, s*0.35, z); m.rotation.y = Math.random()*Math.PI;
  scene.add(m); obstacles.push({x, z, r:s*0.9});
}

const pillarGeo = new THREE.CylinderGeometry(0.6, 0.7, 5, 8), pillarMat = lam(0xd9cfb4);
function addPillar(x, z, h){
  const m = new THREE.Mesh(pillarGeo, pillarMat); m.scale.y = h; m.position.set(x, 2.5*h, z);
  scene.add(m); obstacles.push({x, z, r:0.9});
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
scatter(90, addTree, 8, WORLD_R); scatter(40, addRock, 6, WORLD_R);
for (let i=0;i<8;i++){ const a=i/8*Math.PI*2; addPillar(40+Math.cos(a)*6, -35+Math.sin(a)*6, 0.5+Math.random()*0.7); }
