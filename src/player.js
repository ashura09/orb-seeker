// player.js — the monkey in a ninja suit, now on a skeleton.
//
// Every part of him is the same geometry, in the same colours, at the same
// heights as before. What changed is what they hang from: instead of sitting in
// a flat group and being rotated by hand with Math.sin, they hang off seven
// bones that Kenney's animation clips drive. See rig.js for why the bones are
// ours and only the motion is borrowed.
//
// Positions below are given as offsets from a bone. Each one is the part's old
// height minus the bone's height, so standing still he is identical -- the whole
// change is meant to be invisible until he moves.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from './palette.js';
import { scene, mat, glow, pointLight, bakeIntoVertices, CHARACTER_MAT } from './state.js';
import { worn } from './loadout.js';
// aliased: setCrawlPose already has a parameter called `on`.
import { on as onEvent, EVENTS } from './events.js';
import { buildSkeleton, makeAnimator } from './rig.js';

export const player = new THREE.Group();

const bones = buildSkeleton();
player.add(bones.root);

const SUIT_BASE = P.SUIT,
  SUIT_CLOAK = P.SUIT_CLOAK;
const suitMat = mat(SUIT_BASE),
  furMat = mat(P.FUR),
  faceMat = mat(P.SKIN);

// ---------------------------------------------------------------------------
// TORSO — hangs off the `torso` bone, whose origin is the hips at y 0.46.
// ---------------------------------------------------------------------------
export const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.85, 10), suitMat);
torso.position.y = 0.39; // was 0.85 in world
const sash = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 18), mat(P.SASH));
sash.rotation.x = Math.PI / 2;
sash.position.y = 0.26; // was 0.72
bones.torso.add(torso, sash);

// ---------------------------------------------------------------------------
// HEAD — off the `head` bone at y 1.35, so a clip that turns the head turns the
// hood, the ears, the headband and the hat with it. None of that was possible
// when they were all siblings in one flat group.
// ---------------------------------------------------------------------------
const headM = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), furMat);
headM.position.y = 0.27;
const hood = new THREE.Mesh(
  new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
  suitMat,
);
hood.position.y = 0.28;
const face = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), faceMat);
face.scale.set(1, 0.85, 0.6);
face.position.set(0, 0.21, 0.22);
const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), faceMat);
muzzle.position.set(0, 0.14, 0.36);
const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8),
  eyeMat = mat(P.INK);
const eyeL = new THREE.Mesh(eyeGeo, eyeMat),
  eyeR = new THREE.Mesh(eyeGeo, eyeMat);
eyeL.position.set(-0.09, 0.26, 0.42);
eyeR.position.set(0.09, 0.26, 0.42);
const earGeo = new THREE.SphereGeometry(0.11, 10, 8);
const earL = new THREE.Mesh(earGeo, furMat),
  earR = new THREE.Mesh(earGeo, furMat);
earL.position.set(-0.36, 0.31, 0.02);
earR.position.set(0.36, 0.31, 0.02);
const band = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 6, 20), mat(P.SASH));
band.rotation.x = Math.PI / 2;
band.position.y = 0.39;
const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.03), mat(P.SASH));
scarfTail.position.set(0.12, 0.15, -0.36);
scarfTail.rotation.z = 0.3;

// Nine parts that never move relative to each other and never change colour merge
// into one mesh with their colours baked in. The sash left this group when the
// head and the body became separate bones -- it belongs to the waist, and the
// waist is no longer the same object as the head.
const headStatics = [headM, face, muzzle, eyeL, eyeR, earL, earR, band, scarfTail];
bones.head.add(
  new THREE.Mesh(mergeGeometries(headStatics.map(bakeIntoVertices), false), CHARACTER_MAT),
  hood, // not merged: it wears suitMat, which the Violet cloak recolours
);

// ---------------------------------------------------------------------------
// ARMS — off shoulder bones at y 1.15, so rotating a bone swings the arm from
// the shoulder. The hand hangs below the arm and comes along for free, which is
// why motion.js no longer has to move it separately.
// ---------------------------------------------------------------------------
const armGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.6, 8);
export const armL = new THREE.Mesh(armGeo, suitMat),
  armR = new THREE.Mesh(armGeo, suitMat);
armL.position.y = -0.25;
armR.position.y = -0.25;
const handGeo = new THREE.SphereGeometry(0.09, 8, 8);
export const handL = new THREE.Mesh(handGeo, furMat),
  handR = new THREE.Mesh(handGeo, furMat);
handL.position.y = -0.57;
handR.position.y = -0.57;
bones['arm-left'].add(armL, handL);
bones['arm-right'].add(armR, handR);

