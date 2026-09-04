// wanderers.js — the seven villagers: their bodies, their camps, their hearing.
//
// Who they ARE is villagers.js. This file turns that table into meshes that walk
// around, notice you, and come over for a duel.
//
// Each villager is five draw calls, not the fourteen-to-sixteen they started as:
// everything rigid is merged into one geometry with its colours baked into the
// vertices, and each limb is one mesh inside the Group that animates it. See
// UPGRADE-NOTES.md, "Merging beats instancing for characters".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from './palette.js';
import { scene, mat, G } from './state.js';
import { player } from './player.js';
import { worn } from './loadout.js';
import { orbs } from './orbs.js';
import { CONFIG } from './config.js';
import { emit, EVENTS } from './events.js';
import { WANDERERS } from './villagers.js';
import { WORLD_R, surfaceHeightAt } from './world.js';

// Geometry is built once here and shared by all seven. Seven villagers there-
// fore cost about as much memory as one; only the materials differ.
const GEO = {
  torso: new THREE.CylinderGeometry(0.3, 0.38, 0.8, 10),
  head: new THREE.SphereGeometry(0.28, 14, 12),
  arm: new THREE.CylinderGeometry(0.075, 0.085, 0.55, 7),
  hand: new THREE.SphereGeometry(0.085, 7, 6),
  leg: new THREE.CylinderGeometry(0.095, 0.105, 0.42, 7),
  foot: new THREE.BoxGeometry(0.16, 0.09, 0.26),
  eye: new THREE.SphereGeometry(0.035, 6, 6),
  cap: new THREE.ConeGeometry(0.34, 0.3, 8),
  brim: new THREE.CylinderGeometry(0.46, 0.46, 0.035, 12),
  crown: new THREE.ConeGeometry(0.3, 0.34, 10),
  hood: new THREE.SphereGeometry(0.33, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
  kerchief: new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
  handle: new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6),
  staff: new THREE.CylinderGeometry(0.04, 0.045, 1.7, 6),
  axeHead: new THREE.BoxGeometry(0.07, 0.26, 0.3),
  hammer: new THREE.BoxGeometry(0.2, 0.2, 0.3),
  blade: new THREE.BoxGeometry(0.045, 0.95, 0.1),
  bag: new THREE.BoxGeometry(0.3, 0.26, 0.16),
  basket: new THREE.CylinderGeometry(0.19, 0.15, 0.22, 9),
  beard: new THREE.ConeGeometry(0.17, 0.34, 8),
};

const EYE = mat(P.INK),
  WOOD = mat(P.BARK),
  STEEL = mat(P.STEEL),
  GOLD = mat(P.BRASS),
  STRAW = mat(P.STRAW),
  BOOT = mat(P.BOOT),
  WHISKERS = mat(P.WHISKERS),
  LEATHER = mat(P.LEATHER),
  STRAPMAT = mat(P.STRAP),
  LEAFMAT = mat(P.LEAF_PROP);

// One material for every villager's static half. Their colours ride in the
// vertices instead, which is what lets a torso, a head, two eyes, a hat and an
// axe -- six different colours -- become ONE draw call.
//
// Why this matters: seven villagers were 103 separate meshes between them, and
// the phone budget is 150 draw calls for the whole game. Props were never the
// problem; 1150 of them cost 53 calls because they are instanced. The characters
// were.
const VILLAGER_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: CONFIG.render.roughness,
  metalness: 0,
});

/**
 * Copies a mesh's geometry into world-ish space and paints its material colour
 * into every vertex, so it can be merged with differently-coloured parts.
 *
 * The colour is taken from `material.color`, which three.js has already
 * converted from sRGB to linear — copying it straight across means the merged
 * version is the same colour as the separate one, not a second conversion.
 */
