// main.js — the entry point. Vite starts here, and this file will eventually
// import from world.js / player.js / input.js / etc.
//
// For now it only proves one thing: that `three` loads from node_modules
// instead of a CDN <script> tag. That is the whole point of step 4.
import * as THREE from 'three';

console.log('three revision:', THREE.REVISION);

const el = document.getElementById('three-check');
if (el) {
  el.textContent = `three r${THREE.REVISION} loaded from npm (was r128 on the CDN).`;
}
