// world.js — the ground, trees, rocks, pillars and pond.
//
// Everything here is built once when the module is first imported. `obstacles`
// is the list the player collides with, read by main.js each frame.
import * as THREE from 'three';
import { scene, lam } from './state.js';

export const WORLD_R = 150;
export const obstacles = [];

const ground = new THREE.Mesh(new THREE.CircleGeometry(WORLD_R + 20, 64), lam(0x5fa84f));
ground.rotation.x = -Math.PI/2; scene.add(ground);

// 32 segments, not 12: at 3-12 m across, a 12-sided "circle" reads as a polygon.
// The extra triangles are free at this scene's budget.
const patchGeo = new THREE.CircleGeometry(1, 32);
// The patches sit 2 cm above the ground, which is far too little separation for
// the depth buffer to resolve at distance -- that is the mottled flicker on the
// grass. polygonOffset biases them toward the camera in depth space only, so
// they win the depth test everywhere without being visibly lifted.
const patchMat = c => { const m = lam(c); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; return m; };
const patchMats = [patchMat(0x55984a), patchMat(0x6ab558)];
for (let i=0;i<70;i++){
  const m = new THREE.Mesh(patchGeo, patchMats[i%2]);
  const a = Math.random()*Math.PI*2, r = Math.random()*WORLD_R;
  m.rotation.x = -Math.PI/2; m.position.set(Math.cos(a)*r, 0.02, Math.sin(a)*r); m.scale.setScalar(3 + Math.random()*9);
  scene.add(m);
}

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

const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 24), lam(0x4aa6d9));
pond.rotation.x = -Math.PI/2; pond.position.set(-28, 0.04, 22); scene.add(pond);

function scatter(n, fn, minR, maxR){
  for (let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, r = minR + Math.random()*(maxR-minR); fn(Math.cos(a)*r, Math.sin(a)*r); }
}
scatter(90, addTree, 8, WORLD_R); scatter(40, addRock, 6, WORLD_R);
for (let i=0;i<8;i++){ const a=i/8*Math.PI*2; addPillar(40+Math.cos(a)*6, -35+Math.sin(a)*6, 0.5+Math.random()*0.7); }
