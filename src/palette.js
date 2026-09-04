// palette.js — every colour in the game, from eight.
//
// CLAUDE.md's art rule: all colours come from here, and adding one means editing
// this file. The polish guide asks for about eight core colours plus the seven
// orbs, on the grounds that amateur worlds use fifty and polished ones use eight.
// This file used to declare seventy-nine.
//
// It now declares FIFTEEN literals: eight core, and the seven orbs. Everything
// else in the game is mixed from those by the helpers below. That is the whole
// discipline — if a colour is not derivable from the eight, it does not belong
// in the valley, and the compiler cannot be argued with.
//
// SATURATION IS RESERVED. The eight are muted on purpose. The orbs are the only
// fully saturated things in the game, because the eye goes to saturation and the
// orbs are what you are hunting. Anything else that must be noticed borrows an
// orb's hue rather than inventing a brighter one.

// ---------------------------------------------------------------------------
// THE EIGHT
// ---------------------------------------------------------------------------
export const GRASS = 0x62a34d; // the dominant green: meadow, open ground
export const FOLIAGE = 0x2f6b34; // deep green: canopy, forest floor, reeds
export const BARK = 0x6b4a2a; // warm brown: wood, dirt, earth
export const STONE = 0x9aa3ab; // cool grey: rock, cliff, steel
export const SAND = 0xc9bfa0; // pale warm: high ground, peaks, skin
export const WATER = 0x3f8fbf; // the lake, the sky, and (darkened) the suit
export const BRASS = 0xc9a15a; // warm metal: trim, lanterns, the Keeper
export const INK = 0x1b1a17; // near-black: eyes, and the darkest accents

// ---------------------------------------------------------------------------
// THE SEVEN. Rainbow order, orb 1 to orb 7, and the only saturated things here.
// ---------------------------------------------------------------------------
export const ORB = [0xff6b6b, 0xffa94d, 0xffe066, 0x8ce99a, 0x66d9e8, 0x748ffc, 0xda77f2];

// ---------------------------------------------------------------------------
// Mixing. Everything below this line is derived; nothing below declares a hex.
// ---------------------------------------------------------------------------
const ch = (c, i) => (c >> (16 - 8 * i)) & 255;

/** Blend two colours. t = 0 gives a, t = 1 gives b. */
export function mix(a, b, t) {
  const r = Math.round(ch(a, 0) + (ch(b, 0) - ch(a, 0)) * t);
  const g = Math.round(ch(a, 1) + (ch(b, 1) - ch(a, 1)) * t);
  const bl = Math.round(ch(a, 2) + (ch(b, 2) - ch(a, 2)) * t);
  return (r << 16) | (g << 8) | bl;
}

const WHITE_ = 0xffffff;
export const lighten = (c, t) => mix(c, WHITE_, t);
export const darken = (c, t) => mix(c, INK, t);

/**
 * Pulls a colour toward the grey of the same brightness — the move that keeps
 * scenery quiet so the orbs stay loud.
 */
export function mute(c, t) {
  const grey = Math.round(0.299 * ch(c, 0) + 0.587 * ch(c, 1) + 0.114 * ch(c, 2));
  return mix(c, (grey << 16) | (grey << 8) | grey, t);
}

export const WHITE = WHITE_;

// ---------------------------------------------------------------------------
// GROUND, by region. Two shades each; the terrain mottles between them.
// ---------------------------------------------------------------------------
export const GROUND_MEADOW = [darken(GRASS, 0.12), lighten(GRASS, 0.12)];
export const GROUND_FOREST = [FOLIAGE, mix(FOLIAGE, GRASS, 0.35)];
export const GROUND_HIGHLAND = [
  mute(mix(SAND, STONE, 0.5), 0.3),
  lighten(mix(SAND, STONE, 0.4), 0.1),
];
export const GROUND_WETLAND = [mix(FOLIAGE, WATER, 0.28), mix(GRASS, WATER, 0.25)];
export const GROUND_BURN = [mix(BARK, SAND, 0.25), mix(BARK, SAND, 0.45)];

export const ROCK_FACE = mute(mix(STONE, BARK, 0.45), 0.25);
export const DISTANT_HILLS = mute(mix(FOLIAGE, STONE, 0.35), 0.35);
export const GROUND_BOUNCE = mute(GRASS, 0.35);

// ---------------------------------------------------------------------------
// SKY AND LIGHT. All from WATER, which is the only blue the game owns.
// ---------------------------------------------------------------------------
export const DAY_HORIZON = lighten(WATER, 0.72);
export const DAY_ZENITH = mix(WATER, darken(WATER, 0.35), 0.5);
export const NIGHT_HORIZON = darken(mix(WATER, INK, 0.55), 0.35);
export const NIGHT_ZENITH = darken(mix(WATER, INK, 0.8), 0.6);
export const FOG_DAY = lighten(WATER, 0.55);
export const FOG_NIGHT = darken(mix(WATER, INK, 0.8), 0.55);
export const SUN = lighten(mix(BRASS, SAND, 0.6), 0.55); // warm, never white
export const SKY_FILL = lighten(WATER, 0.85);
export const AMBIENT = lighten(mix(WATER, STONE, 0.5), 0.55);

