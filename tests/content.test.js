// Content files are data, and data goes wrong quietly. These tests are about the
// checking, not the contents: a typo in content/*.json must stop the game at
// startup with the id and the reason, rather than producing a title nobody can
// ever earn or a shop item with no colour.
import { describe, it, expect } from 'vitest';
import { ITEMS, loadTitles, loadVillagers } from '../src/content.js';
import * as P from '../src/palette.js';

const FIELDS = [
  'orbsEver',
  'valleys',
  'wishes',
  'bestTaps',
  'ownsEverything',
  'perfectOrder',
  'finished',
  'seconds',
  'duelsLost',
  'beatTier',
  'level',
  'tier',
];

describe('items, from content/items.json', () => {
  it('loads the whole shop', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(8);
    for (const i of ITEMS) {
      expect(typeof i.id).toBe('string');
      expect(typeof i.name).toBe('string');
      expect(i.cost).toBeGreaterThan(0);
    }
  });

  it('resolves every colour to one from the palette, never a raw hex', () => {
    // CLAUDE.md: all colours come from palette.js. If a content file could carry
    // its own hex, that rule would end the first time somebody was in a hurry.
    const allowed = new Set(Object.values(P.ITEM));
    for (const i of ITEMS) {
      expect(typeof i.color).toBe('number');
      expect(allowed.has(i.color)).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });
});

describe('titles, from content/titles.json', () => {
  const titles = loadTitles(FIELDS);

  it('compiles every title to a working predicate', () => {
    expect(titles.length).toBeGreaterThanOrEqual(15);
    for (const t of titles) {
      expect(typeof t.test).toBe('function');
      expect(t.hint.length).toBeGreaterThan(0); // no hidden achievements
    }
  });

  it('awards and withholds on the same context correctly', () => {
    const find = (id) => titles.find((t) => t.id === id);
    const base = {
      orbsEver: 0,
      valleys: 0,
      wishes: 0,
      bestTaps: 0,
      ownsEverything: false,
      perfectOrder: false,
      finished: false,
      seconds: 0,
      duelsLost: 0,
      beatTier: 0,
      level: 1,
      tier: '',
    };
    expect(find('first-light').test(base)).toBe(false);
    expect(find('first-light').test({ ...base, orbsEver: 1 })).toBe(true);

    // Fleet needs BOTH a finished valley and a fast one: an unfinished run with a
    // low clock must not award it, which is exactly what a single condition
    // would have got wrong.
    expect(find('fleet').test({ ...base, seconds: 100 })).toBe(false);
    expect(find('fleet').test({ ...base, finished: true, seconds: 100 })).toBe(true);
    expect(find('fleet').test({ ...base, finished: true, seconds: 900 })).toBe(false);

    // `in` against a list of tiers.
    expect(find('rainbow').test({ ...base, tier: 'Indigo' })).toBe(false);
    expect(find('rainbow').test({ ...base, tier: 'Violet' })).toBe(true);
    expect(find('rainbow').test({ ...base, tier: "Keeper's Own" })).toBe(true);
  });

  it('refuses a condition naming a field that does not exist', () => {
    // The failure this whole file exists to prevent. Given a field list that
    // does not include what the real titles test, loading must throw -- so a
    // misspelt field in the JSON can never become a title nobody can earn.
    expect(() => loadTitles(['orbsEver'])).toThrow(/unknown field/);
  });

  it('names the offending title in the error', () => {
    let message = '';
    try {
      loadTitles(['orbsEver']);
    } catch (e) {
      message = e.message;
    }
    expect(message).toMatch(/titles\.json/);
    expect(message).toMatch(/"[a-z-]+"/); // the id of the row that is wrong
  });
});

describe('villagers, from content/villagers.json', () => {
  const HEADWEAR = ['cap', 'brim', 'hood', 'kerchief', 'none'];
  const PROPS = ['axe', 'hammer', 'blade', 'staff', 'satchel', 'basket'];
  const seven = loadVillagers(HEADWEAR, PROPS);

  it('loads exactly seven, one per orb, in tier order', () => {
    expect(seven).toHaveLength(7);
    seven.forEach((w, i) => expect(w.tier).toBe(i + 1));
  });

  it('gives every one of them a face and a voice', () => {
    for (const w of seven) {
      expect(typeof w.color).toBe('number');
      expect(typeof w.hat).toBe('number');
      expect(typeof w.skin).toBe('number');
      expect(w.build).toBeGreaterThan(0);
      for (const line of ['challenge', 'theyWin', 'theyLose']) {
        expect(w.voice[line].length).toBeGreaterThan(0);
      }
    }
  });

  it('never states a duel duration in dialogue', () => {
    // The rules line said "Ten seconds" for months after the duel became four,
    // and the fallback voice line said it too. A DURATION written into prose is a
    // number that goes stale silently, so no villager may state one. Orb numbers
    // ("Four. Halfway, near enough.") are fine, and so is "the second is mine" --
    // Nell means the second ORB. Only a NUMBER followed by "seconds" is a clock.
    for (const w of seven) {
      for (const line of Object.values(w.voice)) {
        expect(line).not.toMatch(
          /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+seconds?\b/i,
        );
      }
    }
  });

  it('refuses headwear or a prop that nothing can build', () => {
    // A villager asking for a hat nobody makes would otherwise walk around
    // bare-headed with nothing said about it.
    expect(() => loadVillagers(['none'], PROPS)).toThrow(/nothing knows how to build/);
    expect(() => loadVillagers(HEADWEAR, ['axe'])).toThrow(/nothing knows how to build/);
  });

  it('names the offending villager in the error', () => {
    let message = '';
    try {
      loadVillagers(['none'], PROPS);
    } catch (e) {
      message = e.message;
    }
    expect(message).toMatch(/villagers\.json/);
  });
});
