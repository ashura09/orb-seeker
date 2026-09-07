// water.js — the lake, and how far it can fill before it would drain away.
import * as THREE from 'three';
import { scene } from './state.js';
import { CONFIG } from './config.js';
import * as P from './palette.js';
import { centres } from './regions.js';
import { surfaceHeightAt } from './terrain.js';

// The pond used to be an 8 m opaque blue disc sitting on the grass. This is a
// wide, slightly translucent sheet at a FIXED height in the wetland basin, so
// the shoreline is wherever the terrain happens to cross that level -- an
// outline the landscape draws for itself rather than one drawn by hand.
// Water is the one surface that should NOT be matte: a low roughness lets it
// pick up the sky from the environment map, which is what makes a flat sheet
// read as water rather than as blue paint.
const waterMat = new THREE.MeshStandardMaterial({
  color: P.WATER,
  transparent: true,
  opacity: 0.78,
  roughness: 0.18,
  metalness: 0.05,
  depthWrite: false, // reeds and lilies read through the surface
});
// ---------------------------------------------------------------------------
// THE SHEET
//
// A radial grid rather than a CircleGeometry fan, because a fan has one vertex
// in the middle and the rest on the rim -- nothing in between for a wave to move.
// Built flat in XZ so nothing has to be rotated and the shader can think in world
// terms.
// ---------------------------------------------------------------------------
function sheet(radius, rings, segments) {
  const pos = [];
  const idx = [];
  pos.push(0, 0, 0); // the middle
  for (let i = 1; i <= rings; i++) {
    const r = (i / rings) * radius;
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const at = (ring, seg) => 1 + (ring - 1) * segments + (seg % segments);
  for (let j = 0; j < segments; j++) idx.push(0, at(1, j + 1), at(1, j)); // the fan at the middle
  for (let i = 1; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = at(i, j),
        b = at(i, j + 1),
        c = at(i + 1, j),
        d = at(i + 1, j + 1);
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // How deep the water is over each vertex. Filled in by fillWater, because it
  // depends on where the lake ended up and how high it filled.
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const WAVE = CONFIG.wave;
const waterGeo = sheet(CONFIG.water.radius, WAVE.rings, WAVE.segments);
const water = new THREE.Mesh(waterGeo, waterMat);
water.renderOrder = 1;
scene.add(water);

// ---------------------------------------------------------------------------
// The surface itself: waves in the vertex stage, foam and the shoreline in the
// fragment stage. Both run on the GPU, so an animated lake costs one uniform a
// frame rather than two thousand vertices rewritten on the CPU.
// ---------------------------------------------------------------------------
const uTime = { value: 0 };
waterMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = uTime;
  shader.uniforms.uFoamDepth = { value: WAVE.foamDepth };
  shader.uniforms.uFoam = { value: WAVE.foamStrength };

  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
       attribute float aDepth;
       varying float vDepth;
       uniform float uTime;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vDepth = aDepth;
       // Two crossing swells at different rates, so the surface never repeats
       // in an obvious rhythm. Faded out by depth: real water goes flat as it
       // shelves, and without that the waves march up onto the beach.
       float shallow = smoothstep(0.0, 1.2, aDepth);
       float w = sin(position.x * ${WAVE.scale} + uTime * ${WAVE.speed}) +
                 cos(position.z * ${WAVE.scale * 1.37} - uTime * ${WAVE.speed * 0.8});
       transformed.y += w * ${WAVE.height * 0.5} * shallow;`,
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
       varying float vDepth;
       uniform float uFoamDepth;
       uniform float uFoam;`,
    )
    .replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       // Anything over dry land is not water. Throwing it away here is what
       // makes the lake's edge the TERRAIN's contour rather than the disc it is
       // drawn on -- the shoreline draws itself.
       if (vDepth <= 0.0) discard;
       float foam = 1.0 - smoothstep(0.0, uFoamDepth, vDepth);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), foam * uFoam);
       gl_FragColor.a = mix(gl_FragColor.a, 1.0, foam * 0.6);`,
    );
};

/** Called once a frame. The whole animation is this one number. */
export function updateWater(dt) {
  uTime.value += dt;
}

/** The swell's clock, exposed so it can be checked from outside rather than
 *  taken on trust -- a wave that lives in a shader leaves no other trace. */
export const waveTime = () => uTime.value;

// The height of the water sheet, so main.js can tell when you are wading, and
// how far it reaches -- which is decided by the basin, not by config alone.
export let waterLevel = -999;
export let waterRadius = 0;
export function isInWater(x, z) {
  return (
    Math.hypot(x - water.position.x, z - water.position.z) < waterRadius &&
    surfaceHeightAt(x, z) < waterLevel
  );
}

/**
 * Turns the collected placements into instanced meshes.
 *
 * Called once at the END of buildWorld, after scenery, cliffs and landmarks
 * have all been decided -- it used to run mid-way, which would have left the
 * cliffs and landmarks placed but never drawn.
 *
 * One mesh per (kind, variant): three shapes of pine cost three draw calls, not
 * one per tree.

/**
 * Fills the wetland basin, but only as far as it can HOLD.
 */
export function fillWater() {
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
  const wetland = centres.find((c) => c.region.name === 'wetland') || centres[0];
  const W = CONFIG.water;

  // FIRST, find where the water would actually go. The region's nominal centre
  // is not its low point: the whole valley sits in a bowl of its own, which
  // tilts the wetland so the ground keeps falling away on one side. Filling
  // from the centre of a slope is what produced a sheet hanging in open air.
  // So sweep the region for its genuine low point and pour from there.
  let cx = wetland.x,
    cz = wetland.z,
    low = surfaceHeightAt(cx, cz);
  const search = wetland.region.radius * 0.8;
  for (let dx = -search; dx <= search; dx += 4) {
    for (let dz = -search; dz <= search; dz += 4) {
      if (dx * dx + dz * dz > search * search) continue;
      const x = wetland.x + dx,
        z = wetland.z + dz;
      const h = surfaceHeightAt(x, z);
      if (h < low) {
        low = h;
        cx = x;
        cz = z;
      }
    }
  }

  // The lowest ground on a ring is that shoreline's lip. Fill above it and the
  // lake would drain out over the edge -- which on screen means a sheet with
  // nothing beneath its rim.
  const lipAt = (r) => {
    let lip = Infinity;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 48) {
      lip = Math.min(lip, surfaceHeightAt(cx + Math.cos(a) * r, cz + Math.sin(a) * r));
    }
    return lip - 0.05; // a hair under, for the ground between samples
  };

  // Widest shore first, pulling in until the basin is deep enough to be worth
  // drawing. If none is, draw no water rather than water in the air.
  waterRadius = 0;
  for (let r = W.radius; r >= W.minRadius; r -= 2) {
    const level = Math.min(low + W.depth, lipAt(r));
    if (level - low >= W.minDepth) {
      waterRadius = r;
      waterLevel = level;
      break;
    }
  }

  water.visible = waterRadius > 0;
  if (water.visible) {
    // The geometry is built once at CONFIG.water.radius, so the chosen shore is
    // a scale rather than a rebuilt mesh.
    const scale = waterRadius / W.radius;
    water.scale.setScalar(scale);
    water.position.set(cx, waterLevel, cz);

    // Bake how deep the water is over every vertex. Done here because it needs
    // the level and the centre, which are only decided above -- and done once
    // per valley rather than per frame, since neither moves afterwards.
    const pos = water.geometry.attributes.position;
    const depth = water.geometry.attributes.aDepth;
    for (let i = 0; i < pos.count; i++) {
      const wx = cx + pos.getX(i) * scale;
      const wz = cz + pos.getZ(i) * scale;
      depth.setX(i, waterLevel - surfaceHeightAt(wx, wz));
    }
    depth.needsUpdate = true;
  }
}
