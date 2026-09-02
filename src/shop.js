// shop.js — the trader's cart and the item definitions.
//
// Buying does not put the item straight in your inventory: it spawns a pickup
// in the world beside you, and you keep it by walking over it.
import { $, G, hex } from './state.js';
import { save, persist } from './save.js';
import { renderPouch, toast, pouchEl } from './ui.js';
import { emit, EVENTS } from './events.js';
import { ITEMS } from './config.js';

export { ITEMS };


// A function declaration, not an arrow const, so that files in an import cycle
// with this one can still call it safely.
export function item(id){ return ITEMS.find(i => i.id === id); }

export function renderShop(){
  const box = $('shopItems'); box.innerHTML = '';
  for (const u of ITEMS){
    const row = document.createElement('div'); row.className = 'item';
    const left = document.createElement('div'); left.className = 'row';
    const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = hex(u.color);
    const txt = document.createElement('div'); txt.innerHTML = `<div class="name">${u.name}</div><div class="desc">${u.desc}</div>`;
    left.append(sw, txt); row.appendChild(left);
    const st = save.items[u.id];
    if (st){ const o = document.createElement('span'); o.className='owned'; o.textContent = st === 'owned' ? 'Kept' : 'Set down for you'; row.appendChild(o); }
    else {
      const b = document.createElement('button'); b.textContent = `${u.cost} ◆`; b.disabled = save.fragments < u.cost;
      b.addEventListener('click', () => {
        save.fragments -= u.cost; save.items[u.id] = 'bought'; persist(); renderPouch(); renderShop();
        emit(EVENTS.ITEM_BOUGHT, u.id); toast(`${u.name} set down beside you`);
      });
      row.appendChild(b);
    }
    box.appendChild(row);
  }
}

pouchEl.addEventListener('click', () => { if (G.state !== 'play') return; G.state = 'shop'; renderShop(); $('shop').classList.remove('hidden'); });
$('shopClose').addEventListener('click', () => { $('shop').classList.add('hidden'); G.state = 'play'; });
