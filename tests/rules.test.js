// Tests for the game's arithmetic: orb placement and duel maths.
//
// These run in plain node with no renderer, which is only possible because
// src/rules.js imports neither three.js nor the DOM.
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { pickOrbSpots, duelLoot, tierRate } from '../src/rules.js';

/** A random() that plays back a fixed list, so a result can be predicted exactly. */
function scripted(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('pickOrbSpots', () => {
  it('always returns seven spots', () => {
    for (let run = 0; run < 50; run++) {
      expect(pickOrbSpots()).toHaveLength(7);
    }
  });

  it('keeps every pair at least minSpacing apart', () => {
    const min = CONFIG.orbs.minSpacing;
    for (let run = 0; run < 200; run++) {
      const spots = pickOrbSpots();
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const d = Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z);
          expect(d).toBeGreaterThanOrEqual(min);
        }
      }
    }
  });

  it('never drops an orb on top of the player', () => {
    const min = CONFIG.orbs.minDistanceFromPlayer;
    for (let run = 0; run < 200; run++) {
      // somewhere off-centre, so this is not accidentally satisfied by the inner radius
      const px = 30,
        pz = -45;
      for (const s of pickOrbSpots({ playerX: px, playerZ: pz })) {
        expect(Math.hypot(s.x - px, s.z - pz)).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it('lands inside the configured ring', () => {
    const { innerRadius, outerRadius } = CONFIG.orbs;
    for (const s of pickOrbSpots()) {
      const r = Math.hypot(s.x, s.z);
      expect(r).toBeGreaterThanOrEqual(innerRadius - 1e-9);
      expect(r).toBeLessThanOrEqual(outerRadius + 1e-9);
    }
  });

  it('still returns seven when the constraints cannot all be met', () => {
    // An impossible ask: seven spots 500 m apart inside a 10 m ring. The bounded
    // search must give up and fill the rest rather than loop forever.
    const spots = pickOrbSpots({ inner: 0, outer: 10, minSpacing: 500, attempts: 200 });
    expect(spots).toHaveLength(7);
  });

  it('shuffles, so an orb number does not follow generation order', () => {
    // Constraints off, so each spot costs exactly two draws (angle, then radius)
    // and the sequence below is fully predictable. Angle 0 puts x = radius.
    const generation = [];
    for (let i = 0; i < 7; i++) generation.push(0, i / 10);
    // Then six Fisher-Yates draws, all 0, which swaps each index in turn with 0.
    const shuffle = [0, 0, 0, 0, 0, 0];

    const spots = pickOrbSpots({
      inner: 0,
      outer: 1,
      minSpacing: 0,
      minFromPlayer: 0,
      random: scripted([...generation, ...shuffle]),
    });

    const xs = spots.map((s) => s.x);
    // Generation order would be 0, .1, .2 … .6 — the shuffle must not leave it that way.
    expect(xs[0]).not.toBeCloseTo(0, 6);
    expect(xs.map((x) => +x.toFixed(6))).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0]);
  });
});

describe('duel tier maths', () => {
  it('fills the opponent bar faster for a higher tier', () => {
    const { opponentBase, opponentPerTier } = CONFIG.duel;
    expect(tierRate(1)).toBeCloseTo(opponentBase + opponentPerTier, 10);
    expect(tierRate(7)).toBeCloseTo(opponentBase + 7 * opponentPerTier, 10);
    for (let t = 2; t <= 7; t++) expect(tierRate(t)).toBeGreaterThan(tierRate(t - 1));
  });

  it('is beatable at tier 1 and hard at tier 7 within the duel length', () => {
    // Sanity-checks the comment in config.js: tier 1 ≈ 4 taps/s, tier 7 ≈ 12 taps/s.
    const { seconds, tapValue } = CONFIG.duel;
    const tapsPerSecondToBeat = (tier) => tierRate(tier) / tapValue;
    expect(tapsPerSecondToBeat(1)).toBeLessThan(6);
    expect(tapsPerSecondToBeat(7)).toBeGreaterThan(10);
    expect(seconds).toBeGreaterThan(0);
  });

  it('pays more for a higher tier', () => {
    const noFlourish = () => 0.5; // above flawlessChance, and floor(0.5*variance) is fixed
    let previous = -Infinity;
    for (let tier = 1; tier <= 7; tier++) {
      const { loot, flawless } = duelLoot(tier, noFlourish);
      expect(flawless).toBe(false);
      expect(loot).toBeGreaterThan(previous);
      previous = loot;
    }
  });

  it('doubles the pay on a flawless roll, and reports it', () => {
    const D = CONFIG.duel;
    // first draw decides flawless, second decides the variance
    const plain = duelLoot(3, scripted([0.99, 0]));
    const flawlessRun = duelLoot(3, scripted([0, 0]));
    expect(plain.flawless).toBe(false);
    expect(flawlessRun.flawless).toBe(true);
    expect(plain.loot).toBe(D.lootBase + 3);
    expect(flawlessRun.loot).toBe(plain.loot * D.flawlessMultiplier);
  });

  it('never pays less than the base for a win', () => {
    for (let run = 0; run < 500; run++) {
      const tier = 1 + (run % 7);
      expect(duelLoot(tier).loot).toBeGreaterThanOrEqual(CONFIG.duel.lootBase + tier);
    }
  });
});
