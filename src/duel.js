// duel.js — the ten-second tap duel.
//
// Fill your bar before the wanderer fills theirs. Their speed comes from the
// tier of the orb they camp near (see wanderers.js).
import { $, G } from './state.js';
import { save } from './save.js';
import { worn } from './loadout.js';
import { addFragments } from './ui.js';
import { joy, stickEl } from './input.js';
import { pickTarget } from './wanderers.js';
import { tierRate, duelLoot } from './rules.js';
import { on, EVENTS } from './events.js';
import { CONFIG } from './config.js';
import { voiceOf } from './voice.js';

const duelEl = $('duel');
const D = CONFIG.duel;
export const duel = {
  w: null,
  you: 0,
  them: 0,
  time: D.seconds,
  ready: D.countdown,
  waiting: true,
  over: false,
};

export function startDuel(w) {
  G.state = 'duel';
  duel.w = w;
  duel.you = 0;
  duel.them = 0;
  duel.time = D.seconds;
  duel.ready = D.countdown;
  duel.waiting = true;
  duel.over = false;
  joy.active = false;
  joy.x = joy.y = 0;
  stickEl.style.display = 'none';
  const tierWord = [
    'a gentle',
    'an easy',
    'a steady',
    'a quick',
    'a fast',
    'a fierce',
    'a blistering',
  ][w.tier - 1];
  // What they say comes first; the rules go underneath, quieter.
  $('duelWho').textContent = `“${voiceOf(w.short).challenge}”`;
  $('duelRules').textContent =
    `${w.name} keeps camp by orb ${w.tier}, so expect ${tierWord} pace. Ten seconds: tap to fill your bar before theirs.`;
  $('resultSay').textContent = '';
  $('themName').textContent = w.short;
  $('duelPlay').style.display = 'block';
  $('duelResult').style.display = 'none';
  $('duelStart').style.display = 'inline-block';
  $('tapzone').style.display = 'none';
  $('tapzone').textContent = 'Get ready…';
  renderDuel();
  duelEl.classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate(30);
}

$('duelStart').addEventListener('click', () => {
  duel.waiting = false;
  $('duelStart').style.display = 'none';
  $('tapzone').style.display = 'flex';
});

export function renderDuel() {
  $('timer').textContent = duel.waiting
    ? D.seconds.toFixed(1)
    : duel.ready > 0
      ? String(Math.ceil(duel.ready))
      : Math.max(0, duel.time).toFixed(1);
  const y = Math.min(100, duel.you * 100),
    th = Math.min(100, duel.them * 100);
  $('youBar').style.width = y + '%';
  $('youPct').textContent = Math.round(y) + '%';
  $('themBar').style.width = th + '%';
  $('themPct').textContent = Math.round(th) + '%';
}

export function tap() {
  if (G.state !== 'duel' || duel.over || duel.waiting || duel.ready > 0) return;
  duel.you += worn('grip') ? D.tapValueWithGrip : D.tapValue;
  if (navigator.vibrate) navigator.vibrate(8);
  renderDuel();
  if (duel.you >= 1) endDuel(true);
}
$('tapzone').addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    tap();
  },
  { passive: false },
);
$('tapzone').addEventListener('mousedown', tap);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') tap();
});

export function updateDuel(dt) {
  if (duel.over || duel.waiting) return;
  if (duel.ready > 0) {
    duel.ready -= dt;
    if (duel.ready <= 0) {
      $('tapzone').textContent = 'Tap!';
      if (navigator.vibrate) navigator.vibrate(25);
    }
    renderDuel();
    return;
  }
  duel.time -= dt;
  duel.them += dt * tierRate(duel.w.tier);
  renderDuel();
  if (duel.them >= 1) endDuel(false);
  else if (duel.time <= 0) endDuel(duel.you > duel.them);
}

export function endDuel(won) {
  duel.over = true;
  let loot;
  const first = duel.w.short;
  if (won) {
    save.wins++;
    // pay scales with the camp's tier: about 3 near orb 1, about 10 near orb 7,
    // doubled on a flawless roll. The arithmetic lives in rules.js so it can be tested.
    const paid = duelLoot(duel.w.tier);
    loot = paid.loot;
    const flawless = paid.flawless;
    $('resultBig').textContent = flawless ? 'Flawless!' : 'You win';
    $('resultSay').textContent = `“${voiceOf(duel.w.short).theyLose}”`;
    $('resultLoot').textContent = `${first} hands over ${loot} fragments.`;
    if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
  } else {
    loot = D.consolation;
    $('resultBig').textContent = 'Outpaced';
    $('resultSay').textContent = `“${voiceOf(duel.w.short).theyWin}”`;
    $('resultLoot').textContent = `${first} wins, but tosses you ${loot} fragment for the effort.`;
  }
  addFragments(loot);
  duel.w.cooldown = CONFIG.wanderers.cooldown;
  pickTarget(duel.w);
  setTimeout(() => {
    $('duelPlay').style.display = 'none';
    $('duelResult').style.display = 'block';
  }, D.resultDelay);
}

$('duelDone').addEventListener('click', () => {
  duelEl.classList.add('hidden');
  G.state = 'play';
});

// wanderers.js announces that a villager caught you; it does not open the panel
// itself, so it no longer needs to know this file exists.
on(EVENTS.DUEL_CHALLENGE, startDuel);
