// regions.js — what kinds of place the valley contains, and where they sit.
//
// A region is not a tint: it decides how high its ground is, what grows there,
// and what one built thing stands at its centre. Almost everything else about
// the terrain is derived from this table.
//
// `centres` is where the regions landed for the current gathering. It is read by
// terrain, ground, scatter and water, which is why it lives here rather than in
// any one of them.
import { CONFIG } from './config.js';
import * as P from './palette.js';

export const WORLD_R = CONFIG.world.radius;

const REGIONS = [
  {
    name: 'meadow',
    lift: 1,
    radius: 74,
    edge: 0.35,
    ground: P.GROUND_MEADOW,
    props: { broadleaf: 1.0, shrub: 0.8, flower: 2.0, grassTuft: 2.5, rock: 0.3 },
    landmark: 'field',
  },

  {
    name: 'forest',
    lift: 4,
    radius: 70,
    edge: 0.5,
    ground: P.GROUND_FOREST,
    props: { conifer: 4.0, fern: 3.0, mushroom: 1.2, stump: 0.6, fallenLog: 0.5, shrub: 0.8 },
    landmark: 'camp',
  },

  {
    name: 'highland',
    lift: 17,
    radius: 62,
    edge: 0.86, // steep sides: a plateau
    ground: P.GROUND_HIGHLAND,
    props: { boulder: 2.4, rock: 2.0, shrub: 0.4, grassTuft: 0.5 },
    landmark: 'ruin',
  },

  {
    name: 'wetland',
    lift: -7,
    radius: 68,
    edge: 0.55, // a basin that holds water
    ground: P.GROUND_WETLAND,
    props: { reeds: 4.0, bamboo: 1.2, lily: 0.6, fern: 0.8, broadleaf: 0.25 },
    landmark: 'landing',
  },

  {
    name: 'burn',
    lift: 0,
    radius: 66,
    edge: 0.4,
    ground: P.GROUND_BURN,
    props: { deadTree: 2.2, stump: 1.8, fallenLog: 0.7, rock: 0.5 },
    landmark: 'marker',
  },
];

// What each landmark is made of: [kind, x, z, rotation, scale] around the
// region's centre. These are the things you see from across the valley and walk
// toward, and they are why the kit's tents, fences and bridges are here at all.
const LANDMARKS = {
  field: [
    ['fence', -6, -4, 0, 1],
    ['fence', -3, -4, 0, 1],
    ['fence', 0, -4, 0, 1],
    ['fence', 3, -4, 0, 1],
    ['gate', 6, -4, 0, 1],
    ['fence', -6, 5, 0, 1],
    ['fence', -3, 5, 0, 1],
    ['fence', 0, 5, 0, 1],
    ['shrub', -2, 0, 0.4, 1.4],
    ['shrub', 3, 1.5, 1.1, 1.2],
  ],
  camp: [
    ['tent', -2.5, 0, 0.5, 1.3],
    ['tent', 2.5, 1, -0.9, 1.1],
    ['campfire', 0, 2.5, 0, 1.1],
    ['fallenLog', -2, 4, 0.3, 1.2],
    ['fallenLog', 2.5, 4, -0.4, 1.2],
  ],
  ruin: [
    ['column', -6, 0, 0, 1],
    ['column', 6, 0, 0, 1],
    ['column', 0, -6, 0, 1],
    ['column', 0, 6, 0, 1],
    ['column', -4.3, -4.3, 0, 0.9],
    ['column', 4.3, 4.3, 0, 0.9],
    ['statueRing', 0, 0, 0, 1.4],
    ['statueHead', -2, 3, 0.7, 1],
  ],
  landing: [
    ['bridge', 0, 0, 0, 1.6],
    ['bridgeSide', -2.2, 0, 0, 1.6],
    ['bridgeSide', 2.2, 0, 0, 1.6],
    ['canoe', 4, 3, 0.8, 1.2],
    ['reeds', -3, 2, 0, 1.4],
    ['reeds', 3, -2, 0, 1.4],
  ],
  marker: [
    ['statueBlock', 0, 0, 0, 1.2],
    ['deadTree', -4, 2, 0, 1.1],
    ['deadTree', 4, -2, 0, 0.9],
    ['stump', -2, -3, 0, 1.3],
    ['stump', 3, 3, 0, 1.2],
  ],
};

let centres = [];

/** Which region a point belongs to, plus a blend toward its neighbour. */
const DEFAULT_REGION = { name: 'meadow', lift: 0, ground: P.GROUND_MEADOW, props: {} };

export function regionAt(x, z) {
  // The world is built only once the models have loaded, so this can be asked
  // before there are any regions. Answer sensibly rather than throwing.
  if (!centres.length) return { region: DEFAULT_REGION, neighbour: DEFAULT_REGION, blend: 0 };
  let best = 0,
    bestD = Infinity,
    second = 0,
    secondD = Infinity;
  for (let i = 0; i < centres.length; i++) {
    const d = Math.hypot(x - centres[i].x, z - centres[i].z);
    if (d < bestD) {
      secondD = bestD;
      second = best;
      bestD = d;
      best = i;
    } else if (d < secondD) {
      secondD = d;
      second = i;
    }
  }
  const blend = secondD === Infinity ? 0 : bestD / (bestD + secondD);
  return { region: centres[best].region, neighbour: centres[second].region, blend };
}

/**
 * Deals the regions out around the valley for a new gathering.
 *
 * The radius range was pulled inward from 0.25-0.70: at that spread the regions
 * ringed the valley and left its middle -- where you start -- outside all of them,
 * which made the spawn the emptiest ground in the game.
 */
export function placeRegions(rng) {
  const order = REGIONS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  centres = order.map((regionIndex, i) => {
    const a = (i / order.length) * Math.PI * 2 + rng() * 0.9;
    const r = WORLD_R * (0.16 + rng() * 0.4);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, region: REGIONS[regionIndex] };
  });
  return centres;
}

export { REGIONS, LANDMARKS, centres };
