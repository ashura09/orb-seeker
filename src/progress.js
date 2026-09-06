// progress.js — Seeker levels: the number that only ever goes up.
//
// docs/GAME-DESIGN.md section 4. Until now Orb Seeker had one five-minute loop
// that paid a currency with nothing left to buy and ended in a world re-roll
// that granted nothing at all. There was no reason to play a second valley.
// XP is the answer to "why again?", and it is deliberately earned for playing at
// all rather than for playing well: a child who loses every duel still climbs.
//
// The arithmetic is NOT here. It lives in rules.js, which imports no DOM and no
// three.js, so `npm test` can check the whole curve in milliseconds. This file
// is the wiring: awarding, announcing, drawing the bar, and one migration.
import { CONFIG } from './config.js';
import { save, persist, owned } from './save.js';
import { emit, EVENTS } from './events.js';
import { levelFromXp, levelProgress, rankFor } from './rules.js';
import { $ } from './state.js';

const P = CONFIG.progress;

let level = levelFromXp(save.xp);

export const currentLevel = () => level;
export const currentRank = () => rankFor(level);

/**
 * Award XP and, if it crosses a threshold, announce the level-up.
 *
 * @param amount  how much
 * @param reason  short phrase for the level-up message ("orb found", "duel won")
 */
export function addXp(amount, reason = '') {
  if (!Number.isFinite(amount) || amount <= 0) return;
  save.xp += amount;
  const now = levelFromXp(save.xp);
  const gained = now > level;
  const before = level;
  level = now;
  persist();
  renderProgress();
  emit(EVENTS.XP_GAINED, { amount, reason });
  if (gained) {
    // The rank only changes at some levels, and being told you are now an
    // Orbkeeper matters more than being told you are level 10 -- so the payload
    // says whether the name changed, and the listener decides how loud to be.
    emit(EVENTS.LEVEL_UP, {
      level: now,
      from: before,
      rank: rankFor(now),
      newRank: rankFor(now).name !== rankFor(before).name,
      reason,
    });
  }
}

// ---------------------------------------------------------------------------
// The HUD chip: rank, level, and a bar showing the way to the next one.
// ---------------------------------------------------------------------------
export function renderProgress() {
  const el = $('rankName');
  if (!el) return; // the bench and the tests have no HUD
  const rank = rankFor(level);
  el.textContent = rank.name;
  $('lvlNum').textContent = level >= P.maxLevel ? 'MAX' : `Lv ${level}`;
  const { into, need } = levelProgress(save.xp);
  $('xpFill').style.width = `${Math.min(100, (into / need) * 100)}%`;
  $('progress').title =
    level >= P.maxLevel
      ? `${rank.name} — level ${level}, the cap`
      : `${rank.name} — level ${level}. ${need - into} XP to level ${level + 1}.`;
}
renderProgress();

/** Everything the score screen and the satchel want to say about the climb. */
export function progressSummary() {
  const { into, need } = levelProgress(save.xp);
  return {
    xp: save.xp,
    level,
    rank: rankFor(level).name,
    slots: rankFor(level).slots,
    into,
    need,
    atCap: level >= P.maxLevel,
    itemsOwned: Object.keys(save.items).filter((id) => owned(id)).length,
  };
}
