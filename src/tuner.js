// tuner.js — a live tuning panel, built automatically from config.js.
//
// Open the game with ?tune on the end of the URL:
//
//   http://localhost:5173/?tune
//   https://ashura09.github.io/orb-seeker/?tune        (works on your phone)
//
// Drag a slider and the game responds immediately, because config.js is read
// every frame rather than copied at startup. Tune until it feels right, then
// press "Copy what I changed" and edit those few lines in config.js.
//
// This file is loaded ONLY when ?tune is present. Vite splits it into its own
// chunk, so players who never open the panel never download lil-gui.
import GUI from 'lil-gui';
import { CONFIG } from './config.js';

// Values that are read once when the page loads rather than every frame.
// Changing these does nothing until you reload, so they are marked instead of
// quietly appearing to do nothing.
const NEEDS_RELOAD = new Set([
  'world.radius',
  'world.trees',
  'world.rocks',
  'world.pillars',
  'world.groundSegments',
  'orbs.litAtOnce',
  'orbs.lightRange',
]);

// Sensible slider ranges, derived from the starting value. A number that starts
// at 0.05 wants a different scale from one that starts at 150.
function rangeFor(key, v) {
  if (key.toLowerCase().includes('chance') || (v > 0 && v <= 1 && !Number.isInteger(v))) {
    return [0, 1, 0.005];
  }
  if (v < 0) return [v * 3, Math.abs(v) * 3, Math.abs(v) / 100];
  if (v === 0) return [0, 1, 0.01];
  if (Number.isInteger(v)) return [0, Math.max(10, Math.ceil(v * 3)), 1];
  return [0, +(v * 3).toFixed(4), +(v / 100).toFixed(5)];
}

// ---------- saving what you tuned ----------
//
// Two options, and the diff is the one to reach for. It lists only what you
// changed, so you edit those few lines in config.js by hand and KEEP ALL THE
// COMMENTS there. Pasting a whole regenerated file over config.js would throw
// every explanation away, which is a poor trade for saving a minute.
function changedValues(startingValues) {
  const rows = [];
  for (const [group, values] of Object.entries(CONFIG)) {
    for (const [key, value] of Object.entries(values)) {
      const was = startingValues[group] ? startingValues[group][key] : undefined;
      if (typeof value === 'object' || value === was) continue;
      rows.push({ path: group + '.' + key, was, now: value });
    }
  }
  return rows;
}

function diffText(rows) {
  if (!rows.length) return '// nothing changed yet';
  const width = Math.max(...rows.map((r) => r.path.length));
  const header =
    '// ' +
    rows.length +
    ' value' +
    (rows.length === 1 ? '' : 's') +
    ' changed -- edit these in src/config.js';
  const lines = rows.map((r) => '//   ' + r.path.padEnd(width) + '  ' + r.was + '  ->  ' + r.now);
  return [header, ...lines].join('\n');
}

// The whole file, for when you have changed a great deal. Loses the comments.
function configToSource() {
  const groups = Object.entries(CONFIG).map(([group, values]) => {
    const lines = Object.entries(values).map(([k, v]) => {
      const printed = typeof v === 'number' ? +v.toFixed(5) : JSON.stringify(v);
      return '    ' + k + ': ' + printed + ',';
    });
    return '  ' + group + ': {\n' + lines.join('\n') + '\n  },';
  });
  return 'export const CONFIG = {\n' + groups.join('\n\n') + '\n};\n';
}

async function copyOut(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    console.log(label + ' copied to the clipboard:\n\n' + text);
  } catch {
    // Clipboard access needs a secure context and can be refused. Logging it
    // means the values are never actually lost.
    console.log('Clipboard refused, so here it is to copy by hand:\n\n' + text);
  }
}

export function initTuner() {
  const gui = new GUI({ title: 'Orb Seeker — tuning', width: 320 });

  // A deep copy taken before anything is touched, so "what changed" and
  // "reset" both have something honest to compare against.
  const startingValues = JSON.parse(JSON.stringify(CONFIG));

  for (const [group, values] of Object.entries(CONFIG)) {
    const folder = gui.addFolder(group);
    let reloadNote = false;

    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value) || value === null || typeof value === 'object') continue;

      if (typeof value === 'boolean') {
        folder.add(values, key);
      } else if (typeof value === 'number') {
        const [min, max, step] = rangeFor(key, value);
        const controller = folder.add(values, key, min, max, step);
        if (NEEDS_RELOAD.has(group + '.' + key)) {
          controller.name(key + ' ⟳');
          reloadNote = true;
        }
      }
    }

    if (reloadNote) folder.title(group + '  ( ⟳ = reload to apply )');
    folder.close();
  }

  const actions = {
    'Copy what I changed': () => copyOut(diffText(changedValues(startingValues)), 'Changes'),
    'Copy whole config': () => copyOut(configToSource(), 'Full config (no comments)'),
    'Reset to loaded values': () => {
      for (const [group, values] of Object.entries(startingValues)) {
        Object.assign(CONFIG[group], values);
      }
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
  };
  gui.add(actions, 'Copy what I changed');
  gui.add(actions, 'Copy whole config');
  gui.add(actions, 'Reset to loaded values');

  console.log('Tuning panel open. Drag a slider and the game responds live.');
  return gui;
}
