// rng.js — seeded randomness, so a world can be rebuilt exactly from a number.
//
// Math.random() cannot be reproduced. Everything about the valley's layout goes
// through here instead, which buys two things:
//
//   1. The valley can be re-rolled each gathering just by changing the seed.
//   2. It is the foundation for chunked generation later: hash the coordinates
//      of a patch of ground into a seed, generate that patch from it, and the
//      same patch regenerates identically every time you walk back to it --
//      without ever storing a map. The chunk coordinate IS the saved data.
//
// Imports nothing, does nothing. Layer 0.

/**
 * mulberry32: small, fast, and good enough for scattering trees.
 * Returns a function that yields the next number in 0..1.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mixes two integer coordinates and a world seed into one seed value.
 *
 * This is the piece that makes an endless world possible without storing it:
 * cellSeed(cx, cz, worldSeed) always gives the same number for the same cell,
 * so makeRng(cellSeed(...)) always generates that cell's contents identically.
 * Not needed for the bounded valley yet -- it is here because the moment you
 * want streaming terrain, this is the whole mechanism.
 */
export function cellSeed(cx, cz, worldSeed = 0) {
  let h = worldSeed >>> 0;
  h = Math.imul(h ^ (cx >>> 0), 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h ^ (cz >>> 0), 0x165667b1);
  h ^= h >>> 13;
  return h >>> 0;
}

/** A fresh seed for a new gathering. */
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
