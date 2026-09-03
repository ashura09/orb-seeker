// ground.js — the mesh you walk on: its shape, its colour, and its grain.
import * as THREE from 'three';
import { scene, renderer } from './state.js';
import { CONFIG } from './config.js';
import { regionAt } from './regions.js';
import { heightAt, mottle, GROUND_SEGS, GROUND_HALF } from './terrain.js';

const groundGeo = new THREE.PlaneGeometry(
  GROUND_HALF * 2,
  GROUND_HALF * 2,
  GROUND_SEGS,
  GROUND_SEGS,
);
groundGeo.setAttribute(
  'color',
  new THREE.BufferAttribute(new Float32Array(groundGeo.attributes.position.count * 3), 3),
);

const ground = new THREE.Mesh(
  groundGeo,
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    map: makeGroundDetail(),
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true; // casts nothing -- there is nothing beneath it
scene.add(ground);

// ---------- fine detail on the ground ----------
//
// Vertex colours cannot describe anything smaller than a quad, and a quad here
// is about 4.7 m. Up close the ground was therefore perfectly, obviously flat.
// A small greyscale texture tiled over it is multiplied into those colours, so
// there is grain between the vertices without adding a single triangle.
//
// The pattern is built from SINE WAVES AT WHOLE-NUMBER FREQUENCIES, which makes
// it seamless by construction -- each wave completes a whole number of cycles
// across the tile, so the left edge meets the right exactly. No seam to hide.
function makeGroundDetail() {
  const D = CONFIG.detail,
    S = 256;

  // Seamless value noise. The lattice coordinates WRAP at each octave's own
  // period, so the tile's left edge meets its right exactly and there is no
  // seam to hide.
  //
  // The first attempt built this from sin(a*u) * cos(b*v) instead. Those are
  // SEPARABLE -- a function of u times a function of v -- which draws an
  // axis-aligned lattice however many terms you sum, and stamped a visible grid
  // across the whole valley. Raising the frequencies only made a finer grid.
  // The structure was wrong, not the scale.
  const hash = (a, b, period, seed) => {
    a = ((a % period) + period) % period;
    b = ((b % period) + period) % period;
    const n = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const vnoise = (x, y, period, seed) => {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf); // smoothstep, so no creases
    const a = hash(xi, yi, period, seed),
      b = hash(xi + 1, yi, period, seed);
    const c = hash(xi, yi + 1, period, seed),
      d = hash(xi + 1, yi + 1, period, seed);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };

  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const fx = x / S,
        fy = y / S;
      const n =
        0.5 * vnoise(fx * 8, fy * 8, 8, 1) +
        0.3 * vnoise(fx * 17, fy * 17, 17, 2) +
        0.2 * vnoise(fx * 33, fy * 33, 33, 3);
      // Kept near white: this is a MULTIPLIER over the region colours, so a mid
      // grey would simply halve the brightness of the whole valley.
      const g = Math.round(255 * (1 - D.detailDepth * (1 - Math.min(1, Math.max(0, n)))));
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(D.detailRepeat, D.detailRepeat);
  // Mipmaps plus anisotropy, or a tile this small shimmers badly in the distance.
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const colA = new THREE.Color(),
  colB = new THREE.Color(),
  colOut = new THREE.Color();
const colRock = new THREE.Color();

export function shapeGround() {
  const pos = groundGeo.attributes.position;
  const col = groundGeo.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    // MIND THE SIGN. The plane is still unrotated here: it lies in local XY and
    // gets rotated -90 degrees about X to lie flat. That rotation maps local +y
    // to world -z, so the world coordinate of this vertex is (x, height, -y).
    //
    // Sampling heightAt(x, +y) built the terrain from a MIRRORED copy of the
    // height function, while the player, props, orbs and villagers all used the
    // true one. Everything was placed up to 9 m off the visible surface: props
    // floated or sank, and walking onto high ground dropped you through the
    // floor.
    const x = pos.getX(i),
      z = -pos.getY(i);
    pos.setZ(i, heightAt(x, z));

    // same corrected z: the ground colours were mirrored too, which is why the
    // forest's dark green never sat under the actual forest
    const { region, neighbour, blend } = regionAt(x, z);
    const m = mottle(x, z);
    colA.setHex(region.ground[0]).lerp(colB.setHex(region.ground[1]), m);
    colB.setHex(neighbour.ground[0]).lerp(colOut.setHex(neighbour.ground[1]), m);
    colOut.copy(colA).lerp(colB, blend);

    // STEEP GROUND IS ROCK. Grass does not hold on a cliff face, and painting
    // one the same green as the meadow beside it is most of why the terrain
    // read as a bedsheet thrown over furniture. The gradient is measured from
    // the height function itself rather than from the mesh normals, which are
    // not computed until after this loop.
    const D = CONFIG.detail;
    const e = 2.0;
    const grad =
      Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) /
      (2 * e);
    const slope = Math.min(1, grad / D.slopeFull);
    colOut.lerp(colRock.setHex(D.rockColor), slope * D.rockOnSlopes);

    // High ground bleaches in the light; low ground sits damp and dark.
    const h = pos.getZ(i);
    if (h > 6) colOut.lerp(colA.setRGB(1, 1, 0.96), Math.min(1, (h - 6) / 14) * D.dryHigh);
    if (h < 1) colOut.multiplyScalar(1 - Math.min(1, (1 - h) / 6) * D.wetLow);

    col.setXYZ(i, colOut.r, colOut.g, colOut.b);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  groundGeo.computeVertexNormals(); // so the light catches the slopes
}

export { ground, groundGeo };
