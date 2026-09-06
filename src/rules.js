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

// ---------------------------------------------------------------------------
// VALLEY CODES
//
// The world is generated deterministically from a seed, which means the same
// number makes the same valley on any phone, anywhere, with no server involved.
// That turns "play my exact valley" into a code a child can read out loud -- so
// it has to survive being read out loud.
//
// The alphabet therefore drops the characters people confuse when copying by
// hand: no O or 0, no I or 1, no S or 5. Everything is uppercased on the way in,
// so a code typed in lowercase still works.
// ---------------------------------------------------------------------------
const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ23456789'; // 31 symbols, no lookalikes

/** A seed as a short, sayable code: VALE-7K2M. */
export function seedCode(seed) {
  let n = Math.abs(Math.floor(seed)) % 31 ** 6;
  let out = '';
  for (let i = 0; i < 6; i++) {
    out = ALPHABET[n % 31] + out;
    n = Math.floor(n / 31);
  }
  return `VALE-${out.slice(0, 3)}${out.slice(3)}`;
}

/** A code back to its seed, or null if it is not one. Forgiving about case and spacing. */
export function seedFromCode(code) {
  const body = String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^VALE/, '');
  if (body.length !== 6) return null;
  let n = 0;
  for (const ch of body) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    n = n * 31 + i;
  }
  return n;
}

// ---------------------------------------------------------------------------
// THE LADDER
// ---------------------------------------------------------------------------

/**
 * Score one finished valley.
 *
 * @param r  {seconds, orbs, perfectOrder, duelsWon, duelsLost}
 */
export function runScore(r) {
  const S = CONFIG.ladder.score;
  const speed = Math.max(0, S.parSeconds - (r.seconds || 0)) * S.perSecondUnder;
  return Math.max(
    0,
    Math.round(
      S.base +
        (r.orbs || 0) * S.perOrb +
        (r.perfectOrder ? S.perfectOrder : 0) +
        (r.duelsWon || 0) * S.duelWon +
        (r.duelsLost || 0) * S.duelLost +
        speed,
    ),
  );
}

/**
 * Where a rating sits on the ladder: {tier, division, name, next}.
 *
 * `next` is the rating that earns the next step -- null at the top. Showing the
 * near step rather than the far one is the whole point of divisions: there is
 * always something close enough to be worth one more run.
 */
export function ladderFor(rating) {
  const { tiers, divisions, apex } = CONFIG.ladder;
  if (rating >= apex.from) {
    return { tier: apex.name, division: '', name: apex.name, next: null };
  }
  let i = 0;
  for (let n = 0; n < tiers.length; n++) if (rating >= tiers[n].from) i = n;
  const tier = tiers[i];
  const top = i + 1 < tiers.length ? tiers[i + 1].from : apex.from;
  const band = (top - tier.from) / divisions.length;
  const d = Math.min(divisions.length - 1, Math.floor((rating - tier.from) / band));
  const next = Math.round(tier.from + band * (d + 1));
  return {
    tier: tier.name,
    division: divisions[d],
    name: `${tier.name} ${divisions[d]}`,
    next,
  };
}

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
    // Metres from the player to put ORB ONE. Zero means the normal scatter.
    // Only ever set for a player's first valley -- see CONFIG.onboarding.
    nearFirst = 0,
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

  // A first valley starts with orb ONE within sight. It must be orb one and not
  // merely the nearest orb: the order rule rewards collecting 1 to 7 in sequence,
  // so dropping a stranger's number at the player's feet would have them break it
  // in the first fifteen seconds without ever being told there was an order.
  //
  // Done after the shuffle, because the shuffle is what decides which number goes
  // where, and index 0 is orb one.
  if (nearFirst > 0) {
    const a = random() * Math.PI * 2;
    spots[0] = { x: playerX + Math.cos(a) * nearFirst, z: playerZ + Math.sin(a) * nearFirst };
  }
  return spots;
}
