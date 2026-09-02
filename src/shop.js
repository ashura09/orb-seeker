// shop.js — the trader's cart and the item definitions.
//
// Buying does not put the item straight in your inventory: it spawns a pickup
// in the world beside you, and you keep it by walking over it.
import { $, G, hex } from './state.js';
import { save, persist } from './save.js';
import { renderPouch, toast, pouchEl } from './ui.js';
import { spawnPickup } from './inventory.js';

export const ITEMS = [
  {id:'boots',   name:'Swift boots',     desc:'Walk 40% faster.',                              cost:12, color:0x66d9e8},
  {id:'lens',    name:'Long lens',       desc:'Finder sees 50% farther.',                      cost:10, color:0x8ce99a},
  {id:'grip',    name:'Duelist grip',    desc:'Each tap counts more in duels.',                cost:18, color:0xe0553d},
  {id:'lantern', name:'Brass lantern',   desc:'Carry your own light for the dark.',            cost:8,  color:0xffe066},
  {id:'hat',     name:'Straw hat',       desc:'A wide hat, worn over the hood.',               cost:6,  color:0xd9b86a},
  {id:'cloak',   name:'Violet suit',     desc:'A new color for your ninja suit.',              cost:9,  color:0x9b59b6},
  {id:'charm',   name:'Orbit charm',     desc:'A small ring that circles your sash.',          cost:14, color:0xc9a15a},
  {id:'bell',    name:'Silver bell',     desc:'Wanderers hear you and seek you from farther.', cost:16, color:0xdddddd},
];

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
        spawnPickup('item', u.id); toast(`${u.name} set down beside you`);
      });
      row.appendChild(b);
    }
    box.appendChild(row);
  }
}

pouchEl.addEventListener('click', () => { if (G.state !== 'play') return; G.state = 'shop'; renderShop(); $('shop').classList.remove('hidden'); });
$('shopClose').addEventListener('click', () => { $('shop').classList.add('hidden'); G.state = 'play'; });
