# Orb Seeker: the road from one file to a real game

This is a step-by-step plan written for someone new to coding. Each phase ends with something you can see working, and each step says how to know it worked. Do them in order. Phases 5 and 6 are optional and can wait months.

Rough time, if you do a little each evening:

| Phase | What you get | Time |
|---|---|---|
| 0 | Your computer set up as a dev machine | 1 evening |
| 1 | The game live on a shareable link | 1 evening |
| 2 | The code split into a proper project you can grow | 2–3 evenings |
| 3 | Real 3D models and animated characters | 3–5 evenings |
| 4 | Modern lighting, shadows, glow | 2–3 evenings |
| 5 | Physics (optional) | 2 evenings |
| 6 | Accounts and cloud saves (optional) | 3–4 evenings |

A few words you'll see everywhere:

- **Terminal**: a text window where you type commands to your computer. On Mac it's the app called Terminal; on Windows use PowerShell. You'll use it far more than you expect. Every command in this guide is typed there, then Enter.
- **Repository (repo)**: a folder whose history is tracked. Every change you make can be undone. GitHub is the website where repos live.
- **Package**: code somebody else wrote that you can pull into your project. Three.js is a package. `npm` is the tool that fetches them.
- **Build**: turning your readable project files into the small, fast files a browser wants. You'll run one command and it does it.

---

## Phase 0: Set up your computer

You'll install four things. All free.

### 0.1 Install Visual Studio Code
This is the editor you'll write code in.
1. Go to code.visualstudio.com and install it.
2. Open it. Go to Extensions (the four-squares icon on the left) and install **Live Server**. It opens any HTML file in your browser and reloads it when you save. That's how you'll test the single-file version.

*How to know it worked:* open `index.html` from the zip in VS Code, right-click in the file, choose "Open with Live Server." The game appears in your browser.

### 0.2 Install Node.js
Node lets your computer run JavaScript outside a browser. Vite and npm need it.
1. Go to nodejs.org and install the **LTS** version (the one marked "recommended for most users").
2. Open a terminal and type:
   ```
   node -v
   npm -v
   ```
   Each prints a version number. If either says "command not found," close the terminal, reopen it, and try again. If it still fails, reinstall Node.

### 0.3 Install Git and GitHub Desktop
Git tracks your changes; GitHub Desktop is a friendly window for it so you don't have to learn Git commands yet.
1. Make a free account at github.com.
2. Install GitHub Desktop from desktop.github.com and sign in.
3. It will offer to install Git if you don't have it. Say yes.

### 0.4 Learn five terminal commands
You only need these:

| Command | What it does |
|---|---|
| `cd folder-name` | Go into a folder ("change directory") |
| `cd ..` | Go up one folder |
| `ls` (Mac) / `dir` (Windows) | List what's in this folder |
| `pwd` | Show which folder you're in |
| Up arrow | Repeat the previous command |

Tip: in VS Code, the menu Terminal → New Terminal opens a terminal already inside your project folder. Use that and you'll rarely need `cd`.

---

## Phase 1: Put the current game on a link

We'll use GitHub Pages. It's free, permanent, and it's where the project's history will live anyway.

### 1.1 Create the repo
1. Open GitHub Desktop. File → New Repository.
2. Name: `orb-seeker`. Tick "Initialize with a README." Click Create.
3. Click "Show in Finder" / "Show in Explorer" to open the folder it made.

### 1.2 Put the game in it
1. Unzip `orb-seeker-site.zip`.
2. Copy `index.html`, `manifest.webmanifest`, `sw.js`, and the `icons` folder into the repo folder. The folder structure matters: `icons` must be a folder next to `index.html`.
3. Back in GitHub Desktop you'll see the files listed as changes. In the box at bottom-left type a short note like "First version of the game," click **Commit to main**, then click **Publish repository** (top). Untick "Keep this code private" so Pages can serve it free.

*What you just learned:* a commit is a saved snapshot with a note. You'll do this every time you change something. The notes become your project's diary.

### 1.3 Turn on GitHub Pages
1. On github.com, open your repo. Click **Settings** → **Pages** (left sidebar).
2. Under "Build and deployment," set Source to **Deploy from a branch**, Branch to **main**, folder **/ (root)**. Save.
3. Wait about a minute and refresh. A box appears: "Your site is live at https://YOUR-NAME.github.io/orb-seeker/".

*How to know it worked:* open that link on your phone. The game runs.

