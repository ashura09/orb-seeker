// bloom.js — the glow on the orbs and the Keeper.
//
// The seven orbs are the whole point of the game and they were rendering as
// flat coloured balls. Bloom is what makes a light source read as a LIGHT
// rather than as a circle painted the colour of light: bright pixels bleed into
// the ones around them, the way they do in a camera or an eye.
//
// This is a post-processing pass, which means the scene is rendered into a
// buffer, the bright parts are extracted and blurred, and the result is added
// back. That costs a full extra pass over every pixel, which is the one thing
// on a phone that genuinely hurts -- so it is behind a config flag, and the
// game falls back to drawing straight to the screen when it is off.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { renderer, scene, camera } from './state.js';
import { CONFIG } from './config.js';

let composer = null;

export function setupBloom() {
  if (!CONFIG.bloom.enabled) return false;

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    CONFIG.bloom.strength,
    CONFIG.bloom.radius,
    // Threshold is what stops the whole valley glowing. Only pixels brighter
    // than this bleed, which should be the orbs, the wish tokens and the
    // Keeper -- not the grass.
    CONFIG.bloom.threshold,
  );
  composer.addPass(bloom);

  // OutputPass does the colour-space conversion that the renderer would
  // normally do on its own. Without it the whole image comes out washed out,
  // because the composer has been writing to an intermediate buffer.
  composer.addPass(new OutputPass());

  // renderer.info resets itself on every render() call, so with a composer the
  // stats overlay ended up reporting only the last pass -- "1 call, 0 triangles".
  // Taking over the reset makes the counts accumulate across every pass, which
  // is the honest number anyway: it is the total work the frame costs.
  renderer.info.autoReset = false;

  return true;
}

// Low graphics turns the composer off without tearing it down, so it can come
// back if the setting is ever raised again.
let bypass = false;
export function setBloomEnabled(on) {
  bypass = !on;
}

/** Draws the frame, through the composer when bloom is on. */
export function render() {
  if (composer && !bypass) {
    renderer.info.reset();
    composer.render();
  } else {
    // autoReset was turned off when the composer was set up, so the counters must
    // still be reset by hand on this path -- otherwise they accumulate across
    // every frame and the stats overlay reports six-figure draw calls.
    if (!renderer.info.autoReset) renderer.info.reset();
    renderer.render(scene, camera);
  }
}

export function resize(width, height) {
  if (composer) composer.setSize(width, height);
}
