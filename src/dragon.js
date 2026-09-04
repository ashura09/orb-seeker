// dragon.js — the Keeper's body: how it is built, and how it moves.
//
// Separated from the ceremony it appears for. This file knows about wings, necks
// and sparks; keeper.js knows about wishes. The shared handles live here because
// this is what creates them.
import * as THREE from 'three';
import * as P from './palette.js';
import { mat, glow, pointLight, G } from './state.js';

export const keeper = new THREE.Group();
export const ka = {
  wings: [],
  tail: [],
  neck: [],
  eyes: [],
  sparks: null,
  ring: null,
  built: false,
};
export const ringOrbs = [];

export function buildKeeper() {
  if (ka.built) return;
  ka.built = true;
  const scale = mat(P.DRAGON_SCALE, 0.25),
    belly = mat(P.DRAGON_BELLY, 0.3),
    gold = mat(P.BRASS, 0.6),
    dark = mat(P.DRAGON_DARK);
  // stout body
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), scale);
  body.scale.set(2.3, 1.9, 3.0);
  body.position.set(0, 6, -1);
  keeper.add(body);
  const bellyM = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), belly);
  bellyM.scale.set(1.7, 1.3, 2.6);
  bellyM.position.set(0, 5.4, -0.6);
  keeper.add(bellyM);
  // dorsal fins
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9 - i * 0.1, 4), gold);
    f.position.set(0, 7.9 - i * 0.15, 0.6 - i * 0.9);
    f.rotation.x = -0.4;
    keeper.add(f);
  }
  // neck: five segments curving up and forward to the head
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.0 - i * 0.11, 14, 10), scale);
    s.position.set(0, 6.8 + i * 0.85, 1.6 + i * 0.75);
    keeper.add(s);
    ka.neck.push(s);
  }
  // head
  const head = new THREE.Group();
  head.position.set(0, 10.6, 5.2);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), scale);
  skull.scale.set(1, 0.85, 1.25);
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.3), scale);
  snout.position.set(0, -0.15, 1.2);
  head.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.28, 1.1), belly);
  jaw.position.set(0, -0.55, 1.05);
  jaw.rotation.x = 0.18;
  head.add(jaw);
  const nostrils = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.2), dark);
  nostrils.position.set(0, 0.05, 1.85);
  head.add(nostrils);
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), glow(P.MINT));
    eye.position.set(s * 0.5, 0.2, 0.75);
    head.add(eye);
    ka.eyes.push(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.3), dark);
    brow.position.set(s * 0.5, 0.45, 0.7);
    brow.rotation.z = -s * 0.3;
    head.add(brow);
    // branching horns, swept back
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 1.8, 6), gold);
    horn.position.set(s * 0.55, 0.9, -0.6);
    horn.rotation.set(-0.9, 0, -s * 0.35);
    head.add(horn);
    const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.9, 6), gold);
    tine.position.set(s * 0.9, 1.4, -0.9);
    tine.rotation.set(-0.5, 0, -s * 0.9);
    head.add(tine);
    // whisker-free cheek frills
    const frill = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 4), scale);
    frill.position.set(s * 0.95, -0.1, -0.2);
    frill.rotation.set(0, 0, (s * Math.PI) / 2 + s * 0.4);
    head.add(frill);
  });
  keeper.add(head);
  ka.head = head;
  // wings: two pairs, membrane from a shape, bones as cylinders
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(3.2, 2.4);
  wingShape.lineTo(6.4, 2.0);
  wingShape.lineTo(5.6, 0.2);
  wingShape.lineTo(6.2, -2.0);
  wingShape.lineTo(3.4, -1.4);
  wingShape.lineTo(0, -1.2);
  wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wingMat = new THREE.MeshStandardMaterial({
    color: P.DRAGON_WING,
    emissive: P.DRAGON_WING,
    emissiveIntensity: 0.3,
    roughness: 0.6,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  [
    [-1, 0, 6.9, -0.4],
    [1, 0, 6.9, -0.4],
    [-1, 0.7, 6.4, -2.6],
    [1, 0.7, 6.4, -2.6],
  ].forEach(([s, sc, y, z], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 1.6, y, z);
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.scale.set(s * (1 - sc * 0.35), 1 - sc * 0.3, 1);
    wing.rotation.x = -Math.PI / 2;
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 6.4, 6), gold);
    bone.rotation.set(0, s * 0.3, Math.PI / 2);
    bone.position.set(s * 3.0, 0.03, 1.1);
    pivot.add(wing, bone);
    keeper.add(pivot);
    ka.wings.push({ pivot, s, phase: i < 2 ? 0 : 0.6 });
  });
  // legs, dangling
  [
    [-1.3, 1.2],
    [1.3, 1.2],
    [-1.4, -2.4],
    [1.4, -2.4],
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.6, 8), scale);
    leg.position.set(x, 4.4, z);
    leg.rotation.x = 0.35;
    keeper.add(leg);
    for (let k = -1; k <= 1; k++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), gold);
      claw.position.set(x + k * 0.2, 3.5, z + 0.5);
      claw.rotation.x = Math.PI * 0.75;
      keeper.add(claw);
    }
  });
  // tail: eight segments trailing behind
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.75 - i * 0.08, 12, 8),
      i % 2 ? belly : scale,
    );
    keeper.add(s);
    ka.tail.push(s);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 4), gold);
  keeper.add(tip);
  ka.tailTip = tip;
  // rune ring on the ground, sparks, light
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.08, 6, 80), glow(P.MINT, 0.6));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  keeper.add(ring);
  ka.ring = ring;
  const N = 180,
    pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2,
      r = 2 + Math.random() * 5;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 13;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  ka.sparks = new THREE.Points(
    sg,
    new THREE.PointsMaterial({
      color: P.DRAGON_SPARK,
      size: 0.16,
      transparent: true,
      opacity: 0.9,
    }),
  );
  keeper.add(ka.sparks);
  const kl = pointLight(P.DRAGON_LIGHT, 3.5, 50);
  kl.position.y = 8;
  keeper.add(kl);
  const mouthLight = pointLight(P.MINT, 1.5, 12);
  mouthLight.position.set(0, 10, 7);
  keeper.add(mouthLight);
}

