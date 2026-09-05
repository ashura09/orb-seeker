// wishstones.js — a wish, standing in the valley where you made it.
//
// A wish used to be a string in save.wishes and nothing else. You gathered seven
// orbs, summoned a dragon, typed the thing you wanted, and the world was exactly
// as it had been. The only trace was a line of text inside a menu, which is the
// one place a nine-year-old will never look again.
//
// Now each kept wish raises a standing stone with a lit cap, on the spot where
// you picked its token up. Walk near one and it tells you what you wished for.
// They survive reloads and they accumulate across cycles, so a valley belonging
// to someone who has played for a month looks different from a new one -- and it
// looks different in a way only THEY can read, because they are their wishes.
//
// ONE DRAW CALL, WHATEVER THE COUNT
//
// The stones are a single InstancedMesh of a merged shaft-and-cap geometry with
// its colours baked into the vertices. One stone or forty, it is one draw call,
// which matters because the game runs at 147 of a budgeted 150. When there are no
// wishes yet the mesh is hidden and costs nothing at all.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from './palette.js';
import { scene, mat, bakeIntoVertices } from './state.js';
import { CONFIG } from './config.js';
import { surfaceHeightAt, obstacles } from './world.js';
import { save } from './save.js';
import { on, EVENTS } from './events.js';

const W = CONFIG.wishes;

// ---------------------------------------------------------------------------
// The stone itself, built once.
// ---------------------------------------------------------------------------
function stoneGeometry() {
  // Six-sided and tapered, so it reads as cut rock rather than a pipe, and wider
  // at the base so it looks planted instead of dropped.
  // Darker than the bare ROCK_FACE, which is pale enough that the stones looked
  // like painted posts standing on the grass rather than rock pushed up out of
  // it. Darker also gives the gold cap something to contrast against.
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.46, W.height, 6),
    mat(P.darken(P.ROCK_FACE, 0.28)),
  );
  shaft.position.y = W.height / 2;
  // A slight lean, different per stone would be nicer but this is one shared
  // geometry; a fixed small tilt still stops it looking machine-placed.
  shaft.rotation.z = 0.04;

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 6), mat(P.BRASS));
  collar.position.y = W.height + 0.02;

  // The cap is the part you see at distance and at night. Baked pale gold: the
  // same colour family as the Keeper and the wish token, so the three read as
  // one thread through the game.
  //
  // Six-sided cone, NOT an octahedron. mergeGeometries refuses to mix indexed
  // and non-indexed geometry and returns null rather than complaining, so the
  // octahedron this started as produced a null geometry and a crash three calls
  // later with nothing pointing back here. Cylinders and cones are both indexed.
  // Warmer and smaller than it started. WISH_GLOW alone is nearly bone-white and
  // the cone was big enough to read as a traffic cone; pulled halfway to BRASS it
  // is gold, which is the Keeper's colour and the wish token's.
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.38, 6),
    mat(P.mix(P.WISH_GLOW, P.BRASS, 0.55)),
  );
  cap.position.y = W.height + 0.3;
  cap.rotation.y = 0.5;

  const merged = mergeGeometries([shaft, collar, cap].map(bakeIntoVertices), false);
  if (!merged) throw new Error('wish stone geometry failed to merge (indexed/non-indexed mix?)');
  return merged;
}

// vertexColors because the three parts carry their colours in the geometry;
// a little emissive so the cap still reads after dark, when a stone in a field
// is otherwise just a silhouette.
const stoneMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: CONFIG.render.roughness,
  metalness: 0,
  emissive: P.WISH_GLOW,
  emissiveIntensity: W.emissive,
});

const stoneGeo = stoneGeometry();
// Must be computed before the InstancedMesh's own bounding sphere can be, below:
// InstancedMesh.computeBoundingSphere() expands the GEOMETRY's sphere over the
// instance matrices, and throws on a null one. Without this line the game
// crashed the first time a wish was kept -- which no test and no amount of
// reading catches, because it only happens on the first wish of a save.
stoneGeo.computeBoundingSphere();

const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, W.max);
stones.count = 0;
stones.visible = false;
// Scattered scenery casts and receives shadows, so these do too -- a standing
// stone with no shadow looks pasted onto the grass. It costs a second draw call
// (the shadow map is its own pass), which is why the stones are 2 of the budget
// and not 1.
stones.castShadow = true;
stones.receiveShadow = true;
scene.add(stones);

// Reused for every matrix write. Building a fresh Object3D per stone would
// allocate, and this runs whenever the valley is rebuilt.
const scratch = new THREE.Object3D();

