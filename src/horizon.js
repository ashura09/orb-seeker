// horizon.js — hills beyond the part of the valley you can walk.
import * as THREE from 'three';
import { scene, mat } from './state.js';
import { CONFIG } from './config.js';
import * as P from './palette.js';
import { heightAt } from './terrain.js';

// Hills standing beyond the part of the valley you can walk. They have no
// collision and are never reached; their whole job is to be visible past the
// rim so the world reads as continuing rather than stopping.
const hillGeo = new THREE.ConeGeometry(1, 1, 7);
let hills = null;

export function buildHorizon(rng) {
  const T = CONFIG.terrain;
  if (hills) {
    scene.remove(hills);
    hills.geometry.dispose();
  }
  const count = T.hillCount;
  hills = new THREE.InstancedMesh(hillGeo, mat(P.DISTANT_HILLS), count);
  hills.frustumCulled = false;
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng() * 0.35;
    const r = T.hillNear + rng() * (T.hillFar - T.hillNear);
    const h = T.hillMin + rng() * (T.hillMax - T.hillMin);
    const w = h * (0.9 + rng() * 1.3);
    // Planted ON the far ground, which is itself 90 m up by then, with the base
    // sunk a little so they grow out of the mountains rather than sitting on
    // top of them like hats.
    const hx = Math.cos(a) * r,
      hz = Math.sin(a) * r;
    d.position.set(hx, heightAt(hx, hz) + h * 0.5 - h * 0.28, hz);
    d.rotation.set(0, rng() * Math.PI, 0);
    d.scale.set(w, h, w);
    d.updateMatrix();
    hills.setMatrixAt(i, d.matrix);
  }
  hills.instanceMatrix.needsUpdate = true;
  scene.add(hills);
}
