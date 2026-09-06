// titles.js — named achievements you earn and wear.
//
// Ashura asked for what Rocket League has, and Rocket League has three separate
// things that are easy to confuse:
//
//   1. a LEVEL, which only measures how much you have played   -> progress.js
//   2. a RANK, which measures how well                         -> the ladder, rules.js
//   3. TITLES, which record specific things you once did       -> here
//
// Titles are the answer to "how do I show my friends?" that the NFT question was
// really reaching for. They are unforgeable in the only way that matters to a
// child -- you either did the thing or you did not -- and they cost nothing to
// carry: a list of short ids in the save.
//
// Every title names a SPECIFIC ACT, never a threshold of grinding. "Beat the camp
// at orb seven" is a story. "Play 200 valleys" is a chore with a badge taped to
// it, and a nine-year-old can tell the difference.
import { save, persist, owned } from './save.js';
import { emit, EVENTS } from './events.js';
// From items.js, not shop.js: shop.js builds the trader's UI, and importing it
// here would drag the DOM into a module that is otherwise pure enough to test.
import { ITEMS } from './items.js';

/**
 * The whole set. `test` is given a context assembled at check time; anything it
 * needs must be in that object, so a title can never quietly depend on module
 * state that happens to be lying around.
 *
 * `hint` is shown for titles not yet earned. Hidden achievements are a small
 * cruelty in a children's game -- if you cannot see what to aim at, the list is
 * just a record of what you missed.
 */
export const TITLES = [
  {
    id: 'first-light',
    name: 'First Light',
    hint: 'Find your first orb.',
    test: (c) => c.orbsEver >= 1,
  },
  {
    id: 'in-order',
    name: 'In Order',
    hint: 'Gather all seven in order, 1 to 7.',
    test: (c) => c.perfectOrder,
  },
  {
    id: 'fleet',
    name: 'Fleet',
    hint: 'Finish a valley in under eight minutes.',
    test: (c) => c.seconds > 0 && c.seconds < 480,
  },
  {
    id: 'unhurried',
    name: 'The Unhurried',
    hint: 'Take more than twenty-five minutes over one valley.',
    // Deliberately the opposite of Fleet. A game that only rewards speed tells a
    // child there is a wrong way to enjoy it.
    test: (c) => c.seconds > 1500,
  },
  {
    id: 'untouched',
    name: 'Untouched',
    hint: 'Finish a valley without losing a duel.',
    test: (c) => c.finished && c.duelsLost === 0,
  },
  {
    id: 'fast-hands',
    name: 'Fast Hands',
    hint: 'Reach seven taps a second in a duel.',
    test: (c) => c.bestTaps >= 7,
  },
  {
    id: 'blur',
    name: 'Blur',
    hint: 'Reach nine taps a second in a duel.',
    test: (c) => c.bestTaps >= 9,
  },
  {
    id: 'camp-breaker',
    name: 'Camp Breaker',
    hint: 'Beat the camp beside orb seven.',
    test: (c) => c.beatTier >= 7,
  },
  {
    id: 'stonecutter',
    name: 'Stonecutter',
    hint: 'Raise ten wish stones.',
    test: (c) => c.wishes >= 10,
  },
  {
    id: 'sevenfold',
    name: 'Sevenfold',
    hint: 'Complete seven valleys.',
    test: (c) => c.valleys >= 7,
  },
  { id: 'old-hand', name: 'Old Hand', hint: 'Reach level ten.', test: (c) => c.level >= 10 },
  {
    id: 'keepers-guest',
    name: "Keeper's Guest",
    hint: 'Reach level twenty-five.',
    test: (c) => c.level >= 25,
  },
  {
    id: 'collector',
    name: 'The Collector',
    hint: 'Own every item in the trader’s cart.',
    test: (c) => c.itemsOwned >= c.itemsTotal,
  },
  {
    id: 'rainbow',
    name: 'Walked the Rainbow',
    hint: 'Climb the ladder to Violet.',
    test: (c) => c.tier === 'Violet' || c.tier === "Keeper's Own",
  },
  {
    id: 'keepers-own',
    name: "Keeper's Own",
    hint: 'Reach the top of the ladder.',
    test: (c) => c.tier === "Keeper's Own",
  },
];

const byId = new Map(TITLES.map((t) => [t.id, t]));

export const hasTitle = (id) => Array.isArray(save.titles) && save.titles.includes(id);
export const earnedTitles = () => (save.titles || []).map((id) => byId.get(id)).filter(Boolean);

/** The title currently on show, or null. */
export function wornTitle() {
  const t = byId.get(save.title);
  return t && hasTitle(t.id) ? t : null;
}

export function wearTitle(id) {
  if (id !== null && !hasTitle(id)) return false;
  save.title = id;
  persist();
  return true;
}

/**
 * Check every title against the current context and award any that have come
 * true. Returns the newly earned ones so the caller can announce them.
 *
 * Cheap enough to call on any event: fifteen predicates over a plain object.
 */
export function checkTitles(ctx) {
  if (!Array.isArray(save.titles)) save.titles = [];
  const fresh = [];
  for (const t of TITLES) {
    if (hasTitle(t.id)) continue;
    let passed;
    try {
      passed = !!t.test(ctx);
    } catch {
      passed = false; // a broken predicate must never break the game
    }
    if (passed) {
      save.titles.push(t.id);
      fresh.push(t);
    }
  }
  if (fresh.length) {
    // If you are wearing nothing, put on the best of what just arrived -- the
    // LAST of the fresh ones, since the table runs roughly easiest to hardest.
    // Taking the first would hand someone "First Light" in the same breath as
    // "Walked the Rainbow", which is the opposite of showing off.
    //
    // Only when nothing is worn. Silently swapping a title someone chose would
    // be rude, and the choice is the whole point of having them.
    if (!save.title) save.title = fresh[fresh.length - 1].id;
    persist();
    emit(EVENTS.TITLES_EARNED, fresh);
  }
  return fresh;
}

/** The parts of the context that come from the save rather than from a run. */
export function baseContext() {
  return {
    orbsEver: save.orbsEver || 0,
    valleys: save.cycles || 0,
    wishes: (save.wishes || []).length,
    bestTaps: save.bestTaps || 0,
    itemsOwned: ITEMS.filter((i) => owned(i.id)).length,
    itemsTotal: ITEMS.length,
    // Run-shaped fields default to "no run just happened", so a check fired by a
    // level-up cannot accidentally award a run title.
    perfectOrder: false,
    finished: false,
    seconds: 0,
    duelsLost: 0,
    beatTier: 0,
    level: 1,
    tier: '',
  };
}