// ---------------------------------------------------------------------------
// Where an old wish stands
//
// Wishes saved before this file existed have no coordinates. Rather than drop
// them on the origin in a heap, each is given a fixed spot derived from its own
// text: the same wish always lands in the same place, so a returning player's
// valley is stable between sessions even for wishes made before stones existed.
// ---------------------------------------------------------------------------
function placeFromText(text, i) {
  let h = 2166136261;
  for (let k = 0; k < text.length; k++) {
    h ^= text.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  const angle = ((h >>> 0) / 4294967296) * Math.PI * 2;
  // Spread over a ring, nudged outward per wish so two hashes landing close
  // together still get their own ground.
  const radius = W.legacyRing + ((i * 7) % 40);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

/** How many obstacle entries we added, so a rebuild can take them back out. */
let obstacleCount = 0;

/**
 * Rewrite every instance from save.wishes.
 *
 * Call after loading, after a wish is kept, and after the scenery is re-scattered
 * (which clears the obstacle list this pushes into).
 */
export function rebuildWishStones() {
  // Drop the entries we added last time. Ours are always at the end, because
  // scatter fills the list first and this runs after it.
  if (obstacleCount) {
    obstacles.length -= obstacleCount;
    obstacleCount = 0;
  }

  const list = save.wishes.slice(-W.max); // the most recent, if someone is prolific
  list.forEach((w, i) => {
    // Wishes made from now on carry the spot their token was picked up.
    if (typeof w.x !== 'number' || typeof w.z !== 'number') {
      const spot = placeFromText(w.text || 'a wish', i);
      w.x = spot.x;
      w.z = spot.z;
    }
    const y = surfaceHeightAt(w.x, w.z);
    scratch.position.set(w.x, y, w.z);
    scratch.rotation.set(0, ((i * 2.399) % (Math.PI * 2)) - Math.PI, 0);
    scratch.scale.setScalar(1);
    scratch.updateMatrix();
    stones.setMatrixAt(i, scratch.matrix);
    obstacles.push({ x: w.x, z: w.z, r: W.radius, top: y + W.height });
    obstacleCount++;
  });

  stones.count = list.length;
  stones.visible = list.length > 0;
  stones.instanceMatrix.needsUpdate = true;
  // The bounding sphere is computed from the base geometry, not the instances,
  // so without this the whole set vanishes when the origin leaves the frustum.
  stones.computeBoundingSphere();
}

// The valley is rebuilt on every new cycle, and scatterScenery empties the
// obstacle list when it does, taking our entries with it. Re-raise the stones
// whenever that happens, so wishes survive a re-roll of the world.
on(EVENTS.WORLD_BUILT, rebuildWishStones);

// ---------------------------------------------------------------------------
// A new stone rises
//
// CLAUDE.md: nothing appears or disappears instantly. A stone that blinks into
// existence next to you is exactly the thing that rule is about, so the newest
// one grows out of the ground over a second.
// ---------------------------------------------------------------------------
let rising = -1;
let risingWish = null; // held, not re-found: slicing the array every frame allocates
let riseAge = 0;

/** Record where a wish was kept, raise its stone, and start it growing. */
export function plantWish(wish, x, z) {
  wish.x = x;
  wish.z = z;
  rebuildWishStones();
  rising = Math.min(save.wishes.length, W.max) - 1;
  risingWish = wish;
  riseAge = 0;
}

/** Called every frame from motion.js. Does nothing once the stone has finished. */
export function updateWishStones(dt) {
  if (rising < 0) return;
  riseAge += dt;
  const t = Math.min(1, riseAge / W.riseSeconds);
  const w = risingWish;
  if (!w) {
    rising = -1;
    return;
  }
  const y = surfaceHeightAt(w.x, w.z);
  // Grows upward from nothing, and sits slightly under the ground until it is
  // most of the way up, so it looks pushed out rather than inflated.
  scratch.position.set(w.x, y - W.height * (1 - t) * 0.35, w.z);
  scratch.rotation.set(0, ((rising * 2.399) % (Math.PI * 2)) - Math.PI, 0);
  scratch.scale.set(1, Math.max(0.02, t), 1);
  scratch.updateMatrix();
  stones.setMatrixAt(rising, scratch.matrix);
  stones.instanceMatrix.needsUpdate = true;
  if (t >= 1) {
    rising = -1;
    risingWish = null;
  }
}

// ---------------------------------------------------------------------------
// Reading a stone
//
// Standing near one tells you what you wished for. It fires once per approach --
// tracked by which stone you are nearest, not by a timer -- so walking past a
// stone reads it, and standing beside it does not repeat forever.
// ---------------------------------------------------------------------------
let lastRead = -1;

/**
 * @param say  the toast function, passed in rather than imported, so this file
 *             does not depend on the UI layer.
 */
export function readNearbyWish(px, pz, say) {
  // Walks save.wishes directly rather than slicing it: this runs every frame,
  // and a fresh array per frame is exactly what the budget forbids. `from` skips
  // the oldest wishes when there are more than we draw.
  const all = save.wishes;
  const from = Math.max(0, all.length - W.max);
  let nearest = -1;
  let best = W.readRadius;
  for (let i = from; i < all.length; i++) {
    const w = all[i];
    if (typeof w.x !== 'number') continue; // not yet placed
    const d = Math.hypot(w.x - px, w.z - pz);
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  if (nearest !== lastRead) {
    lastRead = nearest;
    if (nearest >= 0) say(`You wished: “${all[nearest].text}”`, 3);
  }
}
