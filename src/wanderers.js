// wanderers.js — the seven villagers who keep camp in the valley.
//
// One camps near each orb. The higher the orb, the faster the duelist, so
// tier 1 near orb 1 is gentle and tier 7 near orb 7 is blistering.
import * as THREE from 'three';
import { scene, lam, G } from './state.js';
import { player } from './player.js';
import { owned } from './save.js';
import { orbs } from './orbs.js';
import { WORLD_R } from './world.js';
import { emit, EVENTS } from './events.js';

// Each villager has a build, a skin tone, headwear and a prop that says what
// they do for a living — so you can tell who is walking toward you from across
// the valley, instead of only finding out from the duel panel.
export const WANDERERS = [
  {name:'Bram the Woodcutter', short:'Bram',        color:0x6b8e23, hat:0x5a3d1e, skin:0xd9a878, build:1.10, headwear:'cap',      prop:'axe'},
  {name:'Nell the Herbalist',  short:'Nell',        color:0x9b59b6, hat:0xf6efdf, skin:0xf1c9a5, build:0.92, headwear:'kerchief', prop:'basket'},
  {name:'Pip the Courier',     short:'Pip',         color:0x3d8fc9, hat:0xe0553d, skin:0xe8bb90, build:0.85, headwear:'cap',      prop:'satchel'},
  {name:'Marla Stonehand',     short:'Marla',       color:0x8a6a3a, hat:0x7f8c8d, skin:0xc98f63, build:1.18, headwear:'none',     prop:'hammer'},
  {name:'Old Tarrow',          short:'Tarrow',      color:0x7f8c8d, hat:0x1b1a17, skin:0xdcb894, build:0.95, headwear:'brim',     prop:'staff', beard:true},
  {name:'Sable the Fencer',    short:'Sable',       color:0x1b1a17, hat:0xc9a15a, skin:0xd9a878, build:1.00, headwear:'none',     prop:'blade'},
  {name:'The Grey Pilgrim',    short:'the Pilgrim', color:0xd9d9d9, hat:0x2b2d5c, skin:0xcfa07a, build:1.05, headwear:'hood',     prop:'staff'},
];

// Geometry is built once here and shared by all seven. Seven villagers there-
// fore cost about as much memory as one; only the materials differ.
const GEO = {
  torso:    new THREE.CylinderGeometry(0.30, 0.38, 0.80, 10),
  head:     new THREE.SphereGeometry(0.28, 14, 12),
  arm:      new THREE.CylinderGeometry(0.075, 0.085, 0.55, 7),
  hand:     new THREE.SphereGeometry(0.085, 7, 6),
  leg:      new THREE.CylinderGeometry(0.095, 0.105, 0.42, 7),
  foot:     new THREE.BoxGeometry(0.16, 0.09, 0.26),
  eye:      new THREE.SphereGeometry(0.035, 6, 6),
  cap:      new THREE.ConeGeometry(0.34, 0.30, 8),
  brim:     new THREE.CylinderGeometry(0.46, 0.46, 0.035, 12),
  crown:    new THREE.ConeGeometry(0.30, 0.34, 10),
  hood:     new THREE.SphereGeometry(0.33, 14, 12, 0, Math.PI*2, 0, Math.PI*0.6),
  kerchief: new THREE.SphereGeometry(0.30, 12, 10, 0, Math.PI*2, 0, Math.PI*0.45),
  handle:   new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6),
  staff:    new THREE.CylinderGeometry(0.04, 0.045, 1.7, 6),
  axeHead:  new THREE.BoxGeometry(0.07, 0.26, 0.30),
  hammer:   new THREE.BoxGeometry(0.20, 0.20, 0.30),
  blade:    new THREE.BoxGeometry(0.045, 0.95, 0.10),
  bag:      new THREE.BoxGeometry(0.30, 0.26, 0.16),
  basket:   new THREE.CylinderGeometry(0.19, 0.15, 0.22, 9),
  beard:    new THREE.ConeGeometry(0.17, 0.34, 8),
};

const EYE = lam(0x1b1a17), WOOD = lam(0x6b4a2a), STEEL = lam(0x9aa3ab),
      GOLD = lam(0xc9a15a), STRAW = lam(0xcfa955), BOOT = lam(0x4a4038),
      WHISKERS = lam(0xe8e8e8), LEATHER = lam(0x8a6a3a), STRAPMAT = lam(0x5a3d1e),
      LEAFMAT = lam(0x3d8f45);

