// props.js — the things that stand in the valley.
//
// Every prop used to be one primitive: a tree was a cylinder with a cone on
// top, a rock was a dodecahedron, and that was the whole vocabulary. Four
// shapes for a whole world, identical in every region.
//
// Each prop here is instead built from several primitives MERGED into a single
// geometry with its colours baked into the vertices. That buys two things at
// once: a fir tree can be a trunk plus three stacked tiers and still cost one
// draw call for every fir in the valley, and a region can be given its own
// vocabulary of shapes rather than the same tree tinted differently.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Paints a colour into a geometry's vertices so merged parts keep their own
// colours under a single material.
function paint(geo, hex){
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// part: [geometry, colour, x, y, z, rotX, rotY, rotZ, scale]
function build(parts){
  const pieces = parts.map(([geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1]) => {
    const g = geo.clone();
    g.scale(s, s, s);
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    return paint(g, hex);
  });
  return mergeGeometries(pieces, false);
}

// ---------- the raw primitives, cloned into the shapes below ----------
const cyl  = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg);
const ball = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const dodec = (r, d = 0) => new THREE.DodecahedronGeometry(r, d);

const BARK = 0x6b4a2a, BARK_DARK = 0x4a3520, CHAR = 0x3a3330, ASH = 0x585049;
const NEEDLE = 0x2c6b38, NEEDLE_LIGHT = 0x3a8248, LEAFY = 0x4f9a45, LEAFY_LIGHT = 0x5fae52;
const STONE = 0x8a8f96, STONE_DARK = 0x74797f, MOSS = 0x54793f;
const REED = 0x7a8f4a, REED_DRY = 0x9a9a5a, SHRUB = 0x4a7a3c;

// ---------- the vocabulary ----------
//
// Each entry is a finished geometry. Keys are referenced by world.js when it
// decides what a region is made of.
export const PROPS = {
  // A fir: trunk with three tiers, narrowing upward. Forest.
  conifer: build([
    [cyl(0.16, 0.26, 2.2), BARK, 0, 1.1, 0],
    [cone(1.30, 2.0), NEEDLE,       0, 2.6, 0],
    [cone(1.00, 1.8), NEEDLE_LIGHT, 0, 3.7, 0],
    [cone(0.65, 1.5), NEEDLE,       0, 4.7, 0],
  ]),

  // A round-crowned tree: overlapping canopy balls. Meadow.
  broadleaf: build([
    [cyl(0.20, 0.30, 1.9), BARK, 0, 0.95, 0],
    [ball(1.25, 10, 8), LEAFY,        0,    2.6, 0],
    [ball(0.95, 10, 8), LEAFY_LIGHT,  0.75, 2.3, 0.35],
    [ball(0.85, 10, 8), LEAFY,       -0.65, 2.4, -0.3],
  ]),

  // Burnt: a forked trunk, no canopy at all. Burn.
  deadTree: build([
    [cyl(0.10, 0.24, 3.0), CHAR, 0, 1.5, 0],
    [cyl(0.05, 0.10, 1.4), CHAR, 0.42, 2.7, 0.1, 0, 0, -0.7],
    [cyl(0.04, 0.09, 1.1), CHAR, -0.35, 2.9, -0.15, 0, 0, 0.8],
  ]),

  // What is left after a fire, or a felling. Burn and forest.
  stump: build([
    [cyl(0.38, 0.46, 0.6), BARK_DARK, 0, 0.3, 0],
    [cyl(0.34, 0.34, 0.08), ASH, 0, 0.62, 0],
  ]),

  // A big lump of rock, made of three overlapping ones so it is not a
  // recognisable single solid. Highland.
  boulder: build([
    [dodec(1.15), STONE,      0,    0.55, 0],
    [dodec(0.75), STONE_DARK, 0.85, 0.35, 0.2],
    [dodec(0.55), STONE,     -0.6,  0.3, -0.45],
    [dodec(0.30), MOSS,       0.1,  1.35, 0.1],
  ]),

  // A plain small rock. Everywhere.
  rock: build([
    [dodec(0.85), STONE, 0, 0.42, 0],
  ]),

  // A clump of reeds. Wetland.
  reeds: build([
    [cone(0.07, 1.6, 4), REED,     0,     0.8, 0],
    [cone(0.06, 1.9, 4), REED,     0.22,  0.95, 0.12, 0, 0, -0.12],
    [cone(0.06, 1.4, 4), REED_DRY, -0.20, 0.7, 0.18, 0, 0, 0.15],
    [cone(0.05, 1.7, 4), REED,     0.08,  0.85, -0.24, 0, 0, 0.08],
    [cone(0.05, 1.2, 4), REED_DRY, -0.14, 0.6, -0.14, 0, 0, -0.1],
  ]),

  // Low scrub. Meadow and highland.
  shrub: build([
    [ball(0.52, 8, 6), SHRUB,  0,    0.4, 0],
    [ball(0.38, 8, 6), LEAFY,  0.4,  0.3, 0.15],
    [ball(0.34, 8, 6), SHRUB, -0.32, 0.28, -0.2],
  ]),

  // Ground cover for the forest floor.
  fern: build([
    [cone(0.42, 0.7, 5), MOSS,   0,    0.35, 0,    0.35, 0, 0],
    [cone(0.38, 0.6, 5), SHRUB,  0.25, 0.3, 0.2,  -0.3, 0, 0.3],
    [cone(0.36, 0.6, 5), MOSS,  -0.22, 0.3, -0.18, 0.2, 0, -0.35],
  ]),
};

// One shared material: colour comes from the baked vertex colours, so every
// prop kind can use the same one.
export const PROP_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

// Roughly how wide each prop is at the base, for collision.
export const PROP_RADIUS = {
  conifer: 0.55, broadleaf: 0.6, deadTree: 0.35, stump: 0.5,
  boulder: 1.4, rock: 0.7, reeds: 0.0, shrub: 0.0, fern: 0.0,
};
