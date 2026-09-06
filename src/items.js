// items.js — the trader's stock.
//
// The list itself now lives in `content/items.json`, where adding an item is
// adding a line rather than editing code. This file stays because half the game
// imports `ITEMS` from here, and because content.js is the place that validates
// and resolves — including turning each item's colour NAME into a palette colour,
// so no content file ever carries a raw hex and CLAUDE.md's art rule holds.
export { ITEMS } from './content.js';
