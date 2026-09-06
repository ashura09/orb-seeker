// voice.js — everything anyone says.
//
// All of the game's writing lives here so you can rewrite a character without
// opening game code. This file imports nothing and does nothing; like config.js
// it is only values.
//
// THE IDEA BEHIND THE WRITING
//
// The seven villagers are former seekers who never finished. Each one camps
// beside the furthest orb they ever reached, which is why the one by orb 7 is
// so much harder than the one by orb 1 -- their difficulty IS their story.
//
// That brief, and each villager's lines, now live in content/villagers.json,
// beside the person they belong to. What is left here is the writing that has
// LOGIC in it: the Keeper picks its greeting from how many gatherings you have
// finished, and an old wish is phrased by how long ago you made it. Those are
// functions, not lists, so they stay in code.

// Built from content/villagers.json, where each villager's lines sit beside their
// face. Keyed by `short` because that is what the duel panel has to hand.
import { WANDERERS } from './villagers.js';

export const VILLAGER_VOICE = Object.fromEntries(WANDERERS.map((w) => [w.short, w.voice]));

// Falls back rather than crashing if a name is ever added to wanderers.js
// without a voice here.
// Says no number. The old fallback promised "Ten seconds", which stayed true
// until the duel was rebalanced to four and then quietly lied -- the same fault
// as the rules line, in the one place nobody thinks to look.
const FALLBACK = {
  challenge: 'A duel, then. Tap as fast as you can.',
  theyWin: 'Better luck further out.',
  theyLose: 'Well fought.',
};
export function voiceOf(shortName) {
  return VILLAGER_VOICE[shortName] || FALLBACK;
}

// ---------- the Keeper ----------
//
// It has met this player before, and says so. `cycles` is how many gatherings
// they have already completed, so 0 means this is the first time.
export function keeperGreeting(cycles, orderKept) {
  if (orderKept) {
    if (cycles === 0)
      return 'Seven orbs, gathered in perfect order. It has been a long while since anyone managed that. Speak three wishes.';
    if (cycles < 3)
      return 'In order again. You have the patience this valley asks for. Three wishes, then.';
    if (cycles < 7)
      return 'You keep returning, and you keep them in order. I know your step by now. Three wishes.';
    return 'Again, and in order. I have granted you a great deal, seeker. Three wishes.';
  }
  if (cycles === 0)
    return 'You have gathered all seven. They were not in order, and so there is one wish. Speak it.';
  if (cycles < 3) return 'All seven, though hurried. One wish.';
  return 'Hurried again. You know what the order is worth, and still you rush. One wish.';
}

// ---------- old wishes ----------
//
// Shown quietly at the start of a gathering. This is the whole game in one line
// of text: the valley remembers what you asked for, even when you have
// forgotten. `gatheringsAgo` is how many cycles back it was.
export function wishEcho(text, gatheringsAgo) {
  const quoted = `“${text}”`;
  if (gatheringsAgo <= 0) return `You asked for ${quoted} not long ago.`;
  if (gatheringsAgo === 1) return `One gathering ago you asked for ${quoted}.`;
  return `${gatheringsAgo} gatherings ago you asked for ${quoted}.`;
}
