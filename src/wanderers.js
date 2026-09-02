// wanderers.js — the seven duelists and their camps.
//
// One keeps camp near each orb. The higher the orb, the faster the duelist,
// so tier 1 near orb 1 is gentle and tier 7 near orb 7 is blistering.
import * as THREE from 'three';
import { scene, lam, G } from './state.js';
import { player, torso } from './player.js';
import { owned } from './save.js';
import { orbs } from './orbs.js';
import { WORLD_R } from './world.js';
import { startDuel } from './duel.js';

export const WANDERERS = [
  {name:'Bram the Woodcutter', short:'Bram',    color:0x6b8e23, hat:0x5a3d1e},
  {name:'Nell the Herbalist',  short:'Nell',    color:0x9b59b6, hat:0xf6efdf},
  {name:'Pip the Courier',     short:'Pip',     color:0x3d8fc9, hat:0xe0553d},
  {name:'Marla Stonehand',     short:'Marla',   color:0x8a6a3a, hat:0x7f8c8d},
  {name:'Old Tarrow',          short:'Tarrow',  color:0x7f8c8d, hat:0x1b1a17},
  {name:'Sable the Fencer',    short:'Sable',   color:0x1b1a17, hat:0xc9a15a},
  {name:'The Grey Pilgrim',    short:'the Pilgrim', color:0xd9d9d9, hat:0x2b2d5c},
];

const hatGeo = new THREE.ConeGeometry(0.42, 0.55, 8);
export const wanderers = WANDERERS.map((w, i) => {
  const g = new THREE.Group();
  const b = new THREE.Mesh(torso.geometry, lam(w.color)); b.position.y = 0.55;
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), lam(0xf1c9a5)); h.position.y = 1.32;
  const hat = new THREE.Mesh(hatGeo, lam(w.hat)); hat.position.y = 1.78;
  g.add(b, h, hat); scene.add(g);
  return {...w, g, tier:i+1, hx:0, hz:0, tx:0, tz:0, wait:0, cooldown:0, bob:Math.random()*6};
});

// opponent bar fill per second, by tier. Tier 1 ≈ 4 taps/s to beat, tier 7 ≈ 12 taps/s.
export const tierRate = n => 0.16 + n*0.065;

export function homeWanderers(){
  wanderers.forEach((w, i) => {
    w.hx = orbs[i].x; w.hz = orbs[i].z;
    const a = Math.random()*Math.PI*2, r = 8 + Math.random()*10;
    w.g.position.set(w.hx + Math.cos(a)*r, 0, w.hz + Math.sin(a)*r); pickTarget(w);
  });
}

export function pickTarget(w){
  // roam within about 22 m of camp
  const a = Math.random()*Math.PI*2, r = Math.random()*22;
  w.tx = Math.max(-WORLD_R+5, Math.min(WORLD_R-5, w.hx + Math.cos(a)*r));
  w.tz = Math.max(-WORLD_R+5, Math.min(WORLD_R-5, w.hz + Math.sin(a)*r));
  w.wait = 1 + Math.random()*3;
}
homeWanderers();

export function updateWanderers(dt){
  const hear = owned('bell') ? 24 : 14;
  for (const w of wanderers){
    w.cooldown = Math.max(0, w.cooldown - dt);
    const pdx = player.position.x - w.g.position.x, pdz = player.position.z - w.g.position.z, pd = Math.hypot(pdx, pdz);
    const hunting = pd < hear && w.cooldown === 0 && !G.ceremony;
    if (hunting){ w.tx = player.position.x; w.tz = player.position.z; w.wait = 0; }
    const dx = w.tx - w.g.position.x, dz = w.tz - w.g.position.z, d = Math.hypot(dx, dz);
    if (d > 0.5){
      const sp = hunting ? 3.2 : 2.2;
      w.g.position.x += dx/d*sp*dt; w.g.position.z += dz/d*sp*dt; w.g.rotation.y = Math.atan2(dx, dz);
      w.bob += dt*9; w.g.position.y = Math.abs(Math.sin(w.bob))*0.1;
    } else { w.wait -= dt; if (w.wait <= 0) pickTarget(w); }
    if (G.state === 'play' && hunting && pd < 2.2) startDuel(w);
  }
}
