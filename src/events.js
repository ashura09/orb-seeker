// events.js — a tiny publish/subscribe bus, and the only thing in the project
// that nothing else depends on.
//
// WHY THIS EXISTS
//
// Before this file, when all seven orbs were collected, orbs.js called the
// dragon itself:
//
//     import { beginEnding } from './keeper.js';   // in orbs.js
//     if (G.found === 7) beginEnding();
//
// That one line forced orbs.js to know the Keeper exists. And keeper.js needs
// the orbs to build its ring, so it imported orbs.js right back. Two files that
// can no longer be read, moved or tested on their own — a cycle.
//
// With a bus, orbs.js says what HAPPENED and stops caring who listens:
//
//     emit(EVENTS.ORBS_ALL_FOUND);                 // in orbs.js
//     on(EVENTS.ORBS_ALL_FOUND, beginEnding);      // in keeper.js
//
// Neither file imports the other. Delete keeper.js and orbs.js still runs.
//
// The same shape removed all four cycles the audit found. See ARCHITECTURE.md.

// Event names live here rather than as loose strings, so a typo is a crash you
// can see instead of a listener that silently never fires.
export const EVENTS = {
  ORBS_ALL_FOUND:        'orbs:all-found',        // the seventh orb was collected
  DUEL_CHALLENGE:        'duel:challenge',        // a villager caught you  (payload: the villager)
  ITEM_BOUGHT:           'shop:item-bought',      // paid for at the cart   (payload: item id)
  WISHES_ALL_COLLECTED:  'wishes:all-collected',  // last wish token picked up
  CRAWL_TOGGLE:          'player:crawl-toggle',   // the player asked to crawl or stand
  WHISTLE:               'player:whistle',        // the player made a noise on purpose
  LOADOUT_CHANGED:       'loadout:changed',       // something put on or taken off (payload: item id)
  JUMP:                  'player:jump',           // the player asked to jump
};

const listeners = new Map();

/**
 * Listen for an event. Returns a function that removes the listener again.
 */
export function on(name, fn){
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => off(name, fn);
}

export function off(name, fn){
  listeners.get(name)?.delete(fn);
}

/**
 * Announce that something happened. Safe to call with nobody listening.
 *
 * Listeners are copied before being called so that a listener which subscribes
 * or unsubscribes during the event cannot corrupt the loop it is inside.
 * One listener throwing must not stop the others, so each is guarded.
 */
export function emit(name, payload){
  const set = listeners.get(name);
  if (!set || set.size === 0) return;
  for (const fn of [...set]){
    try {
      fn(payload);
    } catch (err) {
      console.error(`listener for "${name}" threw:`, err);
    }
  }
}
