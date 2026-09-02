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
  camYaw: 0,       // camera angle, written by input.js
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

export const scene = new THREE.Scene();
export const DAY = new THREE.Color(0x8fc7ff), NIGHT = new THREE.Color(0x0a0f2a);
scene.background = DAY.clone();
scene.fog = new THREE.Fog(DAY.clone(), 45, 130);
export const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 400);
export const hemi = new THREE.HemisphereLight(0xdfefff, 0x3f6f33, 0.95);
export const sun  = new THREE.DirectionalLight(0xfff1d6, 0.9); sun.position.set(30, 60, 20);
scene.add(hemi, sun);

export const lam = (c, e=0) => new THREE.MeshLambertMaterial(e ? {color:c, emissive:c, emissiveIntensity:e} : {color:c});
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
