// rig.js — a skeleton for the monkey, borrowed from a CC0 character.
//
// The game had no animation. Arms and legs were swung by writing Math.sin into
// their rotations every frame, which is why walking looked like a metronome and
// why there was no jumping, crouching or reacting of any kind.
//
// WHAT WE TAKE, AND WHAT WE LEAVE
//
// `seeker.glb` is Kenney's Mini Characters (CC0). We take its SKELETON SHAPE and
// its 32 ANIMATION CLIPS and throw its meshes away. The monkey has a hood, a
// headband, a scarf tail, ears, a muzzle and a tail of his own; swapping him for
// a generic blocky human would lose more character than the animation gains.
//
// WHY THE BONES ARE OURS AND NOT THEIRS
//
// Kenney's figure is short and stocky: its hips sit at 51% of head height, where
// the monkey's sit at 28%. Parenting the monkey to their skeleton would silently
// re-proportion him into somebody else.
//
// So we build the seven bones ourselves, at the monkey's measurements, and give
// them Kenney's names. A clip that says "rotate `arm-left` like this" then works
// perfectly on an arm of any length -- rotation does not care how long a limb is.
//
// The one thing that DOES care is translation, so those tracks are dropped. Only
// four of the clips we use had any: walk and sprint bob the root, jump and crouch
// shift the legs, and all of those are measured in Kenney's centimetres and would
// look like a twitch at our scale. Every clip keeps all of its rotation.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * How much of a clip's rotation each bone actually takes.
 *
 * RETARGETING, in one number per bone. Kenney's figure has short stubby limbs;
 * the monkey's arms are more than twice as long relative to his body. The same
 * shoulder rotation that reads as a relaxed pose on a stubby arm swings a long
 * one right out sideways -- which is exactly how he looked on the first run,
 * standing in the valley with his arms splayed like a scarecrow.
 *
 * So limb rotations are eased back toward the rest pose. The motion is the same
 * motion, just at the amplitude a longer limb needs to say the same thing.
 */
const DAMPING = {
  'arm-left': 0.6,
  'arm-right': 0.6,
  'leg-left': 0.8,
  'leg-right': 0.8,
  torso: 1,
  head: 1,
  root: 1,
};

/**
 * Per-clip overrides, because one number per bone is not enough.
 *
 * The splay that had to be damped out lives in the IDLE pose -- a constant
 * shoulder angle Kenney holds while standing. Damping hard enough to fix that
 * also flattened the walk, where the arms swing and should: the first version
 * left him striding along with his arms hanging dead at his sides.
 *
 * So standing gets damped hard and moving barely at all.
 */
const CLIP_DAMPING = {
  idle: { 'arm-left': 0.3, 'arm-right': 0.3 },
  walk: { 'arm-left': 0.9, 'arm-right': 0.9 },
  sprint: { 'arm-left': 0.95, 'arm-right': 0.95 },
};

/**
 * The monkey's own proportions, in metres, as offsets from each bone's parent.
 * These are lifted straight from where his parts already sat, so hanging him on
 * this skeleton changes nothing about how he looks standing still.
 */
export const BONES = {
  root: { parent: null, at: [0, 0, 0] },
  'leg-left': { parent: 'root', at: [-0.15, 0.46, 0] },
  'leg-right': { parent: 'root', at: [0.15, 0.46, 0] },
  torso: { parent: 'root', at: [0, 0.46, 0] },
  'arm-left': { parent: 'torso', at: [-0.42, 0.69, 0] },
  'arm-right': { parent: 'torso', at: [0.42, 0.69, 0] },
  head: { parent: 'torso', at: [0, 0.89, 0] },
};

/** Build the skeleton. Plain Object3Ds: nothing here is skinned, the monkey's
 *  parts are rigid and simply hang off bones, exactly as they did off groups. */
export function buildSkeleton() {
  const bones = {};
  for (const [name, def] of Object.entries(BONES)) {
    const b = new THREE.Object3D();
    b.name = name;
    b.position.fromArray(def.at);
    bones[name] = b;
  }
  for (const [name, def] of Object.entries(BONES)) {
    if (def.parent) bones[def.parent].add(bones[name]);
  }
  return bones;
}

/**
 * Ease every keyframe of a quaternion track back toward no rotation at all.
 * `amount` of 1 leaves the clip untouched; 0.5 halves the swing.
 */
const REST = new THREE.Quaternion();
const TMP = new THREE.Quaternion();
function damp(track, amount) {
  if (amount >= 1) return;
  const v = track.values;
  for (let i = 0; i < v.length; i += 4) {
    TMP.set(v[i], v[i + 1], v[i + 2], v[i + 3]);
    TMP.slerp(REST, 1 - amount);
    v[i] = TMP.x;
    v[i + 1] = TMP.y;
    v[i + 2] = TMP.z;
    v[i + 3] = TMP.w;
  }
}

/**
 * Load the clips and rebind them to our bones.
 *
 * glTF tracks are named for the node they drive, and three's GLTFLoader rewrites
 * those to the loaded objects' uuids. Renaming each track to `<boneName>.quaternion`
 * makes it apply to whatever object of that name the mixer's root contains --
 * which is how a clip authored for their skeleton drives ours.
 */
export async function loadClips(url = 'models/seeker.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);

  // The name three gives a node is not always the glTF node name once uuids and
  // duplicate names get involved, so build the lookup from the scene itself.
  const nameOf = new Map();
  gltf.scene.traverse((o) => nameOf.set(o.uuid, o.name));

  const clips = {};
  for (const clip of gltf.animations) {
    const tracks = [];
    for (const track of clip.tracks) {
      // "<uuid>.quaternion" or "<name>.position"
      const dot = track.name.lastIndexOf('.');
      const target = track.name.slice(0, dot);
      const prop = track.name.slice(dot + 1);
      if (prop !== 'quaternion') continue; // see the note about translation above
      const bone = nameOf.get(target) || target;
      if (!(bone in BONES)) continue;
      const copy = track.clone();
      copy.name = `${bone}.quaternion`;
      damp(copy, CLIP_DAMPING[clip.name]?.[bone] ?? DAMPING[bone] ?? 1);
      tracks.push(copy);
    }
    if (tracks.length) clips[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  // The meshes and their texture are of no use to us and would otherwise sit in
  // memory for the life of the page.
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });

  return clips;
}
