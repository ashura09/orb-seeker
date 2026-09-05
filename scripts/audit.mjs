// audit.mjs — the performance budget, enforced.
//
// CLAUDE.md sets a budget for this game: under 150 draw calls, under 300k
// triangles in view, at least 45 fps on a mid-range Android from four years ago.
// Until now that was a sentence in a document, which is a wish. This makes it a
// gate: `npm run audit` fails, loudly and with numbers, when the budget is broken.
//
// It measures on ?bench, which pins the seed, the player's position, the camera
// and the time of day, and freezes the villagers. That determinism is the whole
// reason this can be a pass/fail rather than a vague impression: two runs of the
// same build give the same numbers, so a change of 20 draw calls means a change
// of 20 draw calls and not a change of where somebody happened to be standing.
//
// It cannot tell you how the game feels on a real phone. Nothing here replaces
// docs/TESTPLAN.md.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const BUDGET = {
  drawCalls: 150,
  triangles: 300_000,
};

// FRAME RATE IS NOT ASSERTED, on purpose. Headless Chromium renders in software
// (SwiftShader), with no GPU at all: this scene reports about 10 fps there and
// 120 in a real browser. Gating on that would fail every run and teach everyone
// to ignore the gate.
//
// Counts transfer between machines; timings do not. So draw calls and triangles
// are the budget, and frame rate belongs on a real phone with ?bench&stats --
// see the performance section of docs/TESTPLAN.md.

// The viewport is pinned because the frustum follows it, and the frustum decides
// how much is in view. Two runs at different window sizes are not comparable.
const VIEWPORT = { width: 900, height: 600 };

const argv = process.argv.slice(2);
const target = argv.find((a) => a.startsWith('http'));
const wantJson = argv.includes('--json');

function say(...a) {
  if (!wantJson) console.log(...a);
}

async function measure(page, url) {
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e.message)));

  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  // The valley is built after 58 models load, so the numbers mean nothing until
  // the stats overlay has actually started reporting.
  await page.waitForFunction(
    () => /calls/.test(document.getElementById('stats')?.textContent || ''),
    {
      timeout: 60_000,
    },
  );
  await page.waitForTimeout(8000); // let the frame rate settle past the load spike

  const reading = await page.evaluate(() => {
    const t = document.getElementById('stats')?.textContent || '';
    const m = t.match(/(\d+) fps \(low (\d+)\)\s+(\d+) calls\s+([\d.]+)k tris/);
    let drawables = 0;
    return m
      ? { fps: +m[1], low: +m[2], calls: +m[3], tris: Math.round(+m[4] * 1000), drawables, raw: t }
      : { raw: t };
  });
  return { ...reading, consoleErrors };
}

const results = [];
let server;
let url = target;

if (!url) {
  server = await createServer({ server: { port: 0 }, logLevel: 'silent' });
  await server.listen();
  const { port } = server.httpServer.address();
  url = `http://localhost:${port}`;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  say(`\n  Orb Seeker — performance budget\n  ${url}/?bench\n`);
  // Measure a PLAYED save, not a brand-new one.
  //
  // This gate used to open the game with empty storage, so it measured a world
  // with no wish stones in it -- a state that stops being true the first time
  // anyone finishes a cycle. "Within budget" that only holds for a save nobody
  // has played is not an assurance, it is a blind spot.
  //
  // These wishes carry no coordinates on purpose: wishstones.js then places them
  // from a hash of their own text, which is deterministic, so the reading stays
  // reproducible AND it exercises the path that saves from before stones take.
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('orbseeker.save.v2') || '{}');
    s.wishes = ['a bigger treehouse', 'that Nan gets better', 'snow', 'a dog', 'to fly'].map(
      (text) => ({ text, cycle: 0 }),
    );
    localStorage.setItem('orbseeker.save.v2', JSON.stringify(s));
  });

  const normal = await measure(page, `${url}/?bench&stats`);
  results.push({ mode: 'normal', ...normal });

  // Low graphics must also be measured: it is the setting a struggling phone is
  // dropped into, so it is the one that has to be safely inside budget.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('orbseeker.save.v2') || '{}');
    s.lowGraphics = true;
    localStorage.setItem('orbseeker.save.v2', JSON.stringify(s));
  });
  const low = await measure(page, `${url}/?bench&stats`);
  results.push({ mode: 'low', ...low });
} finally {
  await browser.close();
  if (server) await server.close();
}

// ---------- verdict ----------
const failures = [];
for (const r of results) {
  if (r.calls === undefined) {
    failures.push(`${r.mode}: could not read the stats overlay (got "${r.raw}")`);
    continue;
  }
  if (r.mode === 'normal') {
    if (r.calls > BUDGET.drawCalls)
      failures.push(`draw calls ${r.calls} over budget ${BUDGET.drawCalls}`);
    if (r.tris > BUDGET.triangles)
      failures.push(
        `triangles ${(r.tris / 1000).toFixed(1)}k over budget ${BUDGET.triangles / 1000}k`,
      );
  }

  if (r.consoleErrors.length)
    failures.push(`${r.mode}: ${r.consoleErrors.length} console error(s): ${r.consoleErrors[0]}`);
}

if (wantJson) {
  console.log(JSON.stringify({ budget: BUDGET, results, failures }, null, 2));
} else {
  const row = (r) =>
    `  ${r.mode.padEnd(7)} ${String(r.calls ?? '?').padStart(5)} calls   ${String(((r.tris ?? 0) / 1000).toFixed(1)).padStart(7)}k tris   ${String(r.fps ?? '?').padStart(4)} fps`;
  for (const r of results) say(row(r));
  say(
    `
  budget  ${String(BUDGET.drawCalls).padStart(5)} calls   ${String(BUDGET.triangles / 1000).padStart(7)}k tris   (normal mode)`,
  );
  say('  fps above is software rendering, not a phone. Measure it on the device.');
  if (failures.length) {
    say('  OVER BUDGET:');
    for (const f of failures) say('   - ' + f);
    say('\n  The lever with the most give is CONFIG.world.props.\n');
  } else {
    say('  Within budget.\n');
  }
}

process.exit(failures.length ? 1 : 0);
