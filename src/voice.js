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
// so much harder than the one by orb 1 — their difficulty IS their story.
// So each voice belongs to someone who got exactly that far and stopped:
//
//   Bram    (1) never really tried. Warm about it.
//   Nell    (2) found something she liked better than wishing.
//   Pip     (3) rushed, broke the order, still insists it was fine.
//   Marla   (4) got halfway on sheer strength. Says little.
//   Tarrow  (5) has watched many seekers pass. Kind, and a little sad.
//   Sable   (6) failed at the sixth twice, and it still stings.
//   Pilgrim (7) reached the seventh and chose not to wish. Barely speaks.
//
// Keyed by the `short` name in wanderers.js.

export const VILLAGER_VOICE = {
  'Bram': {
    challenge: 'One orb. That is all I ever carried out of this valley. Let us see if your arms are better than mine were.',
    theyWin:   'Ha! Still in me somewhere. Go on — the rest of them are worse than me.',
    theyLose:  'Quick hands. I wish I had had them when it counted.',
  },
  'Nell': {
    challenge: 'The second is mine. Not that I wanted the others — there are better things growing out here than wishes.',
    theyWin:   'Patience beats hurry. Ask the moss, it has been here longer.',
    theyLose:  'Off you go, then. Mind the nettles down by the water.',
  },
  'Pip': {
    challenge: 'Third! Third, and I would have had the lot, only I grabbed them out of order like a fool. Come on, quickly.',
    theyWin:   'Too slow! Everyone is always too slow.',
    theyLose:  'Fine. You are quick. Do not be quick about the order, though. That is how you end up camped by the third.',
  },
  'Marla': {
    challenge: 'Four. Halfway, near enough. You will not rush me.',
    theyWin:   'Hands like stone. I did say.',
    theyLose:  'Hm. Good. Take it.',
  },
  'Tarrow': {
    challenge: 'The fifth. I have watched a great many people walk past me, and rather fewer walk back. Let us see which you are.',
    theyWin:   'No shame in it. I have lost at this spot more times than you have stood on it.',
    theyLose:  'Go on, then. And when it asks you — think before you speak.',
  },
  'Sable': {
    challenge: 'Six. Twice I stood here, and twice I turned around. You will do no better.',
    theyWin:   'As I thought. The sixth keeps its own.',
    theyLose:  'Again? Then go. Go and see what is past it, and come back and tell me.',
  },
  'the Pilgrim': {
    challenge: 'I have been where you are going.',
    theyWin:   'Then you are not ready. Good.',
    theyLose:  'Go. Ask carefully.',
  },
};

// Falls back rather than crashing if a name is ever added to wanderers.js
// without a voice here.
const FALLBACK = {
  challenge: 'A duel, then. Ten seconds.',
  theyWin:   'Better luck further out.',
  theyLose:  'Well fought.',
};
export function voiceOf(shortName){
  return VILLAGER_VOICE[shortName] || FALLBACK;
}

// ---------- the Keeper ----------
//
// It has met this player before, and says so. `cycles` is how many gatherings
// they have already completed, so 0 means this is the first time.
export function keeperGreeting(cycles, orderKept){
  if (orderKept){
    if (cycles === 0) return 'Seven orbs, gathered in perfect order. It has been a long while since anyone managed that. Speak three wishes.';
    if (cycles < 3)   return 'In order again. You have the patience this valley asks for. Three wishes, then.';
    if (cycles < 7)   return 'You keep returning, and you keep them in order. I know your step by now. Three wishes.';
    return 'Again, and in order. I have granted you a great deal, seeker. Three wishes.';
  }
  if (cycles === 0) return 'You have gathered all seven. They were not in order, and so there is one wish. Speak it.';
  if (cycles < 3)   return 'All seven, though hurried. One wish.';
  return 'Hurried again. You know what the order is worth, and still you rush. One wish.';
}

// ---------- old wishes ----------
//
// Shown quietly at the start of a gathering. This is the whole game in one line
// of text: the valley remembers what you asked for, even when you have
// forgotten. `gatheringsAgo` is how many cycles back it was.
export function wishEcho(text, gatheringsAgo){
  const quoted = `“${text}”`;
  if (gatheringsAgo <= 0) return `You asked for ${quoted} not long ago.`;
  if (gatheringsAgo === 1) return `One gathering ago you asked for ${quoted}.`;
  return `${gatheringsAgo} gatherings ago you asked for ${quoted}.`;
}