### 1.4 Install it on your phone
- **iPhone (Safari):** tap Share → "Add to Home Screen." Open it from the icon; it's fullscreen now.
- **Android (Chrome):** the menu offers "Install app" or "Add to Home screen."

### 1.5 The update routine (memorize this)
Every time you get a new `index.html`:
1. Replace the file in the repo folder.
2. Open `sw.js` and change `orb-seeker-v1` to `v2` (then v3, v4…). This tells installed copies to fetch the new version.
3. In GitHub Desktop: write a note, Commit, then **Push origin**.
4. Wait a minute. The link updates.

Common mistake: forgetting step 2, then wondering why your phone still shows the old game.

---

## Phase 2: Turn one file into a project

Right now everything is in one 800-line file. That was right for a prototype; it's now the limit. This phase splits it into pieces so each feature has its own file.

### 2.1 Understand the shape first
Every game file will follow the same pattern: it **exports** functions other files can use, and **imports** what it needs from others.

```js
// world.js
export function buildWorld(scene) { /* trees, rocks, pond */ }

// main.js
import { buildWorld } from './world.js';
buildWorld(scene);
```

That's it. Modules are just files that share named things. The browser doesn't natively handle npm packages inside these imports, which is why we add Vite: it's a small dev server that resolves imports and, later, builds the final site.

### 2.2 Create the project
In a terminal, in the folder where you keep projects (not inside the old repo):
```
npm create vite@latest orb-seeker-app -- --template vanilla
cd orb-seeker-app
npm install
npm install three
npm run dev
```
It prints a local address like `http://localhost:5173`. Open it. You'll see Vite's demo page.

What each line did: created a starter project; entered it; installed its dependencies; added Three.js as a dependency; started the dev server. `npm run dev` is the command you'll run every time you sit down to work. Ctrl+C stops it.

### 2.3 Plan the folders
Create these inside `orb-seeker-app`:
```
src/
  main.js         starts everything, runs the frame loop
  world.js        ground, trees, rocks, pond, obstacles
  player.js       the monkey and its movement
  input.js        joystick, look-drag, keyboard
  orbs.js         the seven orbs, placement, collection
  finder.js       the radar
  wanderers.js    the seven duelists and their camps
  duel.js         the tap duel
  shop.js         trader's cart and item definitions
  inventory.js    wishes and items panel
  keeper.js       the dragon and the ceremony
  save.js         load/save to browser storage
  ui.js           toasts, panels, buttons
public/
  icons/          copy from the zip
  manifest.webmanifest
  sw.js
```
Delete the demo files Vite made (`counter.js`, `javascript.svg`, the demo CSS).

### 2.4 Move the code across
This is mechanical: each `// ---------- section ----------` comment in the current file maps to one file above. Two rules keep it sane:

1. Things several files need (scene, player object, save data) live in one place and get imported. Make `state.js` that exports a single object: `export const G = { scene, player, save, state: 'start' }`. Everything reads and writes `G.state` instead of a global variable.
2. Do one file at a time and check the game still runs after each. If you move everything at once and it breaks, you won't know where.

I can do this restructure for you and hand you the project. Even so, read the result: it's the best way to learn the shape.

### 2.5 Make Vite build for GitHub Pages
Create `vite.config.js` in the project root:
```js
export default { base: './' };
```
This makes file paths relative, which GitHub Pages needs. Then:
```
npm install --save-dev gh-pages
```
In `package.json`, inside `"scripts"`, add:
```
"deploy": "vite build && gh-pages -d dist"
```
Now `npm run deploy` builds the site and publishes it to a `gh-pages` branch. In the repo's Settings → Pages, switch the branch to **gh-pages**. That becomes your new update routine: change code, `npm run deploy`, done.

### 2.6 Test on your phone while developing
Run `npm run dev -- --host`. It prints a second address like `http://192.168.1.23:5173`. Open that on your phone (same Wi-Fi). Every save reloads it. This matters: touch controls can only be judged on a real phone.

---

## Phase 3: Real 3D models

This is the biggest visual jump, and the assets are free.

### 3.1 Choose packs
All of these are CC0 (public domain): you can use them commercially without credit.
- **Kenney** (kenney.nl): huge, consistent, clean. Look at "Nature Kit" for trees and rocks, "Animated Characters" packs for people.
- **Quaternius** (quaternius.com): stylized low-poly with rigged, animated characters. Has animal and monster packs; a dragon-like creature may be there.
- **Poly Pizza** (poly.pizza): search by keyword, mostly CC-BY (credit the creator on your start screen).

