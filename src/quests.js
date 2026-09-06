// quests.js — three things to do today, and a reason to come back tomorrow.
//
// docs/GAME-DESIGN.md section 5. Lifted from 99 Nights in the Forest, which added
// exactly this and climbed: one easy, one medium and one hard, reset every
// twenty-four hours, drawn from a fixed pool.
//
// WHY THE DAY'S THREE ARE CHOSEN FROM THE DATE
//
// There is no server, and there never will be for this -- so "today's quests"
// have to be the same three every time the page is opened, without anyone being
// asked to remember them. Hashing the date gives that for free: the same day
// always produces the same three, on any device, with nothing stored and nothing
// to go out of sync. It also means a child cannot reroll a hard quest by
// refreshing, which they absolutely would.
//
// The counters reset with the day. Yesterday's half-finished walk does not carry
// over, because a quest you are already most of the way through is not a reason
// to open the game.
import { CONFIG } from './config.js';
import { save, persist } from './save.js';
import { on, emit, EVENTS } from './events.js';
import { loadQuests, QUEST_TIERS } from './content.js';
import { addXp } from './progress.js';
import { toast } from './ui.js';
import { player } from './player.js';

const Q = CONFIG.quests;

/**
 * Every counter a quest is allowed to name. Declared here because this is what
 * keeps them: a quest counting something nobody counts would sit at zero forever
 * and merely look hard.
 */
export const METRICS = [
  'orbs',
  'duelsWon',
  'duelsFought',
  'metres',
  'valleys',
  'perfectValleys',
  'flawlessValleys',
  'fastValleys',
  'bestCampBeaten',
];

export const QUESTS = loadQuests(METRICS);

/** Local date, not UTC: "today" should mean the child's today. */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A stable number from a string, so a date always picks the same three. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickForDay(day) {
  const h = hash(day);
  return QUEST_TIERS.map((tier, i) => {
    const pool = QUESTS.filter((q) => q.tier === tier);
    // A different slice of the hash per tier, so the three do not move in step.
    return pool[(h >>> (i * 8)) % pool.length].id;
  });
}

/** Start a new day if the date has turned. Safe to call as often as you like. */
function rollDay() {
  const day = today();
  if (save.daily?.day === day) return;
  save.daily = { day, ids: pickForDay(day), counts: {}, done: [] };
  persist();
}
rollDay();

export const todaysQuests = () =>
  save.daily.ids.map((id) => QUESTS.find((q) => q.id === id)).filter(Boolean);

export const questProgress = (q) => Math.min(q.goal, save.daily.counts[q.metric] || 0);
export const questDone = (q) => save.daily.done.includes(q.id);

/**
 * Add to a counter and award anything it finishes.
 *
 * `highest` metrics (the hardest camp beaten today) take the maximum rather than
 * a sum -- beating tier 7 once is the achievement, not beating tier 1 seven times.
 */
function bump(metric, amount, highest = false) {
  rollDay();
  const c = save.daily.counts;
  c[metric] = highest ? Math.max(c[metric] || 0, amount) : (c[metric] || 0) + amount;

  for (const q of todaysQuests()) {
    if (q.metric !== metric || questDone(q) || (c[metric] || 0) < q.goal) continue;
    save.daily.done.push(q.id);
    save.questsDone = (save.questsDone || 0) + 1;
    addXp(Q.xp[q.tier], 'a daily quest');
    toast(`Daily done — ${q.text}`, 3);
    emit(EVENTS.QUEST_DONE, q);
  }
  persist();
}

// ---------------------------------------------------------------------------
// What feeds the counters.
// ---------------------------------------------------------------------------
on(EVENTS.ORB_COLLECTED, () => bump('orbs', 1));

on(EVENTS.DUEL_ENDED, ({ won, tier }) => {
  bump('duelsFought', 1);
  if (won) {
    bump('duelsWon', 1);
    bump('bestCampBeaten', tier, true);
  }
});

on(EVENTS.RUN_COMPLETE, (r) => {
  bump('valleys', 1);
  if (r.perfectOrder) bump('perfectValleys', 1);
  if (r.duelsLost === 0) bump('flawlessValleys', 1);
  if (r.seconds < 480) bump('fastValleys', 1);
});

// Distance walked, accumulated a frame at a time. Whole metres only: writing a
// float to the save sixty times a second would be silly, and a quest counting
// half a metre is not a quest.
let lastX = 0;
let lastZ = 0;
let partial = 0;
let started = false;

export function updateQuests() {
  if (!started) {
    lastX = player.position.x;
    lastZ = player.position.z;
    started = true;
    return;
  }
  const dx = player.position.x - lastX;
  const dz = player.position.z - lastZ;
  lastX = player.position.x;
  lastZ = player.position.z;
  const step = Math.hypot(dx, dz);
  // A valley rebuild teleports you; that is not walking.
  if (step > 5) return;
  partial += step;
  if (partial >= 1) {
    const whole = Math.floor(partial);
    partial -= whole;
    bump('metres', whole);
  }
}
