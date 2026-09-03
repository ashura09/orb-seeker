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
export const SAVE_KEY = 'orbseeker.save.v2';

export const save = {fragments:0, wins:0, items:{}, wishes:[], cycles:0, worn:null};

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
if (!Array.isArray(save.worn)){
  save.worn = Object.keys(save.items).filter(id => save.items[id] === 'owned');
}

export function persist(){
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (err) {
    console.warn('progress could not be saved:', err);
  }
}

/** Do you have it at all? Permanent once picked up. Ask this for shop/satchel listings. */
export const owned = id => save.items[id] === 'owned';