export function animateKeeper(dt) {
  const t = G.t;
  keeper.position.y = Math.sin(t * 1.1) * 0.35 + 0.4;
  ka.wings.forEach((w) => {
    w.pivot.rotation.z = w.s * (0.25 + Math.sin(t * 2.2 + w.phase) * 0.45);
  });
  ka.head.position.y = 10.6 + Math.sin(t * 1.6) * 0.15;
  ka.head.rotation.x = Math.sin(t * 0.9) * 0.08;
  ka.neck.forEach((s, i) => {
    s.position.x = (Math.sin(t * 1.6 + i * 0.5) * 0.15 * i) / 4;
  });
  ka.tail.forEach((s, i) => {
    const k = i + 1;
    s.position.set(
      Math.sin(t * 1.5 - k * 0.5) * 0.35 * k * 0.5,
      6 - k * 0.45 + Math.sin(t * 1.2 - k * 0.4) * 0.2,
      -3.6 - k * 0.75,
    );
  });
  const last = ka.tail[7];
  ka.tailTip.position.set(last.position.x, last.position.y, last.position.z - 0.8);
  ka.tailTip.rotation.x = -Math.PI / 2;
  const blink = 0.7 + 0.3 * Math.sin(t * 4);
  ka.eyes.forEach((e) => (e.material.opacity = blink));
  ka.eyes.forEach((e) => (e.material.transparent = true));
  ka.ring.rotation.z += dt * 0.4;
  ka.ring.scale.setScalar(1 + Math.sin(t * 2) * 0.03);
  const p = ka.sparks.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i) + dt * 1.6;
    if (y > 13) y = 0;
    p.setY(i, y);
  }
  p.needsUpdate = true;
}
