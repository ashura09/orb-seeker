// content.js — loads the game's content out of `content/*.json` and checks it.
//
// Items, titles and (next) villagers and dialogue used to live inside JavaScript
// files, which meant adding a hat to the shop was editing code. Content is not
// code: it is a list of things, and a list of things belongs in a file a person
// can open and add a line to.
//
// WHY THE VALIDATION IS THE POINT
//
// Moving data into JSON without checking it just moves the mistakes somewhere
// quieter. A title whose condition names a field that does not exist would never
// fire, and nothing would say so -- it would look exactly like a title nobody had
// earned yet. So everything is checked here, at startup, and a bad file throws
// with the id and the reason rather than failing silently for months.
//
// (That is not hypothetical. The duel had four unbeatable opponents and a dead
// branch for the life of the game, and the tests happily asserted it.)
//
// WHY COLOURS ARE NAMES AND NOT HEX
//
// CLAUDE.md's art rule is that every colour comes from palette.js. A content file
// carrying `"color": "#ff0000"` would end that quietly, so items name a key in the
// palette's ITEM table and this file resolves it -- an unknown name is an error.
import * as P from './palette.js';
import itemsFile from '../content/items.json';
import titlesFile from '../content/titles.json';
import villagersFile from '../content/villagers.json';
import questsFile from '../content/quests.json';

/** Throw with a message that says which row is wrong and why. */
function bad(file, id, why) {
  throw new Error(`content/${file}: "${id}" ${why}`);
}

// ---------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------
export const ITEMS = itemsFile.items.map((raw) => {
  const id = raw.id || '(missing id)';
  for (const key of ['id', 'name', 'desc', 'color']) {
    if (typeof raw[key] !== 'string') bad('items.json', id, `needs a string "${key}"`);
  }
  if (!Number.isFinite(raw.cost) || raw.cost < 0)
    bad('items.json', id, 'needs a cost of 0 or more');
  if (!(raw.color in P.ITEM)) {
    bad('items.json', id, `names colour "${raw.color}", which is not in palette.js's ITEM table`);
  }
  return { id: raw.id, name: raw.name, desc: raw.desc, cost: raw.cost, color: P.ITEM[raw.color] };
});

{
  const seen = new Set();
  for (const i of ITEMS) {
    if (seen.has(i.id)) bad('items.json', i.id, 'appears twice');
    seen.add(i.id);
  }
}

// ---------------------------------------------------------------------------
// TITLES
//
// `when` is a list of [field, operator, value]. All of them must hold. It is a
// deliberately tiny language: enough to express every achievement we have, small
// enough that a wrong operator or a misspelt field is caught the moment the page
// loads rather than never.
// ---------------------------------------------------------------------------
const OPS = {
  '>=': (a, b) => a >= b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '<': (a, b) => a < b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  in: (a, b) => Array.isArray(b) && b.includes(a),
};

/**
 * @param fields  every name a condition is allowed to test. Passed in by the
 *                caller, because the caller is what builds the context -- this
 *                file has no business knowing what an orb is.
 */
export function loadTitles(fields) {
  const known = new Set(fields);
  return titlesFile.titles.map((raw) => {
    const id = raw.id || '(missing id)';
    for (const key of ['id', 'name', 'hint']) {
      if (typeof raw[key] !== 'string') bad('titles.json', id, `needs a string "${key}"`);
    }
    if (!Array.isArray(raw.when) || raw.when.length === 0) {
      bad('titles.json', id, 'needs a non-empty "when" list');
    }
    const tests = raw.when.map((cond) => {
      if (!Array.isArray(cond) || cond.length !== 3) {
        bad('titles.json', id, 'has a condition that is not [field, operator, value]');
      }
      const [field, op, value] = cond;
      if (!known.has(field)) {
        bad('titles.json', id, `tests unknown field "${field}" (known: ${fields.join(', ')})`);
      }
      if (!(op in OPS)) {
        bad(
          'titles.json',
          id,
          `uses unknown operator "${op}" (known: ${Object.keys(OPS).join(' ')})`,
        );
      }
      const fn = OPS[op];
      return (ctx) => fn(ctx[field], value);
    });
    return {
      id: raw.id,
      name: raw.name,
      hint: raw.hint,
      test: (ctx) => tests.every((t) => t(ctx)),
    };
  });
}

