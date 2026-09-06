// save.js — what you own and what you have on, kept in browser storage.
//
// `save` is exported as a const object and mutated in place, so every file
// that imports it sees the same live data. Call persist() after changing it.
//
// EVERYTHING HERE IS LOCAL TO ONE BROWSER.
//
// localStorage is scoped to the origin AND to the device, and this game makes
// no network calls at all -- no fetch, no socket, no server. So sharing the
// link shares the game and never your progress: whoever opens it starts with
// an empty save. Your own phone and laptop keep separate saves for the same
// reason. Shared progress would need accounts and a server; there are none.
//
// OWNING IS NOT WEARING
//
// These used to be a single fact, which is why there was no way to take
// anything off: `items[id] === 'owned'` both meant "you have it" and was what
// every effect checked. They are now two facts:
//
//     save.items[id]   'bought' -> paid for, the crate is still on the ground
//                      'owned'  -> picked up, yours permanently
//     save.worn[]      the ids you actually have on right now
//
// Possession is permanent. A loadout is a choice, and choices can be undone.
//
// This file is storage only -- it remembers, it does not judge. The rules about
// what you are allowed to wear live in loadout.js.
import { totalXpForLevel } from './rules.js';

export const SAVE_KEY = 'orbseeker.save.v2';

export const save = {
  fragments: 0,
  wins: 0,
  bestTaps: 0, // fastest taps-per-second ever managed in a duel
  orbsEver: 0, // orbs collected across every valley, for titles
  bestRun: 0, // best valley score ever, which is the ladder rating
  titles: [], // ids of achievements earned
  title: null, // the one on show, or null
  items: {},
  wishes: [],
  cycles: 0,
  worn: null,
  lowGraphics: false,
  taught: false, // has this player been through the first sixty seconds?
  questsDone: 0, // lifetime daily quests completed, for the Errands badges
  daily: null, // today's three: { day, ids, counts, done } -- see quests.js
};

// A save that cannot be read is a new game, which is survivable. A save that
// cannot be WRITTEN loses everything since the last good write, which is not --
// so both are at least reported rather than swallowed in silence.
// (Telling the PLAYER, not just the console, is a visible change and is waiting
// on sign-off; see docs/AUDIT.md item 6.)
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) Object.assign(save, JSON.parse(raw));
} catch (err) {
  console.warn('save could not be read; starting a new one:', err);
}

// Saves written before loadouts existed have no `worn` list -- and back then,
// owning an item meant wearing it. Those players start out wearing everything
// they own, so nothing they collected appears to have been taken away.
// `worn` is null only on such a save (or a brand new one, where it is empty).
// A save that PARSES but is the wrong SHAPE used to kill the whole app. Object
// .assign happily copies `items: null` over the default, and the next line then
// called Object.keys(null) -- at module-import time, in a layer-0 module, so
// every other module failed and the page went blank with no way back.
//
// JSON.parse succeeding is not the same as the data being usable.
if (typeof save.items !== 'object' || save.items === null || Array.isArray(save.items)) {
  save.items = {};
}
if (!Array.isArray(save.wishes)) save.wishes = [];
save.wishes = save.wishes.filter((w) => w && typeof w.text === 'string');
for (const k of ['fragments', 'wins', 'cycles', 'bestTaps', 'orbsEver', 'bestRun', 'questsDone']) {
  if (!Number.isFinite(save[k])) save[k] = 0;
}
if (typeof save.lowGraphics !== 'boolean') save.lowGraphics = false;
// A save from before onboarding existed belongs to somebody who has played, so
// they are taught by definition -- nobody should be handed a tutorial on their
// fiftieth valley.
// A malformed daily block would break every counter; dropping it costs one day.
if (
  !save.daily ||
  typeof save.daily !== 'object' ||
  typeof save.daily.day !== 'string' ||
  !Array.isArray(save.daily.ids) ||
  !Array.isArray(save.daily.done) ||
  typeof save.daily.counts !== 'object' ||
  save.daily.counts === null
) {
  save.daily = null;
}
if (typeof save.taught !== 'boolean') save.taught = (save.cycles || 0) > 0 || (save.wins || 0) > 0;
// Titles are ids, and an id that is not a string can only have come from a
// corrupt save -- dropping it costs one badge, keeping it crashes the list.
if (!Array.isArray(save.titles)) save.titles = [];
save.titles = save.titles.filter((t) => typeof t === 'string');
if (typeof save.title !== 'string') save.title = null;
// `xp` is deliberately NOT among the defaults above. progress.js has to be able
// to tell an old save (no xp at all) from a new one (xp of 0), because an old
// save has play behind it that must be converted into levels -- otherwise a
// finished item collection suddenly exceeds a level-1 slot cap. So only guard
// against a corrupt value here, and leave a missing one missing.
//
// A save from before levels existed has play behind it that has to become XP.
// `loadout.slots` was 0 -- meaning NO limit -- for the life of the game, so a
// returning player is very likely wearing more than a level-1 rank now allows;
// starting them at zero would make a finished collection feel confiscated.
// Generous on purpose: too generous costs a few free levels, too stingy costs a
// child their things.
//
// This lives here, next to the `worn` migration it mirrors, and NOT in
// progress.js -- loadout.js has to know its slot count without importing the
// renderer, or it stops being testable.
if (!Number.isFinite(save.xp)) {
  const ownedCount = Object.keys(save.items).filter((id) => save.items[id] === 'owned').length;
  const played = (save.wins || 0) * 20 + (save.cycles || 0) * 150 + ownedCount * 60;
  const hasHistory = ownedCount > 0 || (save.wins || 0) > 0 || (save.cycles || 0) > 0;
  // A floor of level 5 for anyone who has played at all. Without it, a veteran
  // with a full item collection could land on rank Wanderer and its single slot,
  // unable to change gear until they had climbed for hours. The floor is a flat,
  // explainable rule rather than a formula tuned to one person's save.
  const floor = hasHistory ? totalXpForLevel(5) : 0;
  save.xp = Math.max(Number.isFinite(played) ? played : 0, floor);
}

if (!Array.isArray(save.worn)) {
  save.worn = Object.keys(save.items).filter((id) => save.items[id] === 'owned');
}

export function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (err) {
    console.warn('progress could not be saved:', err);
  }
}

/** Do you have it at all? Permanent once picked up. Ask this for shop/satchel listings. */
export const owned = (id) => save.items[id] === 'owned';
