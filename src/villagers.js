// villagers.js — who the seven are.
//
// The seven themselves now live in `content/villagers.json`, one row each: name,
// build, headwear, what they carry and everything they say. This file declares
// what wandererBody.js is actually able to BUILD, and hands that to the loader so
// a villager who asks for a hat nobody can make is an error at startup rather
// than someone walking around bare-headed with nothing said about it.
//
// Their order in the file is their tier: the first camps beside orb 1.
import { loadVillagers } from './content.js';

/** Headwear wandererBody.js knows how to make. */
export const HEADWEAR = ['cap', 'brim', 'hood', 'kerchief', 'none'];

/** Things it knows how to put in their hands. */
export const PROPS = ['axe', 'hammer', 'blade', 'staff', 'satchel', 'basket'];

export const WANDERERS = loadVillagers(HEADWEAR, PROPS);
