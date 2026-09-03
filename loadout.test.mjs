// A fake localStorage so save.js can run outside a browser. This is only
// possible because save.js and loadout.js touch no three.js and no DOM --
// exactly the layering ARCHITECTURE.md asks for.
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null,
  setItem: (k,v) => store.set(k,v),
  removeItem: k => store.delete(k),
};
store.set('orbseeker.save.v2', JSON.stringify({
  fragments:0, wins:0, cycles:0, wishes:[],
  items:{boots:'owned', lens:'owned', grip:'owned', hat:'owned'},
}));

const { CONFIG } = await import('./src/config.js');
const { save }   = await import('./src/save.js');
const L          = await import('./src/loadout.js');

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

check('old save migrates to wearing everything owned', save.worn.sort(), ['boots','grip','hat','lens']);
check('worn() true for a worn item',      L.worn('boots'), true);
check('take off -> worn() false',         (L.setWorn('boots', false), L.worn('boots')), false);
check('...but still owned',               save.items.boots, 'owned');
check('put back on',                      (L.setWorn('boots', true), L.worn('boots')), true);
check('toggle flips it',                  (L.toggleWorn('boots'), L.worn('boots')), false);
check('cannot wear what you do not own',  L.setWorn('bell', true), {ok:false, worn:false, reason:'You do not have that.'});
check('unlimited slots by default',       L.slotsFree(), Infinity);

// Wear all four while unlimited, THEN tighten the limit -- the case a player
// hits when the number changes under a save that already exists.
L.setWorn('boots', true);
check('four worn while unlimited',        L.wornCount(), 4);
CONFIG.loadout.slots = 3;                       // now make it a real choice
check('over capacity is reported honestly', L.wornCount(), 4);
check('no room while over capacity',      L.slotsFree(), 0);
check('taking off still works over cap',  L.setWorn('boots', false).ok, true);
L.setWorn('hat', false);                        // down to lens, grip = 2
check('room for one more',                L.slotsFree(), 1);
check('third fits',                       L.setWorn('hat', true).ok, true);
const refused = L.setWorn('boots', true);
check('fourth is refused',                refused.ok, false);
check('and says why',                     refused.reason, 'You can only carry 3. Take something off first.');
check('refusal changed nothing',          L.wornCount(), 3);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
