// finder.js — the radar in the top-right corner.
//
// Orbs show as dots: unknown ones are cream and unnumbered, and only reveal
// their colour and number once you are within REVEAL metres. Wanderers show as
// diamonds, pickups as small squares.
import { $, hex } from './state.js';
import { player } from './player.js';
import { worn } from './loadout.js';
import { orbs } from './orbs.js';
import { wanderers } from './wanderers.js';
import { pickups } from './inventory.js';
import { CONFIG } from './config.js';

const rc = $('rc').getContext('2d');
const distEl = $('dist');
let sweep = 0;

export function drawFinder(dt, fx, fz, rx, rz) {
  const F = CONFIG.finder;
  const RANGE = worn('lens') ? F.rangeWithLens : F.range,
    REVEAL = F.revealDistance;
  sweep += dt * F.sweepSpeed;
  const S = 256,
    C = S / 2,
    RR = C - 10;
  rc.clearRect(0, 0, S, S);
  rc.strokeStyle = 'rgba(143,245,200,0.25)';
  rc.lineWidth = 2;
  [0.33, 0.66, 1].forEach((f) => {
    rc.beginPath();
    rc.arc(C, C, RR * f, 0, Math.PI * 2);
    rc.stroke();
  });
  rc.beginPath();
  rc.moveTo(C, C - RR);
  rc.lineTo(C, C + RR);
  rc.moveTo(C - RR, C);
  rc.lineTo(C + RR, C);
  rc.stroke();
  rc.save();
  rc.translate(C, C);
  rc.rotate(sweep);
  const grad = rc.createLinearGradient(0, 0, RR, 0);
  grad.addColorStop(0, 'rgba(143,245,200,0.35)');
  grad.addColorStop(1, 'rgba(143,245,200,0)');
  rc.fillStyle = grad;
  rc.beginPath();
  rc.moveTo(0, 0);
  rc.arc(0, 0, RR, -0.9, 0);
  rc.closePath();
  rc.fill();
  rc.restore();
  const proj = (wx, wz) => {
    const dx = wx - player.position.x,
      dz = wz - player.position.z;
    return [
      ((dx * rx + dz * rz) / RANGE) * RR,
      (-(dx * fx + dz * fz) / RANGE) * RR,
      Math.hypot(dx, dz),
    ];
  };
  let nearest = Infinity;
  for (const o of orbs) {
    if (o.found) continue;
    let [bx, by, d] = proj(o.x, o.z);
    nearest = Math.min(nearest, d);
    const bl = Math.hypot(bx, by),
      inRange = bl <= RR,
      known = d <= REVEAL;
    if (!inRange) {
      bx *= (RR - 6) / bl;
      by *= (RR - 6) / bl;
    }
    rc.fillStyle = known ? hex(o.color) : '#f6efdf';
    rc.globalAlpha = inRange ? 0.75 + 0.25 * Math.sin(performance.now() / 250 + o.phase) : 0.4;
    rc.beginPath();
    rc.arc(C + bx, C + by, known ? 10 : inRange ? 7 : 5, 0, Math.PI * 2);
    rc.fill();
    if (known) {
      rc.fillStyle = '#1b1a17';
      rc.font = 'bold 13px Trebuchet MS, sans-serif';
      rc.textAlign = 'center';
      rc.textBaseline = 'middle';
      rc.fillText(o.n, C + bx, C + by + 1);
    }
    rc.globalAlpha = 1;
  }
  rc.strokeStyle = '#f6efdf';
  rc.lineWidth = 2.5;
  for (const w of wanderers) {
    const [bx, by, wd] = proj(w.g.position.x, w.g.position.z);
    if (Math.hypot(bx, by) > RR - 8) continue;
    rc.globalAlpha = w.cooldown > 0 ? 0.35 : 0.9;
    rc.strokeStyle = '#f6efdf';
    rc.beginPath();
    rc.moveTo(C + bx, C + by - 8);
    rc.lineTo(C + bx + 8, C + by);
    rc.lineTo(C + bx, C + by + 8);
    rc.lineTo(C + bx - 8, C + by);
    rc.closePath();
    rc.stroke();
    if (wd <= REVEAL) {
      rc.fillStyle = '#f6efdf';
      rc.font = 'bold 10px Trebuchet MS, sans-serif';
      rc.textAlign = 'center';
      rc.textBaseline = 'middle';
      rc.fillText(w.tier, C + bx, C + by + 1);
    }
    rc.globalAlpha = 1;
  }
  // pickups: small squares
  rc.fillStyle = '#ffe9b0';
  for (const p of pickups) {
    const [bx, by] = proj(p.g.position.x, p.g.position.z);
    if (Math.hypot(bx, by) > RR - 8) continue;
    rc.fillRect(C + bx - 4, C + by - 4, 8, 8);
  }
  rc.fillStyle = '#f6efdf';
  rc.beginPath();
  rc.moveTo(C, C - 9);
  rc.lineTo(C + 7, C + 7);
  rc.lineTo(C - 7, C + 7);
  rc.closePath();
  rc.fill();
  distEl.textContent = nearest === Infinity ? '' : `Nearest orb: ${Math.round(nearest)} m`;
}
