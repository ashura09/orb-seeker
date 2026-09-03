// map.js — the map of the valley.
//
// The radar reaches 55 metres, which is enough to hunt an orb and not enough to
// know where you are. Now that the valley has real regions, a plateau, a lake
// and a landmark in each place, there is finally something worth mapping.
//
// WHAT IT DELIBERATELY DOES NOT SHOW
//
// Orbs you have not found. The whole game is looking for them, and a map that
// marks them is a map that ends the game. It shows GEOGRAPHY -- where the
// forest is, where the water is, what you have already walked -- and leaves the
// answers to the finder.
//
// WHAT IT COSTS
//
// The terrain image is expensive: every pixel needs three height lookups for
// relief shading. So it is built ONCE, lazily, the first time you open the map,
// and kept until the valley is rebuilt. Opening it after that is just a few
// drawImage calls. `worldVersion` is how it knows the cached picture is of a
// landscape that no longer exists.
import { $, G, hex } from './state.js';
import { CONFIG } from './config.js';
import { WORLD_R, regionAt, heightAt, isInWater, places, worldVersion } from './world.js';
import { player } from './player.js';
import { orbs } from './orbs.js';

const M = CONFIG.map;
const SPAN = WORLD_R * 2; // metres across the drawn square

// ---------- what you have seen ----------
//
// A coarse grid of flags rather than anything clever. Walking marks every cell
// within seeRadius; the map dims the rest. It is not saved, because the valley
// is re-rolled each gathering and a record of a landscape that no longer exists
// would be worse than none.
const grid = new Uint8Array(M.grid * M.grid);
const cellOf = (v) => Math.floor(((v + WORLD_R) / SPAN) * M.grid);
let sinceMark = 0;

export function markExplored(dt) {
  // Four times a second is plenty: you cannot outrun a 38 m circle.
  sinceMark += dt;
  if (sinceMark < 0.25) return;
  sinceMark = 0;

  const cx = cellOf(player.position.x),
    cz = cellOf(player.position.z);
  const rad = Math.ceil((M.seeRadius / SPAN) * M.grid);
  for (let j = cz - rad; j <= cz + rad; j++) {
    if (j < 0 || j >= M.grid) continue;
    for (let i = cx - rad; i <= cx + rad; i++) {
      if (i < 0 || i >= M.grid) continue;
      const dx = i - cx,
        dz = j - cz;
      if (dx * dx + dz * dz <= rad * rad) grid[j * M.grid + i] = 1;
    }
  }
}

export function forgetExplored() {
  grid.fill(0);
}

// ---------- the terrain picture ----------
let base = null,
  baseVersion = -1;

function buildBase() {
  const S = M.resolution;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const water = [0x3f, 0x8f, 0xbf];

  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = (px / (S - 1)) * SPAN - WORLD_R;
      const z = (py / (S - 1)) * SPAN - WORLD_R;
      const i = (py * S + px) * 4;

      if (Math.hypot(x, z) > WORLD_R) {
        // beyond where you can walk
        img.data[i] = 24;
        img.data[i + 1] = 30;
        img.data[i + 2] = 26;
        img.data[i + 3] = 255;
        continue;
      }

      let r, g, b;
      if (isInWater(x, z)) {
        [r, g, b] = water;
      } else {
        // Blend between the two nearest regions exactly as the ground itself
        // does. Taking only the nearest draws hard polygon edges, which look
        // like a diagram of the generator rather than like a place.
        const { region, neighbour, blend } = regionAt(x, z);
        const c1 = region.ground[0],
          c2 = neighbour.ground[0];
        r = ((c1 >> 16) & 255) * (1 - blend) + ((c2 >> 16) & 255) * blend;
        g = ((c1 >> 8) & 255) * (1 - blend) + ((c2 >> 8) & 255) * blend;
        b = (c1 & 255) * (1 - blend) + (c2 & 255) * blend;
      }

      // Relief shading: light from the north-west, exactly the convention every
      // paper map uses, because it is the one the eye reads as raised rather
      // than sunken. Slopes facing the light are lifted, slopes away darkened.
      const e = SPAN / S;
      const dh =
        heightAt(x + e, z) - heightAt(x - e, z) + (heightAt(x, z + e) - heightAt(x, z - e));
      const shade = Math.max(0.55, Math.min(1.45, 1 + dh * 0.16));
      img.data[i] = Math.min(255, r * shade);
      img.data[i + 1] = Math.min(255, g * shade);
      img.data[i + 2] = Math.min(255, b * shade);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  base = cv;
  baseVersion = worldVersion;
}

