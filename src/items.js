// items.js — the trader's stock.
//
// Lifted out of config.js, which is a table of tuning NUMBERS. This is a table
// of things in the game: each has an id, a name, the sentence the shop shows,
// a price and a swatch. Price is the only tunable among them, and it stays here
// with the item it belongs to rather than in a list of unrelated dials.
import * as P from './palette.js';

// Kept beside the other tunables because price is the thing you will fiddle with.
export const ITEMS = [
  { id: 'boots', name: 'Swift boots', desc: 'Walk 40% faster.', cost: 12, color: P.ITEM.boots },
  { id: 'lens', name: 'Long lens', desc: 'Finder sees 50% farther.', cost: 10, color: P.ITEM.lens },
  {
    id: 'grip',
    name: 'Duelist grip',
    desc: 'Each tap counts more in duels.',
    cost: 18,
    color: P.ITEM.grip,
  },
  {
    id: 'lantern',
    name: 'Brass lantern',
    desc: 'Carry your own light for the dark.',
    cost: 8,
    color: P.ITEM.lantern,
  },
  {
    id: 'hat',
    name: 'Straw hat',
    desc: 'A wide hat, worn over the hood.',
    cost: 6,
    color: P.ITEM.hat,
  },
  {
    id: 'cloak',
    name: 'Violet suit',
    desc: 'A new color for your ninja suit.',
    cost: 9,
    color: P.ITEM.cloak,
  },
  {
    id: 'charm',
    name: 'Orbit charm',
    desc: 'A small ring that circles your sash.',
    cost: 14,
    color: P.ITEM.charm,
  },
  {
    id: 'bell',
    name: 'Silver bell',
    desc: 'Wanderers hear you and seek you from farther.',
    cost: 16,
    color: P.ITEM.bell,
  },
];
