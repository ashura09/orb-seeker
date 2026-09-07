// sound.js — the game had none.
//
// Every beat we built this week happens in silence: the orb bursts, the level
// rises, the rank is promoted, the duel is won. Sound is the cheapest way to
// double what all of that is worth.
//
// WHY THERE ARE NO AUDIO FILES
//
// The usual answer is to download a pack of CC0 effects. Everything here is
// SYNTHESISED instead, with the Web Audio API, and that is a deliberate choice
// rather than a shortcut:
//
//   - it downloads nothing, so the game stays instant on a phone
//   - there is no licence to track and no credits to keep in step
//   - a note is a number, so every sound is tunable from config.js like
//     everything else in this project
//
// The trade is that it cannot make a realistic sound. It does not need to: this
// is a valley of coloured boxes, and a clean tone suits it better than a sampled
// one would.
//
// THE ORBS PLAY A SCALE. Orb one is the lowest note and orb seven the highest, so
// gathering them in order plays a rising major scale -- the reward for keeping the
// order becomes something you can hear before anyone explains it.
import { CONFIG } from './config.js';
import { save, persist } from './save.js';
import { on, EVENTS } from './events.js';

const S = CONFIG.sound;

let ctx = null;
let master = null;

/**
 * Browsers refuse to start audio until the player has touched the page, so the
 * context is built on the first gesture rather than at load. Called from the
 * start button, which every player presses before anything can make a noise.
 */
export function wakeSound() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return; // no audio here; everything below quietly does nothing
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = save.muted ? 0 : S.volume;
  master.connect(ctx.destination);
}

export const isMuted = () => !!save.muted;

export function toggleMute() {
  save.muted = !save.muted;
  persist();
  if (master) master.gain.value = save.muted ? 0 : S.volume;
  return save.muted;
}

/**
 * One note.
 *
 * @param freq   hertz
 * @param dur    seconds
 * @param type   oscillator shape: 'sine' is soft, 'triangle' has more edge
 * @param when   seconds from now, for building little melodies
 * @param level  0..1, relative to the master volume
 *
 * The envelope matters more than the waveform: a tone that starts and stops
 * instantly clicks, because the speaker is being asked to jump. Every note here
 * ramps up over a few milliseconds and decays away.
 */
function note(freq, dur, { type = 'sine', when = 0, level = 1 } = {}) {
  if (!ctx || save.muted) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** A note that slides, for whistles and swoops. */
function slide(from, to, dur, { type = 'sine', when = 0, level = 1 } = {}) {
  if (!ctx || save.muted) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// A major scale, so anything built from it is consonant by construction. Orb n
// takes degree n, which is why gathering 1 to 7 in order sounds like a scale.
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
const hz = (semitonesAboveC4) => 261.63 * 2 ** (semitonesAboveC4 / 12);
const degree = (n) => hz(SCALE[Math.max(0, Math.min(SCALE.length - 1, n))]);

// ---------------------------------------------------------------------------
// The sounds themselves, wired to what already happens.
// ---------------------------------------------------------------------------

on(EVENTS.ORB_COLLECTED, (orb) => {
  // Its own note, plus the octave above for sparkle.
  const base = degree((orb.n || 1) - 1);
  note(base, 0.5, { type: 'triangle', level: 0.5 });
  note(base * 2, 0.4, { type: 'sine', when: 0.04, level: 0.25 });
});

on(EVENTS.LEVEL_UP, ({ newRank }) => {
  // A rank is a bigger thing than a level, so it gets a third note and lands on
  // the octave rather than the fifth.
  note(degree(0), 0.18, { type: 'triangle', level: 0.45 });
  note(degree(2), 0.18, { type: 'triangle', when: 0.1, level: 0.45 });
  note(degree(4), 0.32, { type: 'triangle', when: 0.2, level: 0.45 });
  if (newRank) note(degree(7), 0.5, { type: 'triangle', when: 0.32, level: 0.5 });
});

on(EVENTS.DUEL_ENDED, ({ won }) => {
  if (won) {
    note(degree(4), 0.16, { type: 'triangle', level: 0.5 });
    note(degree(7), 0.42, { type: 'triangle', when: 0.12, level: 0.5 });
  } else {
    // Down a tone, and softer. Losing should sound like a shrug, not a buzzer:
    // a nine-year-old loses a lot and must not be punished for it in the ears.
    slide(degree(3), degree(1), 0.4, { type: 'sine', level: 0.32 });
  }
});

on(EVENTS.QUEST_DONE, () => {
  note(degree(4), 0.14, { type: 'sine', level: 0.4 });
  note(degree(6), 0.3, { type: 'sine', when: 0.1, level: 0.4 });
});

on(EVENTS.TITLES_EARNED, () => {
  note(degree(5), 0.16, { type: 'triangle', level: 0.4 });
  note(degree(7), 0.36, { type: 'triangle', when: 0.12, level: 0.45 });
});

on(EVENTS.WHISTLE, () => {
  // Two notes up: the shape of an actual whistle across a field.
  slide(degree(4), degree(7), 0.16, { type: 'sine', level: 0.35 });
  slide(degree(7), degree(9), 0.22, { type: 'sine', when: 0.16, level: 0.3 });
});

on(EVENTS.JUMP, () => slide(degree(2), degree(5), 0.12, { type: 'sine', level: 0.18 }));

/**
 * A duel tap, pitched by how full your bar is, so a duel you are winning sounds
 * like a rising run. Called directly from duel.js rather than through the bus:
 * this fires many times a second and an event per tap is more machinery than a
 * blip deserves.
 */
export function tapBlip(fraction) {
  note(degree(Math.round(fraction * 7)), 0.07, { type: 'square', level: 0.14 });
}
