// player.js — the monkey in a ninja suit, and the cosmetics bought in the shop.
//
// The parts main.js animates each frame (arms, hands, tail) are exported.
// `torso` is exported too because wanderers.js reuses its geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from './palette.js';
import { scene, mat, glow, pointLight, bakeIntoVertices, CHARACTER_MAT } from './state.js';
import { worn } from './loadout.js';
// aliased: setCrawlPose already has a parameter called `on`.
import { on as onEvent, EVENTS } from './events.js';

export const player = new THREE.Group();

// The upper body is a group of its own, lifted clear of the ground so the legs
// below have somewhere to be. Everything that used to be added straight to
// `player` goes in here, so it all rises together and the proportions hold.
const body = new THREE.Group();
body.position.y = 0.3;
player.add(body);

const SUIT_BASE = P.SUIT,
  SUIT_CLOAK = P.SUIT_CLOAK;
const suitMat = mat(SUIT_BASE),
  furMat = mat(P.FUR),
  faceMat = mat(P.SKIN);
export const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.85, 10), suitMat);
torso.position.y = 0.55;
const sash = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 18), mat(P.SASH));
sash.rotation.x = Math.PI / 2;
sash.position.y = 0.42;
const headM = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), furMat);
headM.position.y = 1.32;
const hood = new THREE.Mesh(
  new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
  suitMat,
);
hood.position.y = 1.33;
const face = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), faceMat);
face.scale.set(1, 0.85, 0.6);
face.position.set(0, 1.26, 0.22);
const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), faceMat);
muzzle.position.set(0, 1.19, 0.36);
const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8),
  eyeMat = mat(P.INK);
const eyeL = new THREE.Mesh(eyeGeo, eyeMat),
  eyeR = new THREE.Mesh(eyeGeo, eyeMat);
eyeL.position.set(-0.09, 1.31, 0.42);
eyeR.position.set(0.09, 1.31, 0.42);
const earGeo = new THREE.SphereGeometry(0.11, 10, 8);
const earL = new THREE.Mesh(earGeo, furMat),
  earR = new THREE.Mesh(earGeo, furMat);
earL.position.set(-0.36, 1.36, 0.02);
earR.position.set(0.36, 1.36, 0.02);
const band = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 6, 20), mat(P.SASH));
band.rotation.x = Math.PI / 2;
band.position.y = 1.44;
const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.03), mat(P.SASH));
scarfTail.position.set(0.12, 1.2, -0.36);
scarfTail.rotation.z = 0.3;
const armGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.6, 8);
export const armL = new THREE.Mesh(armGeo, suitMat),
  armR = new THREE.Mesh(armGeo, suitMat);
armL.position.set(-0.42, 0.6, 0);
armR.position.set(0.42, 0.6, 0);
const handGeo = new THREE.SphereGeometry(0.09, 8, 8);
export const handL = new THREE.Mesh(handGeo, furMat),
  handR = new THREE.Mesh(handGeo, furMat);
handL.position.set(-0.42, 0.28, 0);
handR.position.set(0.42, 0.28, 0);
export const tailSegs = [];
for (let i = 0; i < 6; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.075 - i * 0.006, 8, 6), furMat);
  body.add(s);
  tailSegs.push(s);
}
// Ten of his parts never move relative to each other and never change colour --
// head, face, muzzle, both eyes, both ears, the headband, the scarf tail and the
// sash. They merge into one mesh with their colours baked into the vertices, the
// same trick the villagers use.
//
// The torso and hood do NOT merge: they wear suitMat, which is recoloured when
// the Violet suit is worn, and a baked vertex cannot be repainted later. The
// limbs do not merge either, because they swing.
const playerStatics = [headM, face, muzzle, eyeL, eyeR, earL, earR, band, scarfTail, sash];
body.add(
  new THREE.Mesh(mergeGeometries(playerStatics.map(bakeIntoVertices), false), CHARACTER_MAT),
  torso,
  hood,
  armL,
  armR,
  handL,
  handR,
);
// ---------- legs ----------
// Each leg is a Group placed at the hip, with the thigh and foot hanging below
// it. Rotating the group swings the whole leg from the hip, which is what you
// want; rotating the cylinder itself would pivot it around its middle.
function makeLeg(side) {
  const g = new THREE.Group();
  g.position.set(side * 0.15, 0.46, 0);
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.44, 8), suitMat);
  thigh.position.y = -0.22;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.28), furMat);
  foot.position.set(0, -0.44, 0.05);
  g.add(thigh, foot);
  player.add(g);
  return g;
}
export const legL = makeLeg(-1),
  legR = makeLeg(1);

