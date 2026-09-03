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

/** A fresh module graph with a known save, since save.js reads storage on import. */
async function withItems(items) {
  vi.resetModules();
  globalThis.localStorage = fakeStorage(JSON.stringify({ items }));
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

describe('slot limits', () => {
  it('slots are unlimited by default', async () => {
    const { slotsFree } = await withItems(OWNED);
    expect(slotsFree()).toBe(Infinity);
  });

  it('reports honestly when the limit is lowered under an existing save', async () => {
    // The case a player hits when the number changes under a save already over it.
    const { CONFIG, wornCount, slotsFree, setWorn } = await withItems(OWNED);
    expect(wornCount()).toBe(4);
    CONFIG.loadout.slots = 3;
    expect(wornCount()).toBe(4);
    expect(slotsFree()).toBe(0);
    expect(setWorn('boots', false).ok).toBe(true); // taking off still works over cap
    CONFIG.loadout.slots = 0; // leave the shared config as we found it
  });

  it('refuses one too many, and says why', async () => {
    const { CONFIG, setWorn, slotsFree, wornCount } = await withItems(OWNED);
    CONFIG.loadout.slots = 3;
    setWorn('boots', false);
    setWorn('hat', false);
    expect(slotsFree()).toBe(1);
    expect(setWorn('hat', true).ok).toBe(true);

    const refused = setWorn('boots', true);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('You can only carry 3. Take something off first.');
    expect(wornCount()).toBe(3); // the refusal changed nothing
    CONFIG.loadout.slots = 0;
  });
});
