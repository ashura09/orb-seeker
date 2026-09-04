// villagers.js — who the seven are.
//
// Their names, colours, builds, headwear and the thing each one carries. Kept
// apart from the code that builds their bodies for the same reason voice.js is
// kept apart from the code that speaks: you should be able to change who someone
// is without reading a line of three.js.
//
// The `short` name is the key into VILLAGER_VOICE in voice.js, and into
// P.VILLAGER in palette.js. Keep all three spellings in step.
import * as P from './palette.js';

// Each villager has a build, a skin tone, headwear and a prop that says what
// they do for a living — so you can tell who is walking toward you from across
// the valley, instead of only finding out from the duel panel.
export const WANDERERS = [
  {
    name: 'Bram the Woodcutter',
    short: 'Bram',
    color: P.VILLAGER.bram.coat,
    hat: P.VILLAGER.bram.hat,
    skin: P.VILLAGER.bram.skin,
    build: 1.1,
    headwear: 'cap',
    prop: 'axe',
  },
  {
    name: 'Nell the Herbalist',
    short: 'Nell',
    color: P.VILLAGER.nell.coat,
    hat: P.VILLAGER.nell.hat,
    skin: P.VILLAGER.nell.skin,
    build: 0.92,
    headwear: 'kerchief',
    prop: 'basket',
  },
  {
    name: 'Pip the Courier',
    short: 'Pip',
    color: P.VILLAGER.pip.coat,
    hat: P.VILLAGER.pip.hat,
    skin: P.VILLAGER.pip.skin,
    build: 0.85,
    headwear: 'cap',
    prop: 'satchel',
  },
  {
    name: 'Marla Stonehand',
    short: 'Marla',
    color: P.VILLAGER.marla.coat,
    hat: P.VILLAGER.marla.hat,
    skin: P.VILLAGER.marla.skin,
    build: 1.18,
    headwear: 'none',
    prop: 'hammer',
  },
  {
    name: 'Old Tarrow',
    short: 'Tarrow',
    color: P.VILLAGER.tarrow.coat,
    hat: P.VILLAGER.tarrow.hat,
    skin: P.VILLAGER.tarrow.skin,
    build: 0.95,
    headwear: 'brim',
    prop: 'staff',
    beard: true,
  },
  {
    name: 'Sable the Fencer',
    short: 'Sable',
    color: P.VILLAGER.sable.coat,
    hat: P.VILLAGER.sable.hat,
    skin: P.VILLAGER.sable.skin,
    build: 1.0,
    headwear: 'none',
    prop: 'blade',
  },
  {
    name: 'The Grey Pilgrim',
    short: 'the Pilgrim',
    color: P.VILLAGER.pilgrim.coat,
    hat: P.VILLAGER.pilgrim.hat,
    skin: P.VILLAGER.pilgrim.skin,
    build: 1.05,
    headwear: 'hood',
    prop: 'staff',
  },
];
