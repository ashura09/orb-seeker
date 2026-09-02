// ui.js — toasts, the fragment pouch counter, and the little bump animation.
import { $ } from './state.js';
import { save, persist } from './save.js';
import { emit, EVENTS } from './events.js';

export const pouchEl = $('pouch'), fragEl = $('fragCount');
export function renderPouch(){ fragEl.textContent = save.fragments; }
export function bump(el){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
export function addFragments(n){ save.fragments += n; persist(); renderPouch(); bump(pouchEl); }
renderPouch();

export const toastEl = $('toast');
let toastT = 0;
export function toast(msg, secs=2.2){ toastEl.classList.remove('echo'); toastEl.textContent = msg; toastEl.style.opacity = 1; toastT = secs; }

// Counts the current toast down; called once per frame from main.js.
// (In the original this was two lines inline in the frame loop.)
export function updateToast(dt){
  if (toastT > 0){ toastT -= dt; if (toastT <= 0) toastEl.style.opacity = 0; }
}

// ---------- the order chain ----------
// Collecting 1..7 in order is worth three wishes instead of one. That tension
// used to be announced by a toast that faded; now it sits beside the counter
// for as long as it matters.
const orderTag = document.createElement('span');
orderTag.id = 'orderTag';
orderTag.className = 'none';
$('counter').appendChild(orderTag);

export function showOrder(kept, found){
  if (found === 0){ orderTag.className = 'none'; orderTag.textContent = ''; return; }
  orderTag.className = kept ? 'kept' : 'broken';
  orderTag.textContent = kept ? 'in order' : 'order broken';
}

// A toast in the Keeper's register rather than the HUD's -- used for old wishes
// resurfacing, which should feel like a memory, not a notification.
export function echoToast(msg, secs = 5){
  toast(msg, secs);
  toastEl.classList.add('echo');
}

// ---------- crawl and whistle buttons ----------
// They only announce intent; main.js decides what the game does about it.
const crawlBtn = $('crawlBtn'), whistleBtn = $('whistleBtn');
crawlBtn.addEventListener('click', () => emit(EVENTS.CRAWL_TOGGLE));
whistleBtn.addEventListener('click', () => emit(EVENTS.WHISTLE));

export function setCrawlButton(on){
  crawlBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  crawlBtn.textContent = on ? 'Stand' : 'Crawl';
}

// Greyed out while the whistle is on cooldown, so the button tells the truth.
export function setWhistleReady(ready){
  whistleBtn.disabled = !ready;
}

export const ordinal = n => n + (['th','st','nd','rd'][(n%100-20)%10] || ['th','st','nd','rd'][n%100] || 'th');

// ---------- stats overlay ----------
// Off by default. Add ?stats to the URL to switch it on, e.g.
//   http://192.168.1.23:5173/?stats      (dev server, on your phone)
//   https://ashura09.github.io/orb-seeker/?stats
// Shows frames per second, draw calls and triangles. Draw calls are the number
// the phone cares about most: each one is a separate instruction to the GPU.
export function initStats(renderer){
  // URLSearchParams rather than a regex: no escaping to get wrong.
  if (!new URLSearchParams(location.search).has('stats')) return;
  const el = document.createElement('div');
  el.id = 'stats';
  document.body.appendChild(el);
  let frames = 0, last = performance.now(), worst = 999;
  (function tick(){
    requestAnimationFrame(tick);
    frames++;
    const now = performance.now();
    if (now - last >= 500){
      const fps = Math.round(frames * 1000 / (now - last));
      if (fps < worst) worst = fps;
      frames = 0; last = now;
      const r = renderer.info.render;
      el.textContent = `${fps} fps (low ${worst})  ${r.calls} calls  ${(r.triangles/1000).toFixed(1)}k tris`;
    }
  })();
}
