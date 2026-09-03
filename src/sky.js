// sky.js — the sky dome and the sun that lights the valley.
//
// The sky used to be scene.background: one flat colour, lerped from day blue to
// night navy. Flat colour is why the world read as a diorama on a table -- real
// skies are darker overhead than at the horizon, and that gradient is most of
// what tells your eye the world is big.
//
// This is a large inverted sphere with the gradient painted into its vertices,
// which costs one draw call and no shader work. It is deliberately NOT
// three/addons/objects/Sky.js: that one is physically modelled and wants tone
// mapping turned on to look right, which would restyle the entire game. This
// keeps the day/night colours the game already had and just gives them shape.
import * as THREE from 'three';
import { scene, renderer, sun, hemi, ambient } from './state.js';
import { CONFIG } from './config.js';

const S = CONFIG.sky;

// horizon and zenith, for day and for night
const DAY_LOW = new THREE.Color(S.dayHorizon);
const DAY_HIGH = new THREE.Color(S.dayZenith);
const NIGHT_LOW = new THREE.Color(S.nightHorizon);
const NIGHT_HIGH = new THREE.Color(S.nightZenith);

const domeGeo = new THREE.SphereGeometry(S.radius, 24, 16);
domeGeo.setAttribute(
  'color',
  new THREE.BufferAttribute(new Float32Array(domeGeo.attributes.position.count * 3), 3),
);

// BackSide so we see the inside; fog off so the dome is not washed flat by the
// same haze that gives the ground its depth.
const domeMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  side: THREE.BackSide,
  fog: false,
  depthWrite: false,
});
const dome = new THREE.Mesh(domeGeo, domeMat);
dome.frustumCulled = false;
dome.renderOrder = -1; // drawn first, everything else sits in front
scene.add(dome);

const low = new THREE.Color(),
  high = new THREE.Color(),
  out = new THREE.Color();

/**
 * Repaints the dome for a given time of night (0 = day, 1 = night).
 *
 * Only called when `night` has actually moved, since repainting means walking
 * every vertex -- doing it every frame for a value that changes twice a
 * gathering would be wasteful.
 */
export function paintSky(night) {
  const pos = domeGeo.attributes.position;
  const col = domeGeo.attributes.color;
  low.copy(DAY_LOW).lerp(NIGHT_LOW, night);
  high.copy(DAY_HIGH).lerp(NIGHT_HIGH, night);

  for (let i = 0; i < pos.count; i++) {
    // 0 at the horizon, 1 straight up. Curved so the gradient tightens near the
    // horizon, which is how the real one behaves.
    const t = Math.max(0, pos.getY(i) / S.radius);
    out.copy(low).lerp(high, Math.pow(t, S.falloff));
    col.setXYZ(i, out.r, out.g, out.b);
  }
  col.needsUpdate = true;
}

// ---------- environment light ----------
//
// A Lambert material only knows about the lights you place, so every surface
// facing the same direction came out the same flat colour. A Standard material
// can also be lit by the SKY ITSELF -- a small, heavily blurred cube map of the
// surroundings, sampled per pixel. A face turned upward catches sky; a face
// turned down catches ground bounce. That variation, more than any texture, is
// what stops a scene reading as plastic.
//
// The map is built ONCE, from the day sky. Rebuilding it as night falls would
// mean re-rendering and re-blurring a cube map every frame; instead the night
// simply receives less of it, through scene.environmentIntensity.
export function buildEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);

  // The same gradient as the dome, but with the lower half turned toward the
  // ground colour, since half of what actually lights an object outdoors is
  // light coming back UP off the grass.
  const R = 50;
  const g = new THREE.SphereGeometry(R, 24, 16);
  g.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3),
  );
  const pos = g.attributes.position,
    col = g.attributes.color;
  const bounce = new THREE.Color(S.envGround);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / R;
    if (t >= 0) c.copy(DAY_LOW).lerp(DAY_HIGH, Math.pow(t, S.falloff));
    else c.copy(DAY_LOW).lerp(bounce, Math.min(1, -t * 2));
    col.setXYZ(i, c.r, c.g, c.b);
  }

  const envScene = new THREE.Scene();
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  envScene.add(new THREE.Mesh(g, m));

  scene.environment = pmrem.fromScene(envScene).texture;
  scene.environmentIntensity = CONFIG.render.envIntensity;

  pmrem.dispose();
  g.dispose();
  m.dispose();
}

// ---------- the sun ----------
//
// A directional light casts shadows through an orthographic camera, and that
// camera has to cover everything you want shadowed. Covering the whole 150 m
// valley at once would spread the shadow map so thin that everything goes soft
// and blocky, so instead the light FOLLOWS the player with a much smaller box.
// Shadows are then crisp where you are looking, and there are none in the
// distance where nobody would notice.
const SUN_OFFSET = new THREE.Vector3(S.sunOffsetX, S.sunOffsetY, S.sunOffsetZ);

export function setupShadows() {
  if (!CONFIG.shadows.enabled) return;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  sun.castShadow = true;
  sun.shadow.mapSize.set(CONFIG.shadows.mapSize, CONFIG.shadows.mapSize);

  const cam = sun.shadow.camera;
  const half = CONFIG.shadows.range;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = 1;
  cam.far = SUN_OFFSET.length() * 2 + half * 2;
  cam.updateProjectionMatrix();

  // Acne is where a surface shadows itself because the depth map is coarser
  // than the geometry. normalBias nudges the lookup along the surface normal,
  // which handles sloped terrain far better than a flat bias does.
  sun.shadow.bias = CONFIG.shadows.bias;
  sun.shadow.normalBias = CONFIG.shadows.normalBias;

  scene.add(sun.target);
}

/**
 * Turns shadows on or off for low-graphics mode.
 *
 * Changing shadowMap.enabled means every material has to be recompiled, which is
 * a visible hitch — which is why graphics.js only ever drops quality once rather
 * than flipping back and forth.
 */
export function setShadowsEnabled(on) {
  if (renderer.shadowMap.enabled === on) return;
  renderer.shadowMap.enabled = on;
  sun.castShadow = on;
  scene.traverse((o) => {
    if (o.material) o.material.needsUpdate = true;
  });
}

/** Keeps the sun, its shadow box and the dome centred on the player. */
export function followPlayer(x, y, z) {
  sun.position.set(x + SUN_OFFSET.x, y + SUN_OFFSET.y, z + SUN_OFFSET.z);
  sun.target.position.set(x, y, z);
  sun.target.updateMatrixWorld();
  dome.position.set(x, 0, z);
}

/** Dims the sun and warms the fill as night comes on. */
export function setNightLevel(night) {
  const L = CONFIG.dayNight;
  hemi.intensity = L.hemiDay - L.hemiNightDrop * night;
  sun.intensity = L.sunDay - L.sunNightDrop * night;
  ambient.intensity = L.ambientDay - L.ambientNightDrop * night;

  // The environment map is a DAY sky, so at night the world must simply receive
  // less of it -- otherwise every surface keeps a blue noon sheen after dark.
  const R = CONFIG.render;
  scene.environmentIntensity = R.envIntensity + (R.envNightFloor - R.envIntensity) * night;
}

paintSky(0);
