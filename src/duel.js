// duel.js — the ten-second tap duel.
//
// Fill your bar before the wanderer fills theirs. Their speed comes from the
// tier of the orb they camp near (see wanderers.js).
import { $, G } from './state.js';
import { save, owned } from './save.js';
import { addFragments } from './ui.js';
import { joy, stickEl } from './input.js';
import { tierRate, pickTarget } from './wanderers.js';
import { on, EVENTS } from './events.js';
import { CONFIG } from './config.js';

const duelEl = $('duel');
const D = CONFIG.duel;
export const duel = {w:null, you:0, them:0, time:D.seconds, ready:D.countdown, waiting:true, over:false};

export function startDuel(w){
  G.state = 'duel'; duel.w = w; duel.you = 0; duel.them = 0; duel.time = D.seconds; duel.ready = D.countdown; duel.waiting = true; duel.over = false;
  joy.active = false; joy.x = joy.y = 0; stickEl.style.display = 'none';
  const tierWord = ['a gentle', 'an easy', 'a steady', 'a quick', 'a fast', 'a fierce', 'a blistering'][w.tier-1];
  $('duelWho').textContent = `${w.name} challenges you. Keeps camp near orb ${w.tier}, so expect ${tierWord} pace. Ten seconds: tap as fast as you can and fill your bar before theirs. Press ready when you are, and a short count will start.`;
  $('themName').textContent = w.short;
  $('duelPlay').style.display = 'block'; $('duelResult').style.display = 'none';
  $('duelStart').style.display = 'inline-block'; $('tapzone').style.display = 'none'; $('tapzone').textContent = 'Get ready…';
  renderDuel(); duelEl.classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate(30);
}

$('duelStart').addEventListener('click', () => { duel.waiting = false; $('duelStart').style.display = 'none'; $('tapzone').style.display = 'flex'; });

export function renderDuel(){
  $('timer').textContent = duel.waiting ? D.seconds.toFixed(1) : duel.ready > 0 ? String(Math.ceil(duel.ready)) : Math.max(0, duel.time).toFixed(1);
  const y = Math.min(100, duel.you*100), th = Math.min(100, duel.them*100);
  $('youBar').style.width = y+'%'; $('youPct').textContent = Math.round(y)+'%';
  $('themBar').style.width = th+'%'; $('themPct').textContent = Math.round(th)+'%';
}

export function tap(){
  if (G.state !== 'duel' || duel.over || duel.waiting || duel.ready > 0) return;
  duel.you += owned('grip') ? D.tapValueWithGrip : D.tapValue;
  if (navigator.vibrate) navigator.vibrate(8);
  renderDuel(); if (duel.you >= 1) endDuel(true);
}
$('tapzone').addEventListener('touchstart', e => { e.preventDefault(); tap(); }, {passive:false});
$('tapzone').addEventListener('mousedown', tap);
window.addEventListener('keydown', e => { if (e.code === 'Space') tap(); });

export function updateDuel(dt){
  if (duel.over || duel.waiting) return;
  if (duel.ready > 0){
    duel.ready -= dt;
    if (duel.ready <= 0){ $('tapzone').textContent = 'Tap!'; if (navigator.vibrate) navigator.vibrate(25); }
    renderDuel(); return;
  }
  duel.time -= dt;
  duel.them += dt * tierRate(duel.w.tier);
  renderDuel();
  if (duel.them >= 1) endDuel(false); else if (duel.time <= 0) endDuel(duel.you > duel.them);
}

export function endDuel(won){
  duel.over = true; let loot;
  const first = duel.w.short;
  if (won){
    save.wins++; const roll = Math.random();
    // pay scales with the camp's tier: about 3 near orb 1, about 10 near orb 7, doubled on a flawless roll
    const base = D.lootBase + duel.w.tier + Math.floor(Math.random()*D.lootVariance);
    const flawless = roll < D.flawlessChance;
    loot = flawless ? base*D.flawlessMultiplier : base;
    $('resultBig').textContent = flawless ? 'Flawless!' : 'You win';
    $('resultLoot').textContent = `${first} hands over ${loot} fragments.`;
    if (navigator.vibrate) navigator.vibrate([40,40,80]);
  } else {
    loot = D.consolation; $('resultBig').textContent = 'Outpaced';
    $('resultLoot').textContent = `${first} wins, but tosses you ${loot} fragment for the effort.`;
  }
  addFragments(loot); duel.w.cooldown = CONFIG.wanderers.cooldown; pickTarget(duel.w);
  setTimeout(() => { $('duelPlay').style.display = 'none'; $('duelResult').style.display = 'block'; }, D.resultDelay);
}

$('duelDone').addEventListener('click', () => { duelEl.classList.add('hidden'); G.state = 'play'; });

// wanderers.js announces that a villager caught you; it does not open the panel
// itself, so it no longer needs to know this file exists.
on(EVENTS.DUEL_CHALLENGE, startDuel);
