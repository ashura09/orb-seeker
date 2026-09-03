// input.js — the thumb joystick, look-drag, and keyboard.
//
// The left half of the screen walks, the right half looks around. Both are
// exported so duel.js can force the joystick to let go when a duel starts.
import { $, G, canvas } from './state.js';
import { CONFIG } from './config.js';
import { emit, EVENTS } from './events.js';
import { save, persist } from './save.js';

export const stickEl = $('stick'),
  knobEl = $('knob');
export const joy = { active: false, id: null, cx: 0, cy: 0, x: 0, y: 0 };
export const look = { active: false, id: null, lastX: 0, lastY: 0 };
export const keys = {};
const R = 55;

// ---------- zoom ----------
//
// THE PROBLEM: walking while looking around is ALREADY two fingers. If two
// fingers simply meant "pinch", the camera would zoom every time you walked
// and turned at the same time -- which is most of the game.
//
// So a pinch has to prove itself. Two fingers down only opens a *candidate*;
// the joystick and look-drag keep working normally. It becomes a real pinch
// only when both of these hold:
//
//   1. the gap between the fingers has changed by more than a threshold --
//      in walk-and-look the fingers drift, but you are not squeezing; and
//   2. the walking thumb is sitting near the centre of its stick, so it is a
//      resting finger rather than someone actually walking.
//
// Only then does it take the fingers away from walking and looking. In
// practice: pinch anywhere while standing still, or anywhere on the look side
// while moving, and walking is never interrupted by accident.
const touches = new Map(); // identifier -> {x, y}, every finger down
const pinch = { active: false, candidate: false, a: null, b: null, gap0: 0, gap: 0, dist0: 0 };

const gapOf = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const joyStray = () => (joy.active ? Math.hypot(joy.x, joy.y) : 0);

/**
 * The one way G.camDist is ever written. Clamps to the configured range and
 * remembers the choice, so pinch, the wheel and the startup restore cannot
 * drift apart.
 */
export function setCamDist(v) {
  const C = CONFIG.camera;
  G.camDist = Math.max(C.minDistance, Math.min(C.maxDistance, v));
}

// localStorage writes are slow, so the zoom is stored when a gesture ENDS
// rather than on every frame of it.
let saveTimer = 0;
function rememberCamDist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    save.camDist = G.camDist;
    persist();
  }, 250);
}

function releaseJoystick() {
  joy.active = false;
  joy.x = joy.y = 0;
  stickEl.style.display = 'none';
}

function openCandidate() {
  if (pinch.active || pinch.candidate) return;
  const ids = [...touches.keys()];
  if (ids.length < 2) return;
  pinch.candidate = true;
  [pinch.a, pinch.b] = ids;
  pinch.gap0 = gapOf(touches.get(pinch.a), touches.get(pinch.b));
}

function commitPinch(gap) {
  pinch.active = true;
  pinch.candidate = false;
  releaseJoystick();
  look.active = false;
  // Measure from where the fingers are NOW, not from where they started, so
  // the view does not jump by the threshold at the moment it commits.
  pinch.gap = gap;
  pinch.dist0 = G.camDist;
}

function endPinch() {
  const wasActive = pinch.active;
  pinch.active = pinch.candidate = false;
  pinch.a = pinch.b = null;
  if (wasActive) rememberCamDist();
  // A finger is often still down when the other lifts. Hand it back to
  // look-drag from where it actually is, or the view snaps.
  const rest = [...touches.keys()];
  if (wasActive && rest.length === 1) {
    const t = touches.get(rest[0]);
    look.active = true;
    look.id = rest[0];
    look.lastX = t.x;
    look.lastY = t.y;
  }
}

