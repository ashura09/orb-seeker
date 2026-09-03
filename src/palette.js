// palette.js — every colour in the game, in one place.
//
// CLAUDE.md's art rule: all colours come from here. Adding a colour means editing
// this file, never writing a hex literal at the point of use. The reason is that
// there were 114 colour literals across ten files, 79 of them distinct, and
// nothing stopped two greens from quietly being different greens.
//
// This file is a pure EXTRACTION: every value below is exactly what was inline
// before, so nothing changed colour. The reduction to a tight palette is the
// polish pass's job, not this one.
//
// The polish guide asks for roughly eight core colours plus the seven orbs. The
// groups below are ordered with that in mind — the SEVEN and the CORE are what
// should survive; everything under "still to be reduced" is a candidate to be
// merged into them.
//
// Imported as a namespace everywhere (`import * as P from './palette.js'`) so a
// name like EYE or GOLD cannot collide with a local variable at the use site.

// ---------------------------------------------------------------------------
// THE SEVEN. Rainbow order, orb 1 to orb 7. These are the most saturated things
// in the game and that is deliberate: the eye goes to saturation, so the thing
// you are hunting should be the brightest thing on screen.
// ---------------------------------------------------------------------------
export const ORB = [0xff6b6b, 0xffa94d, 0xffe066, 0x8ce99a, 0x66d9e8, 0x748ffc, 0xda77f2];

// ---------------------------------------------------------------------------
// CORE — the handful that carry the whole look, and the ones to keep.
// ---------------------------------------------------------------------------
export const BRASS = 0xc9a15a; // metal, trim, lantern cages, UI borders
export const MINT = 0x8ff5c8; // the finder, the Keeper's eyes: "this is a system"
export const CREAM = 0xf6efdf; // panels and paper
export const INK = 0x1b1a17; // eyes, text, the darkest thing
export const SASH = 0xe0553d; // the one warm red, on the player and one villager
export const BARK = 0x6b4a2a; // wood everywhere
export const STONE = 0x9aa3ab; // rock and steel
export const SKIN = 0xd9a878; // faces

// ---------------------------------------------------------------------------
// GROUND, by region. Two shades each: the terrain mottles between them.
// ---------------------------------------------------------------------------
export const GROUND_MEADOW = [0x55984a, 0x6ab558];
export const GROUND_FOREST = [0x2c6b38, 0x3a7d45];
export const GROUND_HIGHLAND = [0x8a8f76, 0x9ba190];
export const GROUND_WETLAND = [0x4a8f6a, 0x5aa47c];
export const GROUND_BURN = [0x6b5f45, 0x7d6f52];

export const ROCK_FACE = 0x7a7164; // what steep ground blends toward
export const DISTANT_HILLS = 0x6f8570; // the ring of scenery you can never reach
export const WATER = 0x3f8fbf;
export const GROUND_BOUNCE = 0x6f8a5e; // light coming back UP off the grass

// ---------------------------------------------------------------------------
// SKY AND LIGHT
// ---------------------------------------------------------------------------
export const DAY_HORIZON = 0xbfe0f5;
export const DAY_ZENITH = 0x4a90d9;
export const NIGHT_HORIZON = 0x2a3560;
export const NIGHT_ZENITH = 0x070d24;
export const FOG_DAY = 0x8fc7ff;
export const FOG_NIGHT = 0x0a0f2a;
export const SUN = 0xfff0d0; // warm, not white — a white sun looks like a lamp
export const SKY_FILL = 0xe6f2ff;
export const AMBIENT = 0xbdd4e8;
export const WHITE = 0xffffff; // orb lights borrow the orb's own colour; this is the default

// ---------------------------------------------------------------------------
// PROPS — the remap applied to the glTF kit, which shipped orange bark and
// turquoise leaves. See PALETTE in props.js for how these are matched.
// ---------------------------------------------------------------------------
export const LEAF = 0x63b04a;
export const LEAF_DARK = 0x2f6b34;
export const GRASS_TUFT = 0x7cbf5a;
export const BARK_DARK = 0x55381f;
export const WOOD_INNER = 0xc9a882;
export const DIRT = 0x7a6142;
export const STONE_DARK = 0x767c84;
export const PROP_DEFAULT = 0xa8a8a8;

// ---------------------------------------------------------------------------
// THE PLAYER
// ---------------------------------------------------------------------------
export const SUIT = 0x2b2d5c;
export const SUIT_CLOAK = 0x5b2c83; // the Violet suit, once bought and worn
export const FUR = 0x7a4f2b;
export const HAT_BRIM = 0xd9b86a;
export const HAT_TOP = 0xcfa955;
export const LANTERN_LIGHT = 0xffd27a;

// ---------------------------------------------------------------------------
// THE SEVEN VILLAGERS — a coat, a hat and a skin tone each. Their silhouettes
// differ too; colour alone should never be the only way to tell them apart.
// ---------------------------------------------------------------------------
export const VILLAGER = {
  bram: { coat: 0x6b8e23, hat: 0x5a3d1e, skin: 0xd9a878 },
  nell: { coat: 0x9b59b6, hat: 0xf6efdf, skin: 0xf1c9a5 },
  pip: { coat: 0x3d8fc9, hat: 0xe0553d, skin: 0xe8bb90 },
  marla: { coat: 0x8a6a3a, hat: 0x7f8c8d, skin: 0xc98f63 },
  tarrow: { coat: 0x7f8c8d, hat: 0x1b1a17, skin: 0xdcb894 },
  sable: { coat: 0x1b1a17, hat: 0xc9a15a, skin: 0xd9a878 },
  pilgrim: { coat: 0xd9d9d9, hat: 0x2b2d5c, skin: 0xcfa07a },
};

// Shared villager gear.
export const STEEL = 0x9aa3ab;
export const STRAW = 0xcfa955;
export const BOOT = 0x4a4038;
export const WHISKERS = 0xe8e8e8;
export const LEATHER = 0x8a6a3a;
export const STRAP = 0x5a3d1e;
export const LEAF_PROP = 0x3d8f45;

// ---------------------------------------------------------------------------
// THE KEEPER — the dragon is the only thing allowed to be this bright.
// ---------------------------------------------------------------------------
export const DRAGON_SCALE = 0xf1e2b5;
export const DRAGON_BELLY = 0xfff5d8;
export const DRAGON_DARK = 0x2a2320;
export const DRAGON_WING = 0xe6cf95;
export const DRAGON_SPARK = 0xfff3c4;
export const DRAGON_LIGHT = 0xffe9b0;

// ---------------------------------------------------------------------------
// PICKUPS
// ---------------------------------------------------------------------------
export const CRATE = 0x8a6a3a;
export const WISH_TOKEN = 0xffe9b0;
export const WISH_GLOW = 0xfff0c8;

// ---------------------------------------------------------------------------
// SHOP ITEMS — the swatch shown beside each item in the trader and the satchel.
// ---------------------------------------------------------------------------
export const ITEM = {
  boots: 0x66d9e8,
  lens: 0x8ce99a,
  grip: 0xe0553d,
  lantern: 0xffe066,
  hat: 0xd9b86a,
  cloak: 0x9b59b6,
  charm: 0xc9a15a,
  bell: 0xdddddd,
};