// ---------------------------------------------------------------------------
// VILLAGERS
//
// Who they are, what they look like and what they say, in one row each. They
// used to be split across villagers.js and voice.js, with a comment warning that
// the `short` name had to be kept in step across THREE files -- a coupling a
// person was expected to maintain by remembering it. Now one `id` drives the
// palette lookup and the voice sits beside the face it belongs to, so the
// warning is not needed rather than merely repeated.
// ---------------------------------------------------------------------------

/**
 * @param headwear  the styles wandererBody.js can actually build
 * @param props     the carried things it can actually build
 *
 * Both are passed in for the same reason the title fields are: this file has no
 * idea how a hat is made, and a villager asking for headwear nobody can build
 * would otherwise walk around bare-headed with nothing said about it.
 */
export function loadVillagers(headwear, props) {
  const hats = new Set(headwear);
  const carried = new Set(props);
  const list = villagersFile.villagers;

  if (list.length !== 7) {
    throw new Error(
      `content/villagers.json: there must be exactly 7 villagers, one per orb — found ${list.length}`,
    );
  }

  const seen = new Set();
  return list.map((raw, i) => {
    const id = raw.id || '(missing id)';
    for (const key of ['id', 'name', 'short']) {
      if (typeof raw[key] !== 'string' || !raw[key]) {
        bad('villagers.json', id, `needs a non-empty "${key}"`);
      }
    }
    if (seen.has(raw.id)) bad('villagers.json', id, 'appears twice');
    seen.add(raw.id);

    // The id is what fetches their coat, hat and skin, so a typo here would
    // otherwise produce a villager with no colours at all.
    if (!(raw.id in P.VILLAGER)) {
      bad('villagers.json', id, "is not in palette.js's VILLAGER table");
    }
    if (!Number.isFinite(raw.build) || raw.build <= 0) {
      bad('villagers.json', id, 'needs a build greater than 0');
    }
    if (!hats.has(raw.headwear)) {
      bad('villagers.json', id, `wears "${raw.headwear}", which nothing knows how to build`);
    }
    if (!carried.has(raw.prop)) {
      bad('villagers.json', id, `carries "${raw.prop}", which nothing knows how to build`);
    }
    for (const line of ['challenge', 'theyWin', 'theyLose']) {
      if (typeof raw.voice?.[line] !== 'string' || !raw.voice[line]) {
        bad('villagers.json', id, `needs something to say for "${line}"`);
      }
    }

    const paint = P.VILLAGER[raw.id];
    return {
      id: raw.id,
      name: raw.name,
      short: raw.short,
      tier: i + 1, // their position in the file IS their tier: first camps by orb 1
      build: raw.build,
      headwear: raw.headwear,
      prop: raw.prop,
      beard: !!raw.beard,
      color: paint.coat,
      hat: paint.hat,
      skin: paint.skin,
      voice: { ...raw.voice },
    };
  });
}

// ---------------------------------------------------------------------------
// DAILY QUESTS
//
// A quest is a counter and a number to reach. The counters themselves live in
// quests.js, which is what keeps them -- so the legal metric names are passed in,
// exactly as the title fields are. A quest naming a counter nobody keeps would
// otherwise sit at zero forever and look merely difficult.
// ---------------------------------------------------------------------------
export const QUEST_TIERS = ['easy', 'medium', 'hard'];

export function loadQuests(metrics) {
  const known = new Set(metrics);
  const seen = new Set();
  const list = questsFile.quests.map((raw) => {
    const id = raw.id || '(missing id)';
    for (const key of ['id', 'tier', 'text', 'metric']) {
      if (typeof raw[key] !== 'string' || !raw[key]) {
        bad('quests.json', id, `needs a non-empty "${key}"`);
      }
    }
    if (seen.has(raw.id)) bad('quests.json', id, 'appears twice');
    seen.add(raw.id);
    if (!QUEST_TIERS.includes(raw.tier)) {
      bad('quests.json', id, `is tier "${raw.tier}" (must be ${QUEST_TIERS.join(', ')})`);
    }
    if (!known.has(raw.metric)) {
      bad('quests.json', id, `counts "${raw.metric}", which nothing keeps a count of`);
    }
    if (!Number.isFinite(raw.goal) || raw.goal <= 0) {
      bad('quests.json', id, 'needs a goal greater than 0');
    }
    return { id: raw.id, tier: raw.tier, text: raw.text, metric: raw.metric, goal: raw.goal };
  });

  // Every tier must have something to offer, or a day would arrive with only two
  // quests on it and nothing saying why.
  for (const tier of QUEST_TIERS) {
    if (!list.some((q) => q.tier === tier)) {
      throw new Error(`content/quests.json: no "${tier}" quests, so a day could not be filled`);
    }
  }
  return list;
}
