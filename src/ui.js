// ui.js — toasts, the fragment pouch counter, and the little bump animation.
import { $ } from './state.js';
import { save, persist } from './save.js';

export const pouchEl = $('pouch'), fragEl = $('fragCount');
export function renderPouch(){ fragEl.textContent = save.fragments; }
export function bump(el){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
export function addFragments(n){ save.fragments += n; persist(); renderPouch(); bump(pouchEl); }
renderPouch();

export const toastEl = $('toast');
let toastT = 0;
export function toast(msg, secs=2.2){ toastEl.textContent = msg; toastEl.style.opacity = 1; toastT = secs; }

// Counts the current toast down; called once per frame from main.js.
// (In the original this was two lines inline in the frame loop.)
export function updateToast(dt){
  if (toastT > 0){ toastT -= dt; if (toastT <= 0) toastEl.style.opacity = 0; }
}

export const ordinal = n => n + (['th','st','nd','rd'][(n%100-20)%10] || ['th','st','nd','rd'][n%100] || 'th');
