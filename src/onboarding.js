// onboarding.js — the first sixty seconds, and nothing else.
//
// docs/GAME-DESIGN.md section 8. The research is blunt about this: time to first
// action predicts whether a game keeps anyone better than its genre does, and
// breakout titles get you to a clear, repeatable activity inside the first
// minute. Orb Seeker opened with a nine-line wall of text explaining orbs,
// wanderers, fragments, the Keeper and wishes -- and then put the nearest thing
// to do 48 metres away.
//
// The shape now:
//
//   0-5s    one line, not five paragraphs
//   5-20s   orb one is already in sight (see pickOrbSpots' `nearFirst`)
//   20-35s  you collect it, and THEN one sentence says what orbs are
//   35-60s  Bram walks over for a duel you are meant to win
//
// TAUGHT BY DOING, NOT BY READING. Every explanation here fires after the thing
// it explains has already happened. A nine-year-old will not read a paragraph
// about a mechanic they have not met, and asking them to is how you lose them
// before the game has started.
//
// All of it is gated on `save.taught`. A returning player gets none of it: a free
// orb at the door is not a welcome once you know the game, it is a chore skipped.
import { CONFIG } from './config.js';
import { save, persist } from './save.js';
import { on, EVENTS } from './events.js';
import { toast } from './ui.js';
import { player } from './player.js';
import { wanderers } from './wanderers.js';
import { surfaceHeightAt } from './world.js';

const O = CONFIG.onboarding;

export const isNewcomer = () => !save.taught;

/** The one line on the start card. Nothing else is explained before playing. */
export function openingLine() {
  return isNewcomer()
    ? 'Something is glowing over the rise.'
    : 'The valley has shifted. The seven are scattered again.';
}

export const openingButton = () => (isNewcomer() ? 'Go and see' : 'Back to the valley');

// ---------------------------------------------------------------------------
// After the first orb: say what an orb is, then send Bram.
// ---------------------------------------------------------------------------
let bramTimer = -1;

on(EVENTS.ORB_COLLECTED, () => {
  if (!isNewcomer() || save.orbsEver !== 1) return;
  // One sentence, after the fact, about the thing they just did.
  toast('One of seven. Find them all and the Keeper grants a wish.', 4);
  bramTimer = O.bramAfter;
});

/** Called each frame from motion.js. Does nothing except during a first valley. */
export function updateOnboarding(dt) {
  if (bramTimer < 0) return;
  bramTimer -= dt;
  if (bramTimer > 0) return;
  bramTimer = -1;

  // Bram is the tier-1 camp: the gentlest duel in the game and the one a child
  // should meet first. He is walked in from a short distance rather than dropped
  // beside the player, so the first duel is something you SEE coming.
  const bram = wanderers[0];
  if (!bram) return;
  const a = Math.random() * Math.PI * 2;
  const x = player.position.x + Math.cos(a) * O.bramFrom;
  const z = player.position.z + Math.sin(a) * O.bramFrom;
  bram.g.position.set(x, surfaceHeightAt(x, z), z);
  bram.cooldown = 0; // whatever he was doing, he is coming over now
  bram.tx = player.position.x;
  bram.tz = player.position.z;
  bram.wait = 0;
}

// The lesson is over once the first duel has been fought -- won or lost. Losing
// still taught them what a duel is, which is the whole point of it.
on(EVENTS.DUEL_ENDED, () => {
  if (!isNewcomer()) return;
  save.taught = true;
  persist();
});
