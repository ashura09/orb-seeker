// Owning an item and wearing it are two different facts. These assertions were
// previously in a hand-rolled loadout.test.mjs with a bespoke check() helper; they
// are ported here unchanged in meaning so nothing already covered was lost.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const KEY = 'orbseeker.save.v2';

function fakeStorage(initial) {
  const store = new Map([[KEY, initial]]);
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
}

// Enough XP to be at the cap, so the owning-versus-wearing tests below are about
// owning versus wearing and not about running out of slots.
const PLENTY = 99_999;

/**
 * A fresh module graph with a known save, since save.js reads storage on import.
 * `xp` decides the rank, and the rank decides the slots -- so it is the handle
 * these tests use to set a slot count.
 */
async function withItems(items, xp = PLENTY) {
  vi.resetModules();
  globalThis.localStorage = fakeStorage(JSON.stringify({ items, xp }));
  const save = await import('../src/save.js');
  const loadout = await import('../src/loadout.js');
  const { CONFIG } = await import('../src/config.js');
  return { ...loadout, save: save.save, CONFIG };
}

const OWNED = { boots: 'owned', lens: 'owned', grip: 'owned', hat: 'owned' };

beforeEach(() => {
  vi.resetModules();
});

describe('owning versus wearing', () => {
  it('an old save migrates to wearing everything owned', async () => {
    const { save } = await withItems(OWNED);
    expect(save.worn.sort()).toEqual(['boots', 'grip', 'hat', 'lens']);
  });

  it('worn() is true for something you have on', async () => {
    const { worn } = await withItems(OWNED);
    expect(worn('boots')).toBe(true);
  });

  it('taking something off makes worn() false but leaves it owned', async () => {
    const { worn, setWorn, save } = await withItems(OWNED);
    setWorn('boots', false);
    expect(worn('boots')).toBe(false);
    expect(save.items.boots).toBe('owned');
  });

  it('it can be put back on', async () => {
    const { worn, setWorn } = await withItems(OWNED);
    setWorn('boots', false);
    setWorn('boots', true);
    expect(worn('boots')).toBe(true);
  });

  it('toggle flips it', async () => {
    const { worn, toggleWorn } = await withItems(OWNED);
    toggleWorn('boots');
    expect(worn('boots')).toBe(false);
  });

  it('you cannot wear what you do not own', async () => {
    const { setWorn } = await withItems(OWNED);
    expect(setWorn('bell', true)).toEqual({
      ok: false,
      worn: false,
      reason: 'You do not have that.',
    });
  });
});

describe('slot limits come from your rank', () => {
  // `CONFIG.loadout.slots` was 0 -- meaning no limit -- for the entire life of
  // the game, so this whole system granted nothing and the old test here asserted
  // exactly that. Slots now come from the Seeker rank, which is what gives
  // levelling something concrete to hand you.

  it('a brand new seeker gets one slot', async () => {
    const { slots, slotsFree } = await withItems({}, 0);
    expect(slots()).toBe(1);
    expect(slotsFree()).toBe(1);
  });

  it('slots grow as you climb and stop at five', async () => {
    const { totalXpForLevel } = await import('../src/rules.js');
    const at = async (level) => (await withItems(OWNED, totalXpForLevel(level))).slots();
    expect(await at(1)).toBe(1);
    expect(await at(5)).toBe(2);
    expect(await at(10)).toBe(3);
    expect(await at(20)).toBe(4);
    expect(await at(25)).toBe(5);
    expect(await at(30)).toBe(5);
  });

  it('refuses one too many, and says why', async () => {
    const { totalXpForLevel } = await import('../src/rules.js');
    // Level 10 is rank Seeker: three slots.
    const { setWorn, slotsFree, wornCount } = await withItems(OWNED, totalXpForLevel(10));
    setWorn('boots', false);
    expect(wornCount()).toBe(3);
    expect(slotsFree()).toBe(0);

    const refused = setWorn('boots', true);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('You can only carry 3. Take something off first.');
    expect(wornCount()).toBe(3); // the refusal changed nothing
  });

  it('never strips a returning player of what they already wear', async () => {
    // The important compatibility case. Under the old no-limit rule a player
    // could be wearing everything they owned; the cap must stop them ADDING a
    // fifth, and must never quietly remove the four they chose.
    const { wornCount, worn, slots, setWorn } = await withItems(OWNED, 0);
    expect(slots()).toBe(1);
    expect(wornCount()).toBe(4); // over cap, and left alone
    expect(worn('boots')).toBe(true);
    expect(setWorn('boots', false).ok).toBe(true); // taking off still works over cap
    expect(wornCount()).toBe(3);
  });

  it('gives a save with history a level-5 floor rather than one slot', async () => {
    // A veteran arriving with a full collection and no xp field must not land on
    // rank Wanderer, unable to change gear until they have climbed for hours.
    vi.resetModules();
    globalThis.localStorage = fakeStorage(JSON.stringify({ items: OWNED, wins: 3, cycles: 1 }));
    const { save } = await import('../src/save.js');
    const { levelFromXp } = await import('../src/rules.js');
    expect(levelFromXp(save.xp)).toBeGreaterThanOrEqual(5);
  });

  it('gives a genuinely new save no free levels', async () => {
    vi.resetModules();
    globalThis.localStorage = fakeStorage(JSON.stringify({ items: {} }));
    const { save } = await import('../src/save.js');
    expect(save.xp).toBe(0);
  });
});
