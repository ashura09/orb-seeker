// save.js — load and save to browser storage.
//
// `save` is exported as a const object and mutated in place, so every file
// that imports it sees the same live data. Call persist() after changing it.
export const SAVE_KEY = 'orbseeker.save.v2';

// items[id] = 'bought' | 'owned'
export const save = {fragments:0, wins:0, items:{}, wishes:[], cycles:0};

try { const raw = localStorage.getItem(SAVE_KEY); if (raw) Object.assign(save, JSON.parse(raw)); } catch(e){}

export function persist(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch(e){} }

export const owned = id => save.items[id] === 'owned';
