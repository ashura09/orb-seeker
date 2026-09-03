// inventory.js — the pickups you walk over, and the Inventory panel.
//
// Pickups are the one way anything enters your inventory: the shop sets bought
// items down beside you, and the Keeper sets your wishes down as tokens.
import * as THREE from 'three';
import { scene, mat, glow, hex, pointLight, $, G } from './state.js';
import { player, applyCosmetics } from './player.js';
import { surfaceHeightAt } from './world.js';
import { save, persist, owned } from './save.js';
import { worn, toggleWorn, wearIfRoom, slots, wornCount } from './loadout.js';
import { toast, bump, ordinal } from './ui.js';
import { ITEMS, item } from './shop.js';
import { emit, on, EVENTS } from './events.js';

// {g, kind:'item'|'wish', id?, text?, phase}
export const pickups = [];

export function spawnPickup(kind, data, angleHint){
  const g = new THREE.Group();
  if (kind === 'item'){
    const it = item(data);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), mat(0x8a6a3a));
    const lid  = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.18, 0.54), mat(it.color, 0.35)); lid.position.y = 0.32;
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), mat(0xc9a15a)); clasp.position.set(0, 0.22, 0.28);
    g.add(base, lid, clasp, pointLight(it.color, 0.9, 6));
    g.userData = {kind, id:data};
  } else {
    const tok = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(0xffe9b0, 0.9));
    tok.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), glow(0xfff0c8, 0.2)));
    tok.add(pointLight(0xffe9b0, 1.2, 8));
    g.add(tok); g.userData = {kind, text:data};
  }
  const a = angleHint !== undefined ? angleHint : Math.random()*Math.PI*2;
  const gx = player.position.x + Math.cos(a)*3.2, gz = player.position.z + Math.sin(a)*3.2;
  g.position.set(gx, surfaceHeightAt(gx, gz) + 0.7, gz);
  scene.add(g); pickups.push({g, kind, phase:Math.random()*6});
}

export function collectPickup(p, idx){
  scene.remove(p.g); pickups.splice(idx, 1);
  if (p.kind === 'item'){
    // Picking it up makes it yours permanently. Putting it ON is a separate
    // step, and only happens if you have room -- silently displacing something
    // you deliberately chose would be worse than leaving the new thing off.
    const id = p.g.userData.id; save.items[id] = 'owned'; persist();
    const put = wearIfRoom(id);
    applyCosmetics();
    toast(put ? `${item(id).name} — worn`
              : `${item(id).name} added. No room to wear it; open your satchel.`, put ? 2 : 3);
  } else {
    save.wishes.push({text:p.g.userData.text, cycle:save.cycles}); persist();
    toast(`Wish kept: “${p.g.userData.text}”`, 3);
  }
  bump($('satchelBtn'));
  if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
  if (G.ceremony && !pickups.some(q => q.kind === 'wish')) emit(EVENTS.WISHES_ALL_COLLECTED);
}

export function renderSatchel(){
  const w = $('satchelWishes'); w.innerHTML = '';
  if (!save.wishes.length) w.innerHTML = '<div class="empty">No wishes yet. Gather the seven orbs.</div>';
  save.wishes.forEach(x => {
    const r = document.createElement('div'); r.className = 'wishrow';
    r.innerHTML = `<span class="star">✦</span><div><div>“${x.text.replace(/</g,'&lt;')}”</div><div class="meta">Granted on your ${ordinal(x.cycle)} gathering</div></div>`;
    w.appendChild(r);
  });
  // Owning is listed with `owned`; wearing is a separate toggle per row. This
  // is the only place in the game where a loadout is chosen, so it is also the
  // only place that needs to know the difference.
  const it = $('satchelItems'); it.innerHTML = '';
  const have = ITEMS.filter(u => owned(u.id));
  if (!have.length) it.innerHTML = '<div class="empty">Nothing yet. Win duels and visit the trader.</div>';

  const cap = slots();
  if (have.length && cap > 0){
    const h = document.createElement('div'); h.className = 'slotline';
    h.textContent = `Worn ${wornCount()} of ${cap}`;
    it.appendChild(h);
  }

  have.forEach(u => {
    const on = worn(u.id);
    const row = document.createElement('div'); row.className = 'item' + (on ? ' isworn' : '');
    row.innerHTML = `<div class="row"><div class="swatch" style="background:${hex(u.color)}"></div><div><div class="name">${u.name}</div><div class="desc">${u.desc}</div></div></div>`;
    const b = document.createElement('button');
    b.textContent = on ? 'Take off' : 'Wear';
    b.addEventListener('click', () => {
      const r = toggleWorn(u.id);
      if (!r.ok){ toast(r.reason, 3); return; }
      // loadout.js already announced the change and player.js has redressed the
      // monkey; all that is left is to redraw the list we are standing in.
      renderSatchel();
      bump($('satchelBtn'));
    });
    row.appendChild(b);
    it.appendChild(row);
  });
}

// shop.js takes the payment and announces it. Setting the crate down in the
// world is this file's job, so the shop no longer needs to know how that works.
on(EVENTS.ITEM_BOUGHT, id => spawnPickup('item', id));

$('satchelBtn').addEventListener('click', () => { if (G.state !== 'play') return; G.state = 'satchel'; renderSatchel(); $('satchel').classList.remove('hidden'); });
$('satchelClose').addEventListener('click', () => { $('satchel').classList.add('hidden'); G.state = 'play'; });