player.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});
scene.add(player);

// ---------- crawling ----------
// Drops the upper body to the ground and tips it forward, and lays the legs out
// behind. Purely visual -- what crawling DOES lives in wanderers.js (they hear
// you from closer) and main.js (you move slower).
// The walk cycle swings the legs on rotation.x, so the crawl splays them on
// rotation.z instead and the two never fight each other.
export function setCrawlPose(on) {
  body.position.y = on ? 0.02 : 0.3;
  body.rotation.x = on ? 1.15 : 0;
  legL.rotation.z = on ? -0.35 : 0;
  legR.rotation.z = on ? 0.35 : 0;
}

/** Legs tucked and arms up while off the ground, so a jump reads as a jump. */
export function setAirPose(on) {
  legL.rotation.x = on ? -0.7 : 0;
  legR.rotation.x = on ? -0.4 : 0;
  armL.rotation.x = on ? -1.5 : 0;
  armR.rotation.x = on ? -1.5 : 0;
}

// ---------- cosmetics ----------
//
// BUILDING AND SHOWING ARE SEPARATE STEPS, and that separation is the whole
// reason you can now take things off. The old version of this function could
// only ever ADD: every branch read `if (owned(x) && !cosmetics.x) build it`,
// so once a hat existed there was no line anywhere that could remove it.
//
// Now the parts are built once, on the first call, and then simply shown or
// hidden to match what you are wearing. Meshes are cheap to keep around and
// expensive to rebuild, so hiding beats destroying -- and it makes this
// function safe to call as often as we like, with the same result every time.
export const cosmetics = {};

function buildCosmetics() {
  if (cosmetics.built) return;
  cosmetics.built = true;

  const h = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 16), mat(P.HAT_BRIM));
  brim.position.y = 1.62;
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 16), mat(P.HAT_TOP));
  top.position.y = 1.78;
  h.add(brim, top);
  body.add(h);
  cosmetics.hat = h;

  const g = new THREE.Group();
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 8), mat(P.BRASS));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), glow(P.ORB[2]));
  const light = pointLight(P.LANTERN_LIGHT, 0, 9);
  light.position.y = 0.3;
  g.add(cage, flame, light);
  g.position.set(0.55, 0.22, 0.12);
  body.add(g);
  cosmetics.lantern = g;
  cosmetics.lanternLight = light;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 30), glow(P.BRASS));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.5;
  body.add(ring);
  cosmetics.charm = ring;
}

/**
 * Make the monkey look like whatever you currently have on. Called at startup,
 * on pickup, and -- via the bus -- every time you wear or remove something.
 *
 * Note it asks `worn`, not `owned`. Owning a hat you have taken off must not
 * put it back on your head.
 */
export function applyCosmetics() {
  buildCosmetics();
  suitMat.color.set(worn('cloak') ? SUIT_CLOAK : SUIT_BASE);
  cosmetics.hat.visible = worn('hat');
  cosmetics.lantern.visible = worn('lantern');
  cosmetics.charm.visible = worn('charm');
}

// The loadout does not know this file exists; it just announces the change.
// Hiding a group also hides the light inside it -- three.js skips invisible
// objects and everything under them -- so an unworn lantern costs nothing.
onEvent(EVENTS.LOADOUT_CHANGED, applyCosmetics);
