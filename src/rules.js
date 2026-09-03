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