Download in **GLB** format. One GLB file holds the mesh, materials, textures, and animations. Put files in `public/models/`.

Budget: a prop under 2,000 triangles, the monkey under 20,000, the dragon under 30,000. Sites list the count; if they don't, open the file in the free viewer at gltf-viewer.donmccurdy.com, which also shows the animation names you'll need.

### 3.2 Load a model
```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const loader = new GLTFLoader();

loader.load('models/tree.glb', gltf => {
  const tree = gltf.scene;
  tree.scale.setScalar(1.5);       // models come in random sizes; tune this
  tree.position.set(x, 0, z);
  scene.add(tree);
});
```
First thing every time: load it, see it, adjust scale. Then place many copies with `tree.clone()`.

### 3.3 Animated characters
Rigged models carry animation clips. Playing one:
```js
import * as THREE from 'three';
loader.load('models/monkey.glb', gltf => {
  player.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clips = gltf.animations;                          // e.g. Idle, Walk, Run
  const walk = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Walk'));
  walk.play();
  // in the frame loop: mixer.update(dt);
});
```
Swap between Idle and Walk based on whether the joystick is pushed. This replaces the arm-swing code.

### 3.4 Order of replacement
1. Trees and rocks (static, forgiving, immediate payoff).
2. The seven wanderers (one character model, seven colors or hats).
3. The monkey.
4. The dragon (hardest to find a good free one; keep my primitive dragon until you do).

### 3.5 Performance check
Many separate tree copies cost draw calls. If the phone drops below smooth: use `InstancedMesh` for trees and rocks (one draw call for all of them). Ask me when you get here; it's a 20-line change.

---

## Phase 4: Modern lighting and effects

We're on Three.js r128 (2021). The npm package you installed in Phase 2 is the current one, so most of this is unlocked already.

### 4.1 Shadows
```js
renderer.shadowMap.enabled = true;
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// on each mesh: mesh.castShadow = true; ground.receiveShadow = true;
```
Shadows are the cheapest "this looks real" upgrade. If the phone struggles, set mapSize to 1024.

### 4.2 Bloom (glow) on the orbs and the dragon
```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.4, 0.85));
// replace renderer.render(scene, camera) with composer.render()
```
Bright emissive things (orbs, the Keeper's eyes) start to glow.

### 4.3 A sky
Replace the flat background color with `three/addons/objects/Sky.js` for a real gradient sky with a sun, and animate its sun position for the day-to-night ceremony.

### 4.4 WebGPU, when you're ready
Current Three.js includes a WebGPU renderer that falls back to WebGL automatically. Switching is: `import * as THREE from 'three/webgpu'` and `new THREE.WebGPURenderer()`, then `await renderer.init()`. Post-processing works differently there (a newer system called TSL), so do this after 4.1–4.3, not before. Benefit: faster on dense scenes, more particles. For this game it's a nice-to-have, not a need.

---

## Phase 5: Physics (optional)

Only needed for hills, jumping, or objects that push each other. The pick is **Rapier** (`npm install @dimforge/rapier3d-compat`). You'd give the ground, trees, and player physical bodies and let Rapier move the player instead of our hand-written push-out code. Skip until the flat valley bores you.

---

## Phase 6: Accounts and cloud saves (optional)

Right now saves live in the phone's browser and vanish if the browser data is cleared. **Supabase** (free tier) gives you a login and a database.

1. Make a project at supabase.com. Copy the URL and the "anon" key.
2. `npm install @supabase/supabase-js`.
3. Create a table `saves` with columns `user_id` and `data` (JSON).
4. Add "Sign in with email" (Supabase sends a magic link; no passwords to manage).
5. In `save.js`, after saving locally, also `upsert` the same object to the table; on load, fetch it and take whichever is newer.

Once this exists you can add a leaderboard (most wishes kept, fastest perfect order) and, later, ghosts of other players in the valley.

---

## Habits that will save you

- **Commit small and often.** One feature, one commit, one sentence.
- **Keep a `CHANGELOG.md`** in the repo. One line per version. Future you will thank you.
- **Test on the phone before calling anything done.** Desktop is for building; the phone is the truth.
- **When something breaks, read the browser console.** On desktop: right-click → Inspect → Console. The red text names the file and line. Paste it to me verbatim.
- **Change one thing at a time.** If you change three things and it breaks, you've learned nothing.

## Where to start tomorrow
Phase 0 and Phase 1. That's one evening, and at the end your friends can play. Then tell me, and I'll do the Phase 2 restructure and hand you the project so you can learn the shape by reading it.
