// Save and load, round-tripped through a fake localStorage.
//
// save.js reads storage at import time, so each test resets the module registry
// and imports it fresh — otherwise every test would see the first one's data.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const KEY = 'orbseeker.save.v2';

/** Minimal localStorage, plus a switch to make writing fail like a full quota. */
function fakeStorage(initial = null) {
  const store = new Map();
  if (initial !== null) store.set(KEY, initial);
  return {
    failWrites: false,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem(k, v) {
      if (this.failWrites) {
        const err = new Error('quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(k, v);
    },
    removeItem: (k) => store.delete(k),
    _raw: () => store.get(KEY),
  };
}

async function loadSave(storage) {
  vi.resetModules();
  globalThis.localStorage = storage;
  return import('../src/save.js');
}

beforeEach(() => {
  vi.resetModules();
});

describe('save round-trip', () => {
  it('starts empty when there is nothing stored', async () => {
    const { save } = await loadSave(fakeStorage());
    expect(save.fragments).toBe(0);
    expect(save.wins).toBe(0);
    expect(save.cycles).toBe(0);
    expect(save.wishes).toEqual([]);
    expect(save.items).toEqual({});
  });

  it('writes and reads back every field unchanged', async () => {
    const storage = fakeStorage();
    const first = await loadSave(storage);
    first.save.fragments = 42;
    first.save.wins = 9;
    first.save.cycles = 3;
    first.save.items = { boots: 'owned', lens: 'bought' };
    first.save.wishes = [{ text: 'a bicycle', cycle: 1 }];
    first.save.worn = ['boots'];
    first.persist();

    const second = await loadSave(storage);
    expect(second.save.fragments).toBe(42);
    expect(second.save.wins).toBe(9);
    expect(second.save.cycles).toBe(3);
    expect(second.save.items).toEqual({ boots: 'owned', lens: 'bought' });
    expect(second.save.wishes).toEqual([{ text: 'a bicycle', cycle: 1 }]);
    expect(second.save.worn).toEqual(['boots']);
  });

  it('keeps a wish exactly as it was typed, including punctuation', async () => {
    const storage = fakeStorage();
    const odd = 'I wish for "quotes", \\backslashes\\ and an emoji 🐉';
    const first = await loadSave(storage);
    first.save.wishes.push({ text: odd, cycle: 0 });
    first.persist();

    const second = await loadSave(storage);
    expect(second.save.wishes[0].text).toBe(odd);
  });

  it('owned() is true only for items actually picked up', async () => {
    const storage = fakeStorage(
      JSON.stringify({ items: { boots: 'owned', lens: 'bought' }, worn: [] }),
    );
    const { owned } = await loadSave(storage);
    expect(owned('boots')).toBe(true);
    expect(owned('lens')).toBe(false); // paid for, crate not yet collected
    expect(owned('nothing')).toBe(false);
  });
});

describe('save migration', () => {
  it('a pre-loadout save starts out wearing everything it owns', async () => {
    // Saves written before loadouts existed have no `worn` list, and back then
    // owning an item meant wearing it. Nothing may appear to have been taken away.
    const storage = fakeStorage(
      JSON.stringify({ fragments: 5, items: { boots: 'owned', hat: 'owned', lens: 'bought' } }),
    );
    const { save } = await loadSave(storage);
    expect(save.worn.sort()).toEqual(['boots', 'hat']);
    expect(save.worn).not.toContain('lens'); // bought but never collected
  });

  it('a brand new save wears nothing', async () => {
    const { save } = await loadSave(fakeStorage());
    expect(save.worn).toEqual([]);
  });
});

describe('save failure', () => {
  it('survives a corrupt save rather than throwing', async () => {
    const { save } = await loadSave(fakeStorage('{not json at all'));
    expect(save.fragments).toBe(0);
    expect(save.worn).toEqual([]);
  });

  it('does not throw when storage refuses the write', async () => {
    const storage = fakeStorage();
    storage.failWrites = true;
    const { persist, save } = await loadSave(storage);
    save.fragments = 7;
    expect(() => persist()).not.toThrow();
  });
});