// ---------------------------------------------------------------------------
// LEGS — off hip bones at y 0.46. The thigh and foot hang below.
// ---------------------------------------------------------------------------
function dressLeg(bone) {
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.44, 8), suitMat);
  thigh.position.y = -0.22;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.28), furMat);
  foot.position.set(0, -0.44, 0.05);
  bone.add(thigh, foot);
  return bone;
}
export const legL = dressLeg(bones['leg-left']),
  legR = dressLeg(bones['leg-right']);

// ---------------------------------------------------------------------------
// THE TAIL — one InstancedMesh, not six meshes.
//
// No animation clip knows a monkey has a tail, so it stays hand-swayed. It used
// to be six separate spheres, which is six draw calls of a budget with one to
// spare -- and splitting the head from the sash for the skeleton had already
// pushed us over. Instancing keeps every bit of the ripple, because each segment
// still gets its own position and size, and costs one call instead of six.
//
// The segments taper, so the geometry is the largest and each instance scales
// down from it.
// ---------------------------------------------------------------------------
const TAIL_SEGS = 6;
const TAIL_R = 0.075;
export const tail = new THREE.InstancedMesh(
  new THREE.SphereGeometry(TAIL_R, 8, 6),
  furMat,
  TAIL_SEGS,
);
tail.frustumCulled = false; // it sits behind him and the bounds are the sphere's
bones.torso.add(tail);

const tailScratch = new THREE.Object3D();

/** Called each frame from motion.js. `t` is the running clock. */
export function updateTail(t) {
  for (let i = 0; i < TAIL_SEGS; i++) {
    const k = i + 1;
    const r = (TAIL_R - i * 0.006) / TAIL_R;
    tailScratch.position.set(
      Math.sin(t * 3 - k * 0.6) * 0.06 * k,
      0.19 + k * 0.06 + Math.sin(t * 2 + k) * 0.02, // relative to the torso bone at 0.46
      -0.38 - k * 0.09,
    );
    tailScratch.scale.setScalar(r);
    tailScratch.updateMatrix();
    tail.setMatrixAt(i, tailScratch.matrix);
  }
  tail.instanceMatrix.needsUpdate = true;
}

player.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});
scene.add(player);

// ---------------------------------------------------------------------------
// THE CLIPS
//
// Loaded after the page is running. Until they arrive he simply stands in the
// pose the geometry was authored in -- which is exactly how he looked before
// this file had a skeleton, so nothing regresses while the file is in flight.
// ---------------------------------------------------------------------------
const anim = makeAnimator(bones.root);

/**
 * Cross-fade to a clip. Safe to call every frame: repeating the current one does
 * nothing, which is what lets motion.js simply state what the monkey is doing
 * and never track what he was doing before.
 */
export const setAnim = anim.setAnim;

/** Called once a frame from motion.js. */
export const updateAnim = anim.update;

/** What the monkey is currently doing, for anything that needs to know. */
export const currentAnim = anim.current;

// ---------------------------------------------------------------------------
// Crawling and jumping are now animations rather than hand-set rotations. Both
// keep their old names so nothing else had to change.
// ---------------------------------------------------------------------------
export function setCrawlPose(on) {
  if (on) setAnim('crouch');
}

export function setAirPose(on) {
  if (on) setAnim('jump', 0.08); // a jump should snap, not ease
}

// ---------------------------------------------------------------------------
// COSMETICS
//
// Building and showing are separate steps, which is the whole reason things can
// be taken off: the parts are built once and then shown or hidden to match what
// is worn. The hat now hangs from the head bone, so it turns when he looks.
// ---------------------------------------------------------------------------
export const cosmetics = {};

function buildCosmetics() {
  if (cosmetics.built) return;
  cosmetics.built = true;

  const h = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 16), mat(P.HAT_BRIM));
  brim.position.y = 0.57; // was 1.92 in world
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 16), mat(P.HAT_TOP));
  top.position.y = 0.73;
  h.add(brim, top);
  bones.head.add(h);
  cosmetics.hat = h;

  const g = new THREE.Group();
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 8), mat(P.BRASS));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), glow(P.ORB[2]));
  const light = pointLight(P.LANTERN_LIGHT, 0, 9);
  light.position.y = 0.3;
  g.add(cage, flame, light);
  g.position.set(0.55, 0.06, 0.12);
  bones.torso.add(g);
  cosmetics.lantern = g;
  cosmetics.lanternLight = light;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 30), glow(P.BRASS));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.34;
  bones.torso.add(ring);
  cosmetics.charm = ring;
}

/**
 * Make the monkey look like whatever you currently have on. Asks `worn`, not
 * `owned`: owning a hat you have taken off must not put it back on your head.
 */
export function applyCosmetics() {
  buildCosmetics();
  suitMat.color.set(worn('cloak') ? SUIT_CLOAK : SUIT_BASE);
  cosmetics.hat.visible = worn('hat');
  cosmetics.lantern.visible = worn('lantern');
  cosmetics.charm.visible = worn('charm');
}

onEvent(EVENTS.LOADOUT_CHANGED, applyCosmetics);