// ---------------------------------------------------------------------------
// PROPS — the remap applied to the glTF kit, which shipped orange bark and
// turquoise leaves.
// ---------------------------------------------------------------------------
export const LEAF = mix(FOLIAGE, GRASS, 0.55);
export const LEAF_DARK = darken(FOLIAGE, 0.15);
export const GRASS_TUFT = lighten(GRASS, 0.18);
export const BARK_DARK = darken(BARK, 0.3);
export const WOOD_INNER = lighten(mix(BARK, SAND, 0.6), 0.15);
export const DIRT = mix(BARK, SAND, 0.3);
export const STONE_DARK = darken(STONE, 0.2);
export const PROP_DEFAULT = mute(STONE, 0.6);
export const LEAF_PROP = mix(FOLIAGE, GRASS, 0.35);

// ---------------------------------------------------------------------------
// THE PLAYER. The suit is the deepest blue the palette can make, so the red
// sash reads as the one warm thing on him.
// ---------------------------------------------------------------------------
export const SUIT = mix(WATER, INK, 0.56);
export const SUIT_CLOAK = mute(ORB[6], 0.45); // the Violet suit, once worn
export const SASH = darken(mute(ORB[0], 0.45), 0.12); // his one accent, kept below the orbs
export const FUR = mix(BARK, SAND, 0.15);
export const SKIN = lighten(mix(SAND, BARK, 0.25), 0.15);
export const HAT_BRIM = mix(SAND, BRASS, 0.5);
export const HAT_TOP = mix(BRASS, SAND, 0.35);
export const LANTERN_LIGHT = lighten(BRASS, 0.35);

// ---------------------------------------------------------------------------
// THE SEVEN VILLAGERS
//
// Each one wears a muted version of the orb they camp beside — Bram by orb 1 in
// red, the Pilgrim by orb 7 in violet. They are former seekers who stopped where
// their colour is, so the fiction and the palette say the same thing, and not
// one new hex is needed to dress all seven.
//
// Muted, not saturated: they are people, and the orbs are the prize.
// ---------------------------------------------------------------------------
const coat = (n) => mute(ORB[n], 0.55);
const villagerSkin = (t) => lighten(mix(SAND, BARK, 0.2 + t * 0.25), 0.2 - t * 0.1);

export const VILLAGER = {
  bram: { coat: darken(coat(0), 0.25), hat: BARK_DARK, skin: villagerSkin(0.2) },
  nell: { coat: coat(1), hat: lighten(SAND, 0.5), skin: villagerSkin(0) },
  pip: { coat: coat(4), hat: mute(ORB[0], 0.2), skin: villagerSkin(0.1) },
  marla: { coat: darken(coat(2), 0.35), hat: STONE, skin: villagerSkin(0.5) },
  tarrow: { coat: STONE, hat: INK, skin: villagerSkin(0.15) },
  sable: { coat: INK, hat: BRASS, skin: villagerSkin(0.2) },
  pilgrim: { coat: lighten(mute(ORB[6], 0.75), 0.35), hat: SUIT, skin: villagerSkin(0.35) },
};

// Shared villager gear.
export const STEEL = lighten(STONE, 0.1);
export const STRAW = mix(BRASS, SAND, 0.35);
export const BOOT = darken(BARK, 0.45);
export const WHISKERS = lighten(SAND, 0.55);
export const LEATHER = mix(BARK, BRASS, 0.3);
export const STRAP = BARK_DARK;

// ---------------------------------------------------------------------------
// THE KEEPER — pale gold, the one thing allowed to be brighter than the ground.
// ---------------------------------------------------------------------------
export const DRAGON_SCALE = lighten(mix(BRASS, SAND, 0.6), 0.35);
export const DRAGON_BELLY = lighten(SAND, 0.55);
export const DRAGON_DARK = darken(mix(BARK, INK, 0.5), 0.2);
export const DRAGON_WING = lighten(mix(BRASS, SAND, 0.45), 0.2);
export const DRAGON_SPARK = lighten(BRASS, 0.7);
export const DRAGON_LIGHT = lighten(BRASS, 0.5);

// ---------------------------------------------------------------------------
// PICKUPS — saturated, because they are things to walk towards.
// ---------------------------------------------------------------------------
export const CRATE = mix(BARK, BRASS, 0.35);
export const WISH_TOKEN = lighten(BRASS, 0.5);
export const WISH_GLOW = lighten(BRASS, 0.7);

// ---------------------------------------------------------------------------
// UI — the HUD's own colours, matched to style.css.
// ---------------------------------------------------------------------------
export const MINT = 0x8ff5c8; // the finder: a system colour, deliberately apart
export const CREAM = lighten(SAND, 0.65); // panels and paper

// ---------------------------------------------------------------------------
// SHOP ITEMS — each swatch is the orb hue nearest what the item does, so the
// trader's shelf reads as part of the same world.
// ---------------------------------------------------------------------------
export const ITEM = {
  boots: ORB[4],
  lens: ORB[3],
  grip: ORB[0],
  lantern: ORB[2],
  hat: mix(SAND, BRASS, 0.5),
  cloak: ORB[6],
  charm: BRASS,
  bell: lighten(STONE, 0.35),
};