function buildWanderer(w){
  const g = new THREE.Group();
  const cloth = lam(w.color), skin = lam(w.skin), hatMat = lam(w.hat);
  const s = w.build;

  // torso and head
  const body = new THREE.Mesh(GEO.torso, cloth); body.position.y = 0.86*s; body.scale.setScalar(s);
  const head = new THREE.Mesh(GEO.head, skin);   head.position.y = 1.48*s;
  g.add(body, head);

  // a face, so they read as people and you can see which way they are facing
  [-1, 1].forEach(side => {
    const e = new THREE.Mesh(GEO.eye, EYE);
    e.position.set(side*0.10*s, 1.52*s, 0.245*s);
    g.add(e);
  });
  if (w.beard){
    const b = new THREE.Mesh(GEO.beard, WHISKERS);
    b.position.set(0, 1.30*s, 0.16*s); b.rotation.x = Math.PI;
    g.add(b);
  }

  // arms and legs. Each limb is a Group placed at the shoulder or hip so it
  // swings from the joint; the frame loop rotates these while they walk.
  const limbs = {arms:[], legs:[]};
  [-1, 1].forEach(side => {
    const arm = new THREE.Group(); arm.position.set(side*0.38*s, 1.16*s, 0);
    const upper = new THREE.Mesh(GEO.arm, cloth); upper.position.y = -0.27;
    const hand  = new THREE.Mesh(GEO.hand, skin); hand.position.y = -0.56;
    arm.add(upper, hand); g.add(arm); limbs.arms.push(arm);

    const leg = new THREE.Group(); leg.position.set(side*0.15*s, 0.46*s, 0);
    const thigh = new THREE.Mesh(GEO.leg, BOOT); thigh.position.y = -0.21;
    const foot  = new THREE.Mesh(GEO.foot, WOOD); foot.position.set(0, -0.42, 0.05);
    leg.add(thigh, foot); g.add(leg); limbs.legs.push(leg);
  });

  // headwear
  if (w.headwear === 'cap'){
    const c = new THREE.Mesh(GEO.cap, hatMat); c.position.y = 1.72*s; g.add(c);
  } else if (w.headwear === 'brim'){
    const br = new THREE.Mesh(GEO.brim, hatMat);  br.position.y = 1.66*s;
    const cr = new THREE.Mesh(GEO.crown, hatMat); cr.position.y = 1.82*s;
    g.add(br, cr);
  } else if (w.headwear === 'hood'){
    const h = new THREE.Mesh(GEO.hood, hatMat); h.position.y = 1.50*s; g.add(h);
  } else if (w.headwear === 'kerchief'){
    const k = new THREE.Mesh(GEO.kerchief, hatMat); k.position.y = 1.50*s; g.add(k);
  }

  // the prop — the thing that actually tells you who this is at a distance
  const hx = 0.38*s, hy = 0.72*s, hz = 0.12;
  if (w.prop === 'axe'){
    const shaft = new THREE.Mesh(GEO.handle, WOOD); shaft.position.set(hx, hy, hz); shaft.rotation.z = 0.25;
    const blade = new THREE.Mesh(GEO.axeHead, STEEL); blade.position.set(hx + 0.16, hy + 0.42, hz);
    g.add(shaft, blade);
  } else if (w.prop === 'hammer'){
    const shaft = new THREE.Mesh(GEO.handle, WOOD); shaft.position.set(hx, hy, hz); shaft.rotation.z = 0.2;
    const head2 = new THREE.Mesh(GEO.hammer, STEEL); head2.position.set(hx + 0.13, hy + 0.44, hz);
    g.add(shaft, head2);
  } else if (w.prop === 'blade'){
    const b = new THREE.Mesh(GEO.blade, STEEL); b.position.set(hx, hy + 0.35, hz); b.rotation.z = 0.12;
    const guard = new THREE.Mesh(GEO.hand, GOLD); guard.position.set(hx, hy - 0.10, hz);
    g.add(b, guard);
  } else if (w.prop === 'staff'){
    const st = new THREE.Mesh(GEO.staff, WOOD); st.position.set(hx, hy + 0.36, hz); st.rotation.z = 0.06;
    g.add(st);
  } else if (w.prop === 'satchel'){
    const bag = new THREE.Mesh(GEO.bag, LEATHER); bag.position.set(-0.34*s, 0.80*s, 0.10); bag.rotation.z = -0.15;
    const strap = new THREE.Mesh(GEO.handle, STRAPMAT); strap.position.set(-0.10*s, 1.15*s, 0.05); strap.rotation.z = Math.PI/2.6;
    g.add(bag, strap);
  } else if (w.prop === 'basket'){
    const bk = new THREE.Mesh(GEO.basket, STRAW); bk.position.set(hx, hy, 0.10);
    const leaf = new THREE.Mesh(GEO.hand, LEAFMAT); leaf.position.set(hx, hy + 0.14, 0.10); leaf.scale.set(1.6, 0.7, 1.6);
    g.add(bk, leaf);
  }

  scene.add(g);
  return {g, limbs};
}

export const wanderers = WANDERERS.map((w, i) => {
  const {g, limbs} = buildWanderer(w);
  return {...w, g, limbs, tier:i+1, hx:0, hz:0, tx:0, tz:0, wait:0, cooldown:0, bob:Math.random()*6};
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

// Swings arms and legs while walking, and settles them when standing still.
function animateLimbs(w, moving){
  const swing = moving ? Math.sin(w.bob) : 0;
  w.limbs.arms[0].rotation.x =  swing*0.55;
  w.limbs.arms[1].rotation.x = -swing*0.55;
  w.limbs.legs[0].rotation.x = -swing*0.5;
  w.limbs.legs[1].rotation.x =  swing*0.5;
}

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
      animateLimbs(w, true);
    } else { w.wait -= dt; if (w.wait <= 0) pickTarget(w); animateLimbs(w, false); }
    if (G.state === 'play' && hunting && pd < 2.2) emit(EVENTS.DUEL_CHALLENGE, w);
  }
}
