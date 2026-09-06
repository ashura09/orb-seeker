// rules.js — the game's arithmetic, with no three.js and no DOM.
//
// These functions were inline inside orbs.js, duel.js and wanderers.js, which all
// import three.js and touch the document. That made them impossible to test: you
// cannot import orbs.js outside a browser, so the rules it contained could only ever
// be checked by playing the game and squinting.
//
// Nothing here knows what a mesh is. That is the whole point — `npm test` runs this
// file's logic in plain node, in milliseconds, with no renderer.
//
// Every function takes its randomness as an argument, defaulting to Math.random.
// A test can then hand in a fixed sequence and get a predictable answer, while the
// game passes nothing and behaves exactly as it did before.
//
// NOTE: this file may be renamed or moved when the project's module list lands. It
// is deliberately small and imported in only three places, so relocating it is a
// one-line change per caller.
import { CONFIG } from './config.js';

/**
 * How fast an opponent's bar fills, per second, for a villager camped by orb `tier`.
 * Tier 1 needs about 4 taps a second to beat; tier 7 about 12.
 */
export const tierRate = (tier) => CONFIG.duel.opponentBase + tier * CONFIG.duel.opponentPerTier;

/**
 * What a won duel pays.
 *
 * Pay scales with the camp's tier, so the villager by orb 7 is worth roughly twice
 * the one by orb 1 — their difficulty is their story, and their price follows it.
 *
 * The two random draws are taken in the same order the original inline code used
 * (flawless first, then the variance), so a fixed random sequence produces the same
 * results as before this was extracted.
 */
// ---------------------------------------------------------------------------
// PROGRESSION ARITHMETIC
//
// Here rather than in progress.js for the usual reason: progress.js touches the
// DOM and the save, so it cannot be imported in node. These five functions are
// the whole level system and `npm test` checks them in milliseconds.
// ---------------------------------------------------------------------------

/** XP needed to go from `level` to the next one. */
export const xpToNextLevel = (level) =>
  CONFIG.progress.curveBase + CONFIG.progress.curveStep * level;

/** Total XP a player must have earned to BE this level. Level 1 costs nothing. */
export function totalXpForLevel(level) {
  let sum = 0;
  for (let n = 1; n < level; n++) sum += xpToNextLevel(n);
  return sum;
}

/**
 * The level a given amount of XP buys.
 *
 * Counted up rather than solved algebraically. The closed form exists, but it
 * bakes in the shape of the curve, and this has to keep agreeing with
 * xpToNextLevel even if somebody changes that curve. Thirty iterations, run when
 * XP changes and not per frame.
 */
export function levelFromXp(xp) {
  const { maxLevel } = CONFIG.progress;
  let level = 1;
  let spent = 0;
  while (level < maxLevel && xp >= spent + xpToNextLevel(level)) {
    spent += xpToNextLevel(level);
    level++;
  }
  return level;
}

/** How far into the current level you are: {into, need}. Capped at max level. */
export function levelProgress(xp) {
  const level = levelFromXp(xp);
  if (level >= CONFIG.progress.maxLevel) return { into: 1, need: 1 };
  return { into: xp - totalXpForLevel(level), need: xpToNextLevel(level) };
}

/** The rank entry for a level -- the last threshold at or below it. */
export function rankFor(level) {
  const { ranks } = CONFIG.progress;
  let found = ranks[0];
  for (const r of ranks) if (level >= r.from) found = r;
  return found;
}

/** How many things this level may wear at once. */
export const slotsForLevel = (level) => rankFor(level).slots;

export function duelLoot(tier, random = Math.random) {
  const D = CONFIG.duel;
  const flawless = random() < D.flawlessChance;
  const base = D.lootBase + tier + Math.floor(random() * D.lootVariance);
  return { loot: flawless ? base * D.flawlessMultiplier : base, flawless };
}

/**
 * Chooses where the seven orbs land.
 *
 * Two rules, and the reason for each:
 *
 *   minSpacing        orbs must be far apart, or two of them share a hillside and
 *                     the search stops being a search.
 *   minFromPlayer     none may land on top of you, or the first is free.
 *
 * The search is bounded by `attempts` rather than looping until it succeeds: a bad
 * combination of radii could otherwise make this run forever. If it runs out, the
 * remaining spots are placed without the spacing rule — a slightly worse valley is
 * better than a game that never starts.
 *
 * The result is then SHUFFLED, so an orb's number tells you nothing about where it
 * is. Without that, orb 1 would always be the closest to the centre.
 */
export function pickOrbSpots(opts = {}) {
  const O = CONFIG.orbs;
  const {
    count = 7,
    inner = O.innerRadius,
    outer = O.outerRadius,
    minSpacing = O.minSpacing,
    minFromPlayer = O.minDistanceFromPlayer,
    playerX = 0,
    playerZ = 0,
    attempts = 4000,
    random = Math.random,
  } = opts;

  const spread = outer - inner;
  const spots = [];
  const roll = () => {
    const a = random() * Math.PI * 2;
    const r = inner + random() * spread;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  };

  let guard = 0;
  while (spots.length < count && guard++ < attempts) {
    const p = roll();
    if (Math.hypot(p.x - playerX, p.z - playerZ) < minFromPlayer) continue;
    if (spots.every((s) => Math.hypot(s.x - p.x, s.z - p.z) >= minSpacing)) spots.push(p);
  }
  // Ran out of attempts: fill the rest without the spacing rule rather than hang.
  while (spots.length < count) spots.push(roll());

  // Fisher-Yates, so the number on an orb says nothing about its position.
  for (let i = spots.length - 1; i > 0; i--) {
    const j = (random() * (i + 1)) | 0;
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return spots;
}