// ---------- drawing ----------
const canvas = $('mapc');
const ctx = canvas.getContext('2d');

// The fog is drawn at grid resolution into a tiny canvas and then scaled up
// with smoothing on, which turns 96 hard squares into soft edges for free.
const fogCv = document.createElement('canvas');
fogCv.width = fogCv.height = M.grid;
const fogCtx = fogCv.getContext('2d');

function draw() {
  if (!base || baseVersion !== worldVersion) buildBase();

  const S = canvas.width;
  ctx.clearRect(0, 0, S, S);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(base, 0, 0, S, S);

  // dim everywhere you have not been
  const fog = fogCtx.createImageData(M.grid, M.grid);
  for (let k = 0; k < grid.length; k++) {
    // Nearly opaque, not merely dim: at 205 the region shapes still showed
    // through, which handed you the layout of ground you had never walked.
    fog.data[k * 4 + 3] = grid[k] ? 0 : 238;
  }
  fogCtx.putImageData(fog, 0, 0);
  ctx.drawImage(fogCv, 0, 0, S, S);

  const toPx = (x, z) => [((x + WORLD_R) / SPAN) * S, ((z + WORLD_R) / SPAN) * S];
  const seen = (x, z) => {
    const i = cellOf(x),
      j = cellOf(z);
    return i >= 0 && j >= 0 && i < M.grid && j < M.grid && grid[j * M.grid + i];
  };

  // named places, once you have been near them
  ctx.font = 'bold 13px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  for (const p of places) {
    if (!seen(p.x, p.z)) continue;
    const [ax, ay] = toPx(p.x, p.z);
    ctx.fillStyle = 'rgba(27,26,23,0.75)';
    ctx.beginPath();
    ctx.arc(ax, ay, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6efdf';
    ctx.fillText(p.name, ax, ay - 10);
  }

  // orbs you have ALREADY found -- a record of where you have been, never a hint
  for (const o of orbs) {
    if (!o.found) continue;
    const [ax, ay] = toPx(o.x, o.z);
    ctx.fillStyle = hex(o.color);
    ctx.beginPath();
    ctx.arc(ax, ay, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1a17';
    ctx.fillText(o.n, ax, ay + 4);
  }

  // you, pointing the way you are facing
  const [mx, my] = toPx(player.position.x, player.position.z);
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(-G.camYaw);
  ctx.fillStyle = '#8ff5c8';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- opening and closing ----------
const panel = $('map');

export function openMap() {
  if (G.state !== 'play') return;
  G.state = 'map';
  panel.classList.remove('hidden');
  // A frame's delay so the panel is laid out before the first draw, and so the
  // browser can paint it before the base image is built on a first open.
  requestAnimationFrame(() => requestAnimationFrame(draw));
}

export function closeMap() {
  panel.classList.add('hidden');
  if (G.state === 'map') G.state = 'play';
}

// Tapping the radar opens the map. It is the natural place to reach for -- the
// small version of the same idea -- and it costs no screen space, which the
// crawl and whistle buttons taught us to care about.
$('finder').addEventListener('click', openMap);
$('mapClose').addEventListener('click', closeMap);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key.toLowerCase() === 'm') G.state === 'map' ? closeMap() : openMap();
});