function bakeIntoVertices(mesh) {
  mesh.updateMatrix();
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrix);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const { r, g: gg, b } = mesh.material.color;
  for (let i = 0; i < n; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = gg;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function buildWanderer(w) {
  const g = new THREE.Group();
  // Anything that never moves goes here and is merged into a single mesh at the
  // end. Arms and legs are added to `g` directly, because the frame loop rotates
  // them and a merged mesh cannot bend.
  const statics = [];
  const solid = (...meshes) => statics.push(...meshes);

  const cloth = mat(w.color),
    skin = mat(w.skin),
    hatMat = mat(w.hat);
  const s = w.build;

  // torso and head
  const body = new THREE.Mesh(GEO.torso, cloth);
  body.position.y = 0.86 * s;
  body.scale.setScalar(s);
  const head = new THREE.Mesh(GEO.head, skin);
  head.position.y = 1.48 * s;
  solid(body, head);

  // a face, so they read as people and you can see which way they are facing
  [-1, 1].forEach((side) => {
    const e = new THREE.Mesh(GEO.eye, EYE);
    e.position.set(side * 0.1 * s, 1.52 * s, 0.245 * s);
    solid(e);
  });
  if (w.beard) {
    const b = new THREE.Mesh(GEO.beard, WHISKERS);
    b.position.set(0, 1.3 * s, 0.16 * s);
    b.rotation.x = Math.PI;
    solid(b);
  }

  // arms and legs. Each limb is a Group placed at the shoulder or hip so it
  // swings from the joint; the frame loop rotates these while they walk.
  const limbs = { arms: [], legs: [] };
  [-1, 1].forEach((side) => {
    // A limb is a Group the frame loop rotates. Inside it, the hand does not move
    // relative to the arm and the foot does not move relative to the leg -- so
    // each limb's two parts merge into one mesh, and only the Group animates.
    const arm = new THREE.Group();
    arm.position.set(side * 0.38 * s, 1.16 * s, 0);
    const upper = new THREE.Mesh(GEO.arm, cloth);
    upper.position.y = -0.27;
    const hand = new THREE.Mesh(GEO.hand, skin);
    hand.position.y = -0.56;
    arm.add(
      new THREE.Mesh(mergeGeometries([upper, hand].map(bakeIntoVertices), false), VILLAGER_MAT),
    );
    g.add(arm);
    limbs.arms.push(arm);

    const leg = new THREE.Group();
    leg.position.set(side * 0.15 * s, 0.46 * s, 0);
    const thigh = new THREE.Mesh(GEO.leg, BOOT);
    thigh.position.y = -0.21;
    const foot = new THREE.Mesh(GEO.foot, WOOD);
    foot.position.set(0, -0.42, 0.05);
    leg.add(
      new THREE.Mesh(mergeGeometries([thigh, foot].map(bakeIntoVertices), false), VILLAGER_MAT),
    );
    g.add(leg);
    limbs.legs.push(leg);
  });

  // headwear
  if (w.headwear === 'cap') {
    const c = new THREE.Mesh(GEO.cap, hatMat);
    c.position.y = 1.72 * s;
    solid(c);
  } else if (w.headwear === 'brim') {
    const br = new THREE.Mesh(GEO.brim, hatMat);
    br.position.y = 1.66 * s;
    const cr = new THREE.Mesh(GEO.crown, hatMat);
    cr.position.y = 1.82 * s;
    solid(br, cr);
  } else if (w.headwear === 'hood') {
    const h = new THREE.Mesh(GEO.hood, hatMat);
    h.position.y = 1.5 * s;
    solid(h);
  } else if (w.headwear === 'kerchief') {
    const k = new THREE.Mesh(GEO.kerchief, hatMat);
    k.position.y = 1.5 * s;
    solid(k);
  }

  // the prop — the thing that actually tells you who this is at a distance
  const hx = 0.38 * s,
    hy = 0.72 * s,
    hz = 0.12;
  if (w.prop === 'axe') {
    const shaft = new THREE.Mesh(GEO.handle, WOOD);
    shaft.position.set(hx, hy, hz);
    shaft.rotation.z = 0.25;
    const blade = new THREE.Mesh(GEO.axeHead, STEEL);
    blade.position.set(hx + 0.16, hy + 0.42, hz);
    solid(shaft, blade);
  } else if (w.prop === 'hammer') {
    const shaft = new THREE.Mesh(GEO.handle, WOOD);
    shaft.position.set(hx, hy, hz);
    shaft.rotation.z = 0.2;
    const head2 = new THREE.Mesh(GEO.hammer, STEEL);
    head2.position.set(hx + 0.13, hy + 0.44, hz);
    solid(shaft, head2);
  } else if (w.prop === 'blade') {
    const b = new THREE.Mesh(GEO.blade, STEEL);
    b.position.set(hx, hy + 0.35, hz);
    b.rotation.z = 0.12;
    const guard = new THREE.Mesh(GEO.hand, GOLD);
    guard.position.set(hx, hy - 0.1, hz);
    solid(b, guard);
  } else if (w.prop === 'staff') {
    const st = new THREE.Mesh(GEO.staff, WOOD);
    st.position.set(hx, hy + 0.36, hz);
    st.rotation.z = 0.06;
    solid(st);
  } else if (w.prop === 'satchel') {
    const bag = new THREE.Mesh(GEO.bag, LEATHER);
    bag.position.set(-0.34 * s, 0.8 * s, 0.1);
    bag.rotation.z = -0.15;
    const strap = new THREE.Mesh(GEO.handle, STRAPMAT);
    strap.position.set(-0.1 * s, 1.15 * s, 0.05);
    strap.rotation.z = Math.PI / 2.6;
    solid(bag, strap);
  } else if (w.prop === 'basket') {
    const bk = new THREE.Mesh(GEO.basket, STRAW);
    bk.position.set(hx, hy, 0.1);
    const leaf = new THREE.Mesh(GEO.hand, LEAFMAT);
    leaf.position.set(hx, hy + 0.14, 0.1);
    leaf.scale.set(1.6, 0.7, 1.6);
    solid(bk, leaf);
  }

  // Six-or-so coloured parts collapse into one mesh, one material, one draw call.
  g.add(new THREE.Mesh(mergeGeometries(statics.map(bakeIntoVertices), false), VILLAGER_MAT));

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(g);
  return { g, limbs };
}

export const wanderers = WANDERERS.map((w, i) => {
  const { g, limbs } = buildWanderer(w);
  return {
    ...w,
    g,
    limbs,
    tier: i + 1,
    hx: 0,
    hz: 0,
    tx: 0,
    tz: 0,
    wait: 0,
    cooldown: 0,
    bob: Math.random() * 6,
  };
});

/** @param random  seeded on the bench, so camps land identically every run. */
export function homeWanderers(random = Math.random) {
  wanderers.forEach((w, i) => {
    w.hx = orbs[i].x;
    w.hz = orbs[i].z;
    const W = CONFIG.wanderers;
    const a = random() * Math.PI * 2,
      r = W.campRadiusMin + random() * (W.campRadiusMax - W.campRadiusMin);
    const wx = w.hx + Math.cos(a) * r,
      wz = w.hz + Math.sin(a) * r;
    w.g.position.set(wx, surfaceHeightAt(wx, wz), wz);
    pickTarget(w);
  });
}

export function pickTarget(w) {
  // roam within about 22 m of camp
  const W = CONFIG.wanderers;
  const a = Math.random() * Math.PI * 2,
    r = Math.random() * W.roamRadius;
  w.tx = Math.max(-WORLD_R + 5, Math.min(WORLD_R - 5, w.hx + Math.cos(a) * r));
  w.tz = Math.max(-WORLD_R + 5, Math.min(WORLD_R - 5, w.hz + Math.sin(a) * r));
  w.wait = W.waitMin + Math.random() * (W.waitMax - W.waitMin);
}
homeWanderers();

// Swings arms and legs while walking, and settles them when standing still.
function animateLimbs(w, moving) {
  const swing = moving ? Math.sin(w.bob) : 0;
  w.limbs.arms[0].rotation.x = swing * 0.55;
  w.limbs.arms[1].rotation.x = -swing * 0.55;
  w.limbs.legs[0].rotation.x = -swing * 0.5;
  w.limbs.legs[1].rotation.x = swing * 0.5;
}

export function updateWanderers(dt) {
  // The bench is a still life. Villagers wandering in and out of frame was the
  // last thing making two runs disagree -- 158 draw calls against 176, from the
  // same code.
  if (G.bench) return;

  const W = CONFIG.wanderers;
  // How far you carry. Crawling multiplies the base so it still stacks with the
  // Silver bell; whistling overrides both for as long as the noise lasts.
  let hear = worn('bell') ? W.hearingWithBell : W.hearingRange;
  if (G.crawling) hear *= W.crawlHearingMultiplier;
  if (G.whistleT > 0) hear = Math.max(hear, W.whistleRange);
  for (const w of wanderers) {
    w.cooldown = Math.max(0, w.cooldown - dt);
    const pdx = player.position.x - w.g.position.x,
      pdz = player.position.z - w.g.position.z,
      pd = Math.hypot(pdx, pdz);
    const hunting = pd < hear && w.cooldown === 0 && !G.ceremony;
    if (hunting) {
      w.tx = player.position.x;
      w.tz = player.position.z;
      w.wait = 0;
    }
    const dx = w.tx - w.g.position.x,
      dz = w.tz - w.g.position.z,
      d = Math.hypot(dx, dz);
    if (d > 0.5) {
      const sp = hunting ? W.huntSpeed : W.roamSpeed;
      w.g.position.x += (dx / d) * sp * dt;
      w.g.position.z += (dz / d) * sp * dt;
      w.g.rotation.y = Math.atan2(dx, dz);
      w.bob += dt * W.bobRate;
      w.g.position.y =
        surfaceHeightAt(w.g.position.x, w.g.position.z) + Math.abs(Math.sin(w.bob)) * 0.1;
      animateLimbs(w, true);
    } else {
      w.g.position.y = surfaceHeightAt(w.g.position.x, w.g.position.z);
      w.wait -= dt;
      if (w.wait <= 0) pickTarget(w);
      animateLimbs(w, false);
    }
    if (G.state === 'play' && hunting && pd < W.challengeRange) emit(EVENTS.DUEL_CHALLENGE, w);
  }
}
