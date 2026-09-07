// modifiers.js — the Turning, and how the next valley differs.
//
// docs/GAME-DESIGN.md section 4. The valley already regenerates from a seed after
// every ceremony, and until now that was pure loss: the world you had learned was
// gone and nothing replaced it. Naming it **the Turning** and letting you choose
// how the next one differs turns the game's biggest subtraction into its
// long-term reason to continue -- the prestige mechanic it already had and never
// collected on.
//
// You keep everything. Level, items, titles, badges, wish stones, best times. The
// only thing that changes is the valley, which was going to change anyway.
//
// EFFECTS ARE CODE. content/modifiers.json carries each one's name, hint and the
// level it opens at; what it actually DOES lives here, because an effect is
// logic. The loader is handed the ids written here and refuses any modifier that
// has no effect, so one can never be offered and then quietly do nothing.
import { save, persist } from './save.js';
import { loadModifiers } from './content.js';
import { currentLevel } from './progress.js';

/**
 * Every effect, as plain multipliers and flags read at the few places that care.
 *
 * Kept as numbers rather than callbacks on purpose: a modifier that can run
 * arbitrary code is a modifier you cannot reason about, and these have to
 * compose with a carefully balanced duel.
 */
const EFFECTS = {
  none: {},
  thin: { props: 0.55 }, // fewer trees -- and, incidentally, fewer draw calls
  night: { forceNight: true },
  rich: { loot: 1.5 },
  // Quicker opponents AND better pay. Difficulty without reward is a punishment,
  // and this is something a player chose.
  fierce: { duelRate: 1.18, loot: 1.35 },
};

export const MODIFIERS = loadModifiers(Object.keys(EFFECTS));

const byId = new Map(MODIFIERS.map((m) => [m.id, m]));

/** Which modifiers this player has reached. Always at least one. */
export const availableModifiers = () => MODIFIERS.filter((m) => currentLevel() >= m.unlockLevel);

/** The next one still to come, for something to look forward to. Null at the end. */
export const nextModifier = () =>
  MODIFIERS.filter((m) => currentLevel() < m.unlockLevel).sort(
    (a, b) => a.unlockLevel - b.unlockLevel,
  )[0] || null;

/** The modifier in force for the valley being played. */
export function activeModifier() {
  return byId.get(save.modifier) || byId.get('none');
}

/**
 * Choose the modifier for the NEXT valley. Refuses one this player has not
 * reached, so a stale save or a fiddled value cannot grant it early.
 */
export function chooseModifier(id) {
  const m = byId.get(id);
  if (!m || currentLevel() < m.unlockLevel) return false;
  save.modifier = m.id;
  persist();
  return true;
}

// ---------------------------------------------------------------------------
// What the rest of the game asks. All default to "no change", so a save with a
// modifier we no longer ship simply plays an ordinary valley.
// ---------------------------------------------------------------------------
const of = (key, fallback) => EFFECTS[activeModifier().id]?.[key] ?? fallback;

/** Multiplier on how much scenery the valley scatters. */
export const propScale = () => of('props', 1);

/** True when this valley is dark the whole way through. */
export const forcedNight = () => of('forceNight', false);

/** Multiplier on fragments won from a duel. */
export const lootScale = () => of('loot', 1);

/** Multiplier on how fast an opponent fills their bar. */
export const duelRateScale = () => of('duelRate', 1);

/** How many valleys this player has turned. The count IS `cycles`. */
export const turnings = () => save.cycles || 0;
