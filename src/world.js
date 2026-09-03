// world.js — builds the valley, and is the one place the rest of the game asks
// about it.
//
// This file used to be 933 lines doing eight jobs. It is now the assembler: it
// puts the pieces in the right order and re-exports what other modules need, so
// nothing outside had to change its imports.
//
// ORDER MATTERS, and each dependency is why:
//
//   1. regions   decide where the landforms are; every height depends on them
//   2. terrain   the noise offset, so the same seed gives the same shape
//   3. ground    the mesh is shaped and coloured from those heights
//   4. horizon   distant hills, which need nothing but the seed
//   5. scatter   scenery stands ON the ground, so the ground must exist first
//   6. water     fills a basin, so it must know the finished terrain
import { makeRng } from './rng.js';
import { placeRegions, centres, WORLD_R, regionAt } from './regions.js';
import { heightAt, surfaceHeightAt, setNoiseOffset } from './terrain.js';
import { shapeGround } from './ground.js';
import { buildHorizon } from './horizon.js';
import { scatterScenery, obstacles } from './scatter.js';
import { fillWater, waterLevel, waterRadius, isInWater } from './water.js';

// Where the named places are, and a counter that changes whenever the valley is
// rebuilt. map.js watches the counter so it knows when its cached image is of a
// landscape that no longer exists.
export let places = [];
export let worldVersion = 0;

/** Builds, or rebuilds, the entire valley from one seed. */
export function buildWorld(seed) {
  const rng = makeRng(seed);
  setNoiseOffset((seed % 1000) * 0.37); // a different landscape shape each time

  placeRegions(rng);
  places = centres.map((c) => ({
    x: c.x,
    z: c.z,
    name: c.region.name,
    landmark: c.region.landmark,
  }));
  worldVersion++;

  shapeGround();
  buildHorizon(rng);
  scatterScenery(rng);
  fillWater();
}

// The public face of the valley. Everything outside imports from here, which is
// why splitting the file needed no changes anywhere else.
export {
  WORLD_R,
  obstacles,
  regionAt,
  heightAt,
  surfaceHeightAt,
  isInWater,
  waterLevel,
  waterRadius,
};