function startTouch(tch) {
  touches.set(tch.identifier, { x: tch.clientX, y: tch.clientY });
  openCandidate();
  if (tch.clientX < innerWidth * 0.5 && !joy.active) {
    joy.active = true;
    joy.id = tch.identifier;
    joy.cx = tch.clientX;
    joy.cy = tch.clientY;
    joy.x = joy.y = 0;
    stickEl.style.display = 'block';
    stickEl.style.left = joy.cx + 'px';
    stickEl.style.top = joy.cy + 'px';
    knobEl.style.transform = 'translate(-50%,-50%)';
  } else if (!look.active) {
    look.active = true;
    look.id = tch.identifier;
    look.lastX = tch.clientX;
    look.lastY = tch.clientY;
  }
}
function moveTouch(tch) {
  const t = touches.get(tch.identifier);
  if (t) {
    t.x = tch.clientX;
    t.y = tch.clientY;
  }

  // Zoom first: once a pinch is running it owns both fingers, so walking and
  // looking must not also act on them.
  if (
    (pinch.active || pinch.candidate) &&
    (tch.identifier === pinch.a || tch.identifier === pinch.b)
  ) {
    const A = touches.get(pinch.a),
      B = touches.get(pinch.b);
    if (A && B) {
      const gap = gapOf(A, B);
      if (pinch.candidate) {
        const C = CONFIG.camera;
        if (Math.abs(gap - pinch.gap0) > C.pinchThreshold && joyStray() < C.pinchJoyTolerance)
          commitPinch(gap);
      }
      if (pinch.active) {
        // Fingers apart -> smaller radius -> closer. A ratio rather than a
        // difference, so the same squeeze feels the same at every distance.
        if (gap > 1) setCamDist(pinch.dist0 * (pinch.gap / gap));
        return;
      }
    }
  }

  if (joy.active && tch.identifier === joy.id) {
    let dx = tch.clientX - joy.cx,
      dy = tch.clientY - joy.cy;
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx *= R / len;
      dy *= R / len;
    }
    joy.x = dx / R;
    joy.y = dy / R;
    knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  } else if (look.active && tch.identifier === look.id) {
    const C = CONFIG.camera;
    G.camYaw -= (tch.clientX - look.lastX) * C.dragSensitivity;
    // Dragging UP looks up: the finger moving up gives a negative delta, which
    // lowers the pitch, which drops the camera and lifts its aim at the sky.
    const dy = (tch.clientY - look.lastY) * C.dragSensitivityY * (C.invertY ? -1 : 1);
    G.camPitch = Math.max(C.pitchMin, Math.min(C.pitchMax, G.camPitch + dy));
    look.lastX = tch.clientX;
    look.lastY = tch.clientY;
  }
}
function endTouch(tch) {
  touches.delete(tch.identifier);
  if (
    (pinch.active || pinch.candidate) &&
    (tch.identifier === pinch.a || tch.identifier === pinch.b)
  )
    endPinch();
  if (joy.active && tch.identifier === joy.id) {
    joy.active = false;
    joy.x = joy.y = 0;
    stickEl.style.display = 'none';
  }
  if (look.active && tch.identifier === look.id) look.active = false;
}

canvas.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    for (const x of e.changedTouches) startTouch(x);
  },
  { passive: false },
);
canvas.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault();
    for (const x of e.changedTouches) moveTouch(x);
  },
  { passive: false },
);
canvas.addEventListener('touchend', (e) => {
  for (const x of e.changedTouches) endTouch(x);
});
canvas.addEventListener('touchcancel', (e) => {
  for (const x of e.changedTouches) endTouch(x);
});
// The mouse equivalent. Exponential rather than additive so a notch of wheel
// is the same proportional step whether you are close in or far out, and so it
// can never walk the distance down through zero.
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    setCamDist(G.camDist * Math.exp(e.deltaY * CONFIG.camera.wheelStep));
    rememberCamDist();
  },
  { passive: false },
);

canvas.addEventListener('mousedown', (e) =>
  startTouch({ clientX: e.clientX, clientY: e.clientY, identifier: 'm' }),
);
window.addEventListener('mousemove', (e) =>
  moveTouch({ clientX: e.clientX, clientY: e.clientY, identifier: 'm' }),
);
window.addEventListener('mouseup', () => endTouch({ identifier: 'm' }));
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  // C and V are one-shot actions, so they fire on the key going down rather
  // than being held. e.repeat guards against the keyboard auto-repeating.
  if (!e.repeat) {
    if (k === 'c') emit(EVENTS.CRAWL_TOGGLE);
    if (k === 'v') emit(EVENTS.WHISTLE);
    if (k === ' ') emit(EVENTS.JUMP);
  }
  if (k === ' ') e.preventDefault(); // space scrolls the page otherwise
  keys[k] = true;
});
// R and F tilt the view on a keyboard, the way Q and E turn it.
window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));
