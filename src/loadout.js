// loadout.js — the rules about what you are wearing.
//
// WHY THIS IS ITS OWN FILE
//
// save.js remembers things. It does not get an opinion about them. "You cannot
// wear a ninth item because you only have four slots" is not storage, it is a
// game rule -- and rules and storage change for different reasons, so they are
// separated. save.js keeps the list; this file guards it.
//
// Everything else in the game asks exactly one question of this file:
//
//     worn('boots')      // is it ON me right now?
//
// and never `owned('boots')` again. Owning a thing you have taken off must not
// still make you fast. `owned()` survives for listings -- the shop showing you
// already bought something, the satchel showing what you have to choose from.
//
// Changes are announced on the bus rather than pushed. This file has no idea
// the monkey exists; player.js listens and updates itself. That is what keeps
// the loadout usable from anywhere -- a menu, a hotkey, a future NPC that
// steals your hat -- without any of them importing each other.
import { CONFIG } from './config.js';
import { save, persist, owned } from './save.js';
import { emit, EVENTS } from './events.js';

/** How many things you may wear at once. 0 means no limit. */
export const slots = () => CONFIG.loadout.slots;

/**
 * Is this item actually on you? Note the `owned` check: the worn list could
 * name something you no longer have, and wearing what you do not own should be
 * impossible rather than merely unlikely.
 */
export const worn = (id) => owned(id) && save.worn.includes(id);

/** What you have on, ignoring any stale ids. */
export const wornItems = () => save.worn.filter(owned);
export const wornCount = () => wornItems().length;

/** Slots still free, or Infinity when unlimited. */
export function slotsFree() {
  const n = slots();
  return n > 0 ? Math.max(0, n - wornCount()) : Infinity;
}

/**
 * Put something on or take it off.
 *
 * Returns {ok, worn, reason} rather than a bare boolean, so the caller can say
 * WHY it refused. A UI that can only see "no" has to invent an explanation,
 * and invented explanations drift out of step with the rule.
 */
export function setWorn(id, on) {
  if (!owned(id)) return { ok: false, worn: false, reason: 'You do not have that.' };
  const already = worn(id);

  if (on && !already) {
    if (slotsFree() <= 0) {
      return {
        ok: false,
        worn: false,
        reason: `You can only carry ${slots()}. Take something off first.`,
      };
    }
    save.worn.push(id);
  } else if (!on && already) {
    save.worn = save.worn.filter((x) => x !== id);
  } else {
    return { ok: true, worn: already, reason: '' }; // already in the asked-for state
  }

  persist();
  emit(EVENTS.LOADOUT_CHANGED, id);
  return { ok: true, worn: on, reason: '' };
}

export const toggleWorn = (id) => setWorn(id, !worn(id));

/**
 * Called when an item is picked up. Wearing it straight away is the friendly
 * behaviour -- you bought it, you want to see it -- but only if there is room,
 * because silently displacing something you chose would be worse than not
 * equipping at all. The return value tells the caller whether it went on, so
 * the pickup message can say so.
 */
export function wearIfRoom(id) {
  return setWorn(id, true).worn;
}
