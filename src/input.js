// input.js — the thumb joystick, look-drag, and keyboard.
//
// The left half of the screen walks, the right half looks around. Both are
// exported so duel.js can force the joystick to let go when a duel starts.
import { $, G, canvas } from './state.js';

export const stickEl = $('stick'), knobEl = $('knob');
export const joy = {active:false, id:null, cx:0, cy:0, x:0, y:0};
export const look = {active:false, id:null, lastX:0};
export const keys = {};
const R = 55;

function startTouch(tch){
  if (tch.clientX < innerWidth*0.5 && !joy.active){
    joy.active = true; joy.id = tch.identifier; joy.cx = tch.clientX; joy.cy = tch.clientY; joy.x = joy.y = 0;
    stickEl.style.display = 'block'; stickEl.style.left = joy.cx+'px'; stickEl.style.top = joy.cy+'px'; knobEl.style.transform = 'translate(-50%,-50%)';
  } else if (!look.active){ look.active = true; look.id = tch.identifier; look.lastX = tch.clientX; }
}
function moveTouch(tch){
  if (joy.active && tch.identifier === joy.id){
    let dx = tch.clientX - joy.cx, dy = tch.clientY - joy.cy; const len = Math.hypot(dx, dy);
    if (len > R){ dx *= R/len; dy *= R/len; }
    joy.x = dx/R; joy.y = dy/R; knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  } else if (look.active && tch.identifier === look.id){ G.camYaw -= (tch.clientX - look.lastX) * 0.008; look.lastX = tch.clientX; }
}
function endTouch(tch){
  if (joy.active && tch.identifier === joy.id){ joy.active=false; joy.x=joy.y=0; stickEl.style.display='none'; }
  if (look.active && tch.identifier === look.id) look.active=false;
}

canvas.addEventListener('touchstart', e => { e.preventDefault(); for (const x of e.changedTouches) startTouch(x); }, {passive:false});
canvas.addEventListener('touchmove',  e => { e.preventDefault(); for (const x of e.changedTouches) moveTouch(x); }, {passive:false});
canvas.addEventListener('touchend',   e => { for (const x of e.changedTouches) endTouch(x); });
canvas.addEventListener('touchcancel',e => { for (const x of e.changedTouches) endTouch(x); });
canvas.addEventListener('mousedown', e => startTouch({clientX:e.clientX, clientY:e.clientY, identifier:'m'}));
window.addEventListener('mousemove', e => moveTouch({clientX:e.clientX, clientY:e.clientY, identifier:'m'}));
window.addEventListener('mouseup',   () => endTouch({identifier:'m'}));
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup',   e => keys[e.key.toLowerCase()] = false);
