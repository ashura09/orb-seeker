// run.js — the score screen at the end of a valley.
//
// docs/GAME-DESIGN.md step 3. A run had no ending, only a fade into the next
// one: you collected the seventh orb, wished, and the valley silently reshuffled.
// Nothing ever told you how it went, so there was nothing to be pleased about and
// nothing to show anyone.
//
// This is the card. It is also the answer to "how do I show my friends?" -- see
// section 11 of the design doc. It carries the VALLEY CODE, which is the seed
// this run was played on, so a friend can play the identical valley and compare.
// That works with no server, no accounts and no chat, which is why it is the
// first sharing feature rather than the last.
//
// Everything here is gathered from the event bus. This file is not imported by
// anything that produces the numbers, so nothing had to learn that a score
// screen exists.
import { $, G } from './state.js';
import { on, EVENTS } from './events.js';
import { save } from './save.js';
import { seedCode, runScore, ladderFor } from './rules.js';
import { checkTitles, baseContext, wornTitle } from './titles.js';
import { currentLevel } from './progress.js';
import { progressSummary } from './progress.js';

const run = {
  started: 0,
  orbs: 0,
  duelsWon: 0,
  duelsLost: 0,
  bestTaps: 0,
  xp: 0,
  wishes: 0,
  beatTier: 0, // the hardest camp beaten this run, for the Camp Breaker title
};

export function startRun() {
  run.started = performance.now();
  run.orbs = 0;
  run.duelsWon = 0;
  run.duelsLost = 0;
  run.bestTaps = 0;
  run.xp = 0;
  run.wishes = 0;
  run.beatTier = 0;
}
startRun();

on(EVENTS.ORB_COLLECTED, () => run.orbs++);
on(EVENTS.XP_GAINED, ({ amount }) => (run.xp += amount));
on(EVENTS.DUEL_ENDED, ({ won, tier, taps }) => {
  if (won) {
    run.duelsWon++;
    if (tier > run.beatTier) run.beatTier = tier;
  } else run.duelsLost++;
  if (taps > run.bestTaps) run.bestTaps = taps;
  // Checked here as well as at the end of a run, so Fast Hands and Camp Breaker
  // land in the moment you earn them rather than minutes later.
  checkTitles({ ...baseContext(), level: currentLevel(), beatTier: run.beatTier });
});

// Levelling can complete a title on its own, and a player may never finish
// another valley after it.
on(EVENTS.LEVEL_UP, ({ level }) => checkTitles({ ...baseContext(), level }));

/** mm:ss, because a run is minutes long and nobody reads 384 seconds. */
function clock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function row(label, value, note = '') {
  const li = document.createElement('li');
  const l = document.createElement('span');
  l.className = 'k';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'v';
  v.textContent = value;
  li.append(l, v);
  if (note) {
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = note;
    li.append(n);
  }
  return li;
}

function showCard() {
  const elapsed = performance.now() - run.started;
  const seconds = elapsed / 1000;
  const p = progressSummary();

  // Score the valley and move the ladder. The rating is your BEST run, never an
  // average, so a bad afternoon can never take a rank off a nine-year-old.
  const scored = runScore({
    seconds,
    orbs: run.orbs,
    perfectOrder: G.orderKept,
    duelsWon: run.duelsWon,
    duelsLost: run.duelsLost,
  });
  const wasRating = save.bestRun || 0;
  const climbed = scored > wasRating;
  if (climbed) save.bestRun = scored;
  const before = ladderFor(wasRating);
  const now = ladderFor(save.bestRun || 0);

  $('scoreRank').textContent = now.name;
  $('scoreRankNote').textContent =
    now.name !== before.name
      ? `Promoted from ${before.name}`
      : now.next
        ? `${now.next - (save.bestRun || 0)} more to ${ladderFor(now.next).name}`
        : 'The top of the ladder';
  $('scoreRank').classList.toggle('promoted', now.name !== before.name);

  const fresh = checkTitles({
    ...baseContext(),
    level: p.level,
    tier: now.tier,
    perfectOrder: G.orderKept,
    finished: run.orbs >= 7,
    seconds,
    duelsLost: run.duelsLost,
    beatTier: run.beatTier,
  });
  const tl = $('scoreTitles');
  tl.innerHTML = '';
  for (const t of fresh) {
    const li = document.createElement('li');
    li.textContent = t.name;
    tl.append(li);
  }
  tl.previousElementSibling.hidden = fresh.length === 0;
  tl.hidden = fresh.length === 0;

  const list = $('scoreRows');
  list.innerHTML = '';
  list.append(row('Valley score', String(scored), climbed ? 'a new best' : `best ${wasRating}`));

  list.append(row('Time', clock(elapsed)));
  list.append(
    row(
      'Orbs',
      `${run.orbs} of 7`,
      // The order rule is worth 100 XP now, so whether it held is the single
      // most interesting line on this card.
      G.orderKept ? 'in perfect order' : 'order broken',
    ),
  );
  list.append(
    row('Duels', `${run.duelsWon} won`, run.duelsLost ? `${run.duelsLost} lost` : 'none lost'),
  );
  if (run.bestTaps > 0) {
    list.append(
      row(
        'Fastest hands',
        `${run.bestTaps.toFixed(1)}/sec`,
        run.bestTaps >= (save.bestTaps || 0)
          ? 'your best ever'
          : `best ${(save.bestTaps || 0).toFixed(1)}`,
      ),
    );
  }
  list.append(row('Wishes kept', String(run.wishes || save.wishes.length)));
  list.append(row('XP earned', `+${run.xp}`, `${p.rank}, level ${p.level}`));
  const badge = wornTitle();
  if (badge) list.append(row('Title', badge.name));

  // The valley code. Shown last and given its own line, because it is the only
  // thing on this card that another person can act on.
  $('scoreSeed').textContent = seedCode(G.worldSeed);
  $('scoreTitle').textContent = G.orderKept ? 'A perfect gathering' : 'The seven, gathered';
  $('score').classList.remove('hidden');
}

// The run ends when the last wish token is picked up: the Keeper leaves, and the
// valley reshuffles a few seconds later. The card goes up at that moment and the
// rebuild happens behind it, so reading your score never costs you playing time.
on(EVENTS.WISHES_ALL_COLLECTED, () => {
  run.wishes = save.wishes.length;
  showCard();
});

$('scoreDone').addEventListener('click', () => {
  $('score').classList.add('hidden');
  startRun(); // the next valley starts counting from the moment you close this
});

// Copy is best-effort: the clipboard API needs a secure context and a real user
// gesture, and this runs on phones and inside odd webviews. If it is refused the
// code is still on the screen to be read out, which is how most of these will
// actually travel anyway.
$('scoreCopy').addEventListener('click', async () => {
  const code = $('scoreSeed').textContent;
  try {
    await navigator.clipboard.writeText(code);
    $('scoreCopy').textContent = 'Copied';
  } catch {
    $('scoreCopy').textContent = 'Read it out';
  }
  setTimeout(() => ($('scoreCopy').textContent = 'Copy code'), 2000);
});
