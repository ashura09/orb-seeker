// cave.js — somewhere indoors.
//
// Ashura asked for a part of the map that is a cave or something inside. The
// valley is otherwise one continuous outdoors, and a game with no interior has
// no change of air in it at all.
//
// WHY IT IS BUILT ON THE GROUND AND NOT DUG INTO IT
//
// The terrain is a HEIGHTFIELD: one height per point, so it cannot have an
// overhang, let alone a roof. Carving a chamber into the hill is not a matter of
// effort, it is impossible in the representation. So the cave is a chamber that
// STANDS on the ground -- a walled, roofed rotunda you walk into at ground level.
// The floor is simply the terrain, which means nothing about walking, falling or
// standing had to change.
//
// WHAT MAKES IT FEEL INDOORS
//
// Darkness, and only darkness. `setNightLevel` already turns the valley's light
// down for nightfall, so stepping inside pushes that same dial toward night while
// you are under the roof. It costs nothing, it eases rather than snapping, and it
// finally gives the BRASS LANTERN a reason to be bought: it is the one item that
// makes the dark navigable, and until now it was jewellery.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from './palette.js';
import { scene, mat, bakeIntoVertices, CHARACTER_MAT } from './state.js';
import { CONFIG } from './config.js';
import { surfaceHeightAt, obstacles } from './world.js';
import { centres } from './regions.js';
import { on, EVENTS } from './events.js';

const C = CONFIG.cave;

let mesh = null;
let mouth = null; // {x, z} of the chamber's centre, once built

/**
 * Build the chamber: a ring of wall segments with a gap for the door, and a
 * cone for the roof, merged into ONE mesh with its colours baked in.
 *
 * One draw call for a building. The same trick as the villagers and the
 * monkey's head: parts that never move relative to each other have no business
 * being separate objects.
 */
function build(x, z) {
  const ground = surfaceHeightAt(x, z);
  const parts = [];

  const wallMat = mat(P.darken(P.ROCK_FACE, 0.15));
  const roofMat = mat(P.darken(P.ROCK_FACE, 0.4));

  for (let i = 0; i < C.segments; i++) {
    const t = i / C.segments;
    // The doorway: a run of segments left out. Wide enough to walk through
    // without aiming, narrow enough that the room is still a room.
    if (Math.abs(((t - C.doorAt + 1.5) % 1) - 0.5) < C.doorWidth) continue;
    const a = t * Math.PI * 2;
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(
        C.wallThickness,
        C.wallHeight,
        (2 * Math.PI * C.radius) / C.segments + 0.4,
      ),
      wallMat,
    );
    seg.position.set(Math.cos(a) * C.radius, C.wallHeight / 2, Math.sin(a) * C.radius);
    seg.rotation.y = -a;
    parts.push(seg);

    // Solid, with the doorway left open -- the same shape of rule as the cliff
    // ring's passes, and for the same reason.
    obstacles.push({
      x: x + Math.cos(a) * C.radius,
      z: z + Math.sin(a) * C.radius,
      r: C.segmentRadius,
      top: ground + C.wallHeight,
    });
  }

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(C.radius + C.wallThickness, C.roofHeight, C.segments, 1),
    roofMat,
  );
  roof.position.y = C.wallHeight + C.roofHeight / 2 - 0.1;
  parts.push(roof);

  mesh = new THREE.Mesh(mergeGeometries(parts.map(bakeIntoVertices), false), CHARACTER_MAT);
  mesh.position.set(x, ground, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  mouth = { x, z };
}

function clear() {
  if (!mesh) return;
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh = null;
  mouth = null;
}

/**
 * Put one in the valley, wherever the ruin is. A ruin is already the region that
 * says somebody built something here once, so a roofed chamber belongs to it
 * rather than arriving from nowhere.
 */
function place() {
  clear();
  const home = centres.find((c) => c.region.landmark === 'ruin') || centres[0];
  if (!home) return;
  build(home.x + C.offset, home.z);
}
on(EVENTS.WORLD_BUILT, place);

/**
 * How far inside you are, 0 outside and 1 under the middle of the roof.
 *
 * Eased across the doorway rather than switched, so walking in is a dimming
 * rather than a light being turned off -- CLAUDE.md's rule that nothing appears
 * or disappears instantly applies to the light as much as to the objects.
 */
export function indoorFactor(x, z) {
  if (!mouth) return 0;
  const d = Math.hypot(x - mouth.x, z - mouth.z);
  if (d >= C.radius) return 0;
  return Math.min(1, (C.radius - d) / C.fade);
}

/** Where the chamber is, for anything that wants to point at it. */
export const caveAt = () => mouth;
