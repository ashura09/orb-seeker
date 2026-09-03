// graphics.js — the quality setting, and the watchdog that lowers it for you.
//
// This is a phone game, and the phone we care about is a mid-range Android from
// about four years ago — not the newest iPhone. That machine cannot be asked
// about at build time, so the game measures itself instead: if the average frame
// rate sits below the floor for a few seconds, quality drops on its own.
//
// It only ever drops. A game that flips back and forth between quality levels is
// worse than one that is simply a bit plainer, because the flipping itself is the
// thing you notice.
//
// The choice is remembered, so a phone that struggled once does not have to spend
// the first five seconds of every session struggling again to prove it.
import { G } from './state.js';
import { CONFIG } from './config.js';
import { save, persist } from './save.js';
import { setBloomEnabled } from './bloom.js';
import { setShadowsEnabled } from './sky.js';

/** Applies a quality level to the renderer. Safe to call more than once. */
export function setLowGraphics(on) {
  if (G.lowGraphics === on) return;
  G.lowGraphics = on;

  // Both of these force Three.js to recompile materials, which is a visible hitch
  // — acceptable once, which is why this never toggles back and forth.
  setShadowsEnabled(!on);
  setBloomEnabled(!on);

  applyPropBudget(); // takes effect the next time the valley is rebuilt

  if (save.lowGraphics !== on) {
    save.lowGraphics = on;
    persist();
  }
}

/**
 * Watches the frame rate and drops quality if it stays under the floor.
 *
 * Averaged over a window rather than judged per frame: one slow frame is a
 * garbage collection, not a slow phone, and reacting to it would punish every
 * device for a hiccup.
 */
let elapsed = 0;
let frames = 0;
let belowFor = 0;

export function watchFrameRate(dt) {
  if (G.lowGraphics) return; // it only ever drops, so there is nothing left to watch

  const GFX = CONFIG.graphics;
  elapsed += dt;
  frames++;
  if (elapsed < GFX.sampleSeconds) return;

  const fps = frames / elapsed;
  belowFor = fps < GFX.autoLowFps ? belowFor + elapsed : 0;
  elapsed = 0;
  frames = 0;

  if (belowFor >= GFX.autoLowSeconds) setLowGraphics(true);
}

/**
 * Called once at startup, before the first frame. A phone that already dropped in
 * a previous session starts low, rather than re-earning it.
 */
export function initGraphics() {
  applyPropBudget();
  if (save.lowGraphics || CONFIG.graphics.forceLow) setLowGraphics(true);
}

// Fewer props is the single biggest triangle saving there is. The number is
// written into shared state rather than exported as a getter, because world.js
// sits BELOW this file in the import order and must never import upward — see
// the layer list in ARCHITECTURE.md.
function applyPropBudget() {
  G.propBudget = G.lowGraphics ? CONFIG.graphics.lowProps : CONFIG.world.props;
}
