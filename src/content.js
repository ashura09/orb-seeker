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
