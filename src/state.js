// state.js — the things every other file needs.
//
// In the original single file, everything lived inside one big function, so
// every part could see every other part's variables. Modules don't work that
// way: each file is its own scope. So the shared pieces live here and get
// imported by name.
//
// Rule of thumb used throughout this project:
//   - Objects and arrays (scene, player, save, orbs) are exported as `const`
//     and MUTATED in place. Importing files see the same object.
//   - Plain numbers/strings/booleans that get REASSIGNED across files can't be
//     exported that way (you'd only ever see the starting value), so they live
//     on the G object below and are written as G.state, G.t, and so on.
import * as THREE from 'three';
import { randomSeed } from './rng.js';
import { CONFIG } from './config.js';

// ---------- three.js r185 compatibility ----------
// The original loaded three r128 from a CDN. Three things changed since; see
// UPGRADE-NOTES.md for the full story and how to undo each one.
//
// 1. Colour management (r152) is now ON by default, and we keep it on. It reads
//    each hex colour as sRGB, converts to linear for the lighting maths, then
//    converts back on output -- so the colours you wrote still look like
//    themselves. Turning it off makes the whole game markedly darker.

export const $ = id => document.getElementById(id);
export const hex = c => '#'+c.toString(16).padStart(6,'0');

// The shared mutable state. `state` is the game mode the original tracked:
// start | play | duel | shop | satchel | ending | wish
export const G = {
  state: 'start',
  t: 0,            // seconds since load, used by every animation
  camYaw: 0,       // camera angle around the player, written by input.js
  camPitch: 0,     // camera elevation; set from config on first frame
  camDist: CONFIG.camera.distance,  // live zoom; pinch and the wheel move it
  crawling: false, // quieter and slower
  whistleT: 0,     // seconds of noise still carrying
  whistleCd: 0,    // seconds until you can whistle again

  // The number the whole valley is generated from. Change it and the forest,
  // the highland, the wetland and every tree move somewhere else. A new one is
  // rolled each time the orbs scatter.
  // ?seed=123 pins the valley so a change can be judged against the SAME
  // landscape. Without it every reload re-rolls the world and two screenshots
  // are never comparable -- which makes tuning how anything looks guesswork.
  worldSeed: Number(new URLSearchParams(location.search).get('seed')) || randomSeed(),
  found: 0,        // orbs collected this cycle
  orderKept: true, // still collecting 1..7 in order?
  night: 0,        // 0 = day, 1 = night; eased every frame
  nightTarget: 0,
  ceremony: false, // is the Keeper present?
  endT: 0,         // seconds into the ending sequence
  departT: -1,     // >= 0 while the Keeper is flying away
  respawnT: -1,    // counts down to the orbs scattering again
};

// ---------- renderer / scene ----------
export const canvas = $('c');
export const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

// There was no tone mapping at all: linear light values went straight to the
// screen, so anything over 1.0 clipped to flat white and everything else was
// squeezed into a narrow band. ACES filmic rolls the highlights off the way
// film does and puts contrast back into the midtones. Exposure compensates for
// the curve darkening those midtones.
//
// This is applied by OutputPass when the bloom composer is running, and by the
// renderer directly when it is not -- both read these two properties.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.render.exposure;

export const scene = new THREE.Scene();
export const DAY = new THREE.Color(0x8fc7ff), NIGHT = new THREE.Color(0x0a0f2a);
scene.background = DAY.clone();
// Fog used to close in at 130 m, which meant the valley was always ringed by
// haze and felt boxed in. Pushed out so the horizon is visible through it.
scene.fog = new THREE.Fog(DAY.clone(), CONFIG.fog.near, CONFIG.fog.far);
// near = 0.5 rather than 0.1. Depth precision depends on the far/near ratio, and
// 400/0.1 = 4000:1 leaves very little precision out at 50-150 m, which is where
// the ground flicker showed. The camera never gets closer than ~6 m to anything
// it needs to draw, so raising near costs nothing and buys a 5x better ratio.
// far plane must clear the furthest hill or the horizon gets sliced off
export const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.5, 2600);
// Sky fill and bounce. The ground colour was a dark green, which meant any
// slope facing away from the sun fell to nearly black -- fine on a flat disc
// with no hills, badly wrong once the valley had them. A lighter bounce colour
// keeps backlit faces readable.
export const hemi = new THREE.HemisphereLight(0xe6f2ff, 0x6f8a5e, 0.85);

// Warm and low, so shadows are long and the light has a direction you can feel.
export const sun = new THREE.DirectionalLight(0xfff0d0, 1.05);
sun.position.set(60, 85, 40);

// A little flat fill so nothing in shadow is ever pure black. Shadows should
// read as darker, not as holes.
export const ambient = new THREE.AmbientLight(0xbdd4e8, 0.22);

scene.add(hemi, sun, ambient);

// Standard, not Lambert. Lambert only knows about the lights you place, so every
// surface facing the same way came out the same flat colour -- the "matte
// plastic" look. Standard is also lit by scene.environment, the blurred image of
// the sky built in sky.js, so a face turned up catches sky and a face turned
// down catches ground bounce. That variation is most of what reads as "real".
//
// It costs more per pixel than Lambert. That is the trade being made here.
export const mat = (c, e=0) => new THREE.MeshStandardMaterial(
  e ? {color:c, emissive:c, emissiveIntensity:e, roughness:CONFIG.render.roughness, metalness:0}
    : {color:c, roughness:CONFIG.render.roughness, metalness:0});
export const glow = (c, op=1) => new THREE.MeshBasicMaterial({color:c, transparent:op<1, opacity:op});

// 2. Point lights: r128 defaulted to decay = 1 with a simple falloff that
//    reached zero at the light's distance. r155+ defaults to decay = 2 with a
//    physically-correct inverse-square falloff, which makes every glow in the
//    game dimmer and tighter. decay = 0 restores the bounded, soft falloff the
//    original had. Every point light in the game is made through here, so this
//    is the one place to change it.
export function pointLight(color, intensity, distance){
  const l = new THREE.PointLight(color, intensity, distance);
  l.decay = 0;
  return l;
}

// Which way the camera is facing, on the ground plane.
export function forward(){ return {x:-Math.sin(G.camYaw), z:-Math.cos(G.camYaw)}; }
