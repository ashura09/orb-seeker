// props.js — the things that stand in the valley.
//
// These are Kenney's Nature Kit models (CC0, public domain — see
// public/models/KENNEY-LICENSE.txt). They replaced hand-built primitives: a
// tree used to be a cylinder with a cone on top.
//
// HOW THEY ARE PREPARED, AND WHY
//
// Each .glb arrives as two or three primitives, one per material, with no
// textures at all — just named colours like "woodBark" and "leafsGreen". So
// each model is flattened on load: every primitive's colour is baked into its
// vertices and the lot is merged into ONE geometry.
//
// That matters because it means every conifer in the valley is a single
// InstancedMesh and therefore a single draw call, however many there are, and
// they all share one material. It is the same pipeline the hand-built props
// used, which is why world.js needed almost no changes.
//
// Models also arrive at whatever size the artist made them, so each is scaled
// to a target height in metres and sat with its base on y = 0. The valley then
// has consistent proportions no matter where a model came from.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// kind -> { files, size in metres, collision radius }
//
// `size` is the model's LARGEST dimension, not its height. Scaling by height
// alone wrecks wide, flat models: rock_largeA is far broader than it is tall,
// so forcing it to 2.4 m high made it 8 m across and it swallowed the screen.
// Scaling the longest axis keeps every model in proportion and bounds its
// footprint, whatever shape it happens to be.
//
// Several files under one kind means the valley gets variety for free: world.js
// asks for a "conifer" and gets one of three.
const CATALOGUE = {
  conifer:   { files: ['tree_pineTallA_detailed', 'tree_pineTallC_detailed', 'tree_pineDefaultA'], size: 7.0, radius: 0.5 },
  broadleaf: { files: ['tree_default', 'tree_oak', 'tree_detailed'],                               size: 5.5, radius: 0.55 },
  deadTree:  { files: ['tree_thin', 'stump_oldTall'],                                              size: 4.5, radius: 0.35 },
  stump:     { files: ['stump_old', 'stump_round'],                                                size: 1.0, radius: 0.45 },
  boulder:   { files: ['rock_largeA', 'rock_largeB', 'stone_largeC'],                              size: 2.8, radius: 1.1 },
  rock:      { files: ['rock_smallA', 'rock_smallC', 'stone_smallB'],                              size: 1.1, radius: 0.45 },
  reeds:     { files: ['grass_leafsLarge', 'grass_large'],                                         size: 1.6, radius: 0 },
  shrub:     { files: ['plant_bush', 'plant_bushLarge'],                                           size: 1.4, radius: 0 },
  fern:      { files: ['plant_bushSmall', 'grass_leafs'],                                          size: 0.9, radius: 0 },
  flower:    { files: ['flower_redA', 'flower_purpleA'],                                           size: 0.5, radius: 0 },
  mushroom:  { files: ['mushroom_redGroup'],                                                       size: 0.5, radius: 0 },
  fallenLog: { files: ['log'],                                                                     size: 2.2, radius: 0.5 },
  lily:      { files: ['lily_large'],                                                              size: 0.9, radius: 0 },
  column:    { files: ['statue_column', 'statue_columnDamaged', 'statue_obelisk'],                 size: 4.2, radius: 0.7 },
};

// ---------- palette ----------
//
// The whole kit uses just twelve materials, which makes it cheap to art-direct.
// Kenney's own palette is a stylised one -- teal foliage, orange bark, pale
// blue stone -- and it fights the warm greens this valley already had. So each
// material is remapped by NAME to a colour that belongs here.
//
// This is the file to edit to change how the world looks. Delete an entry and
// that material keeps the kit's original colour.
const PALETTE = {
  // Kept deliberately far apart in tone. Mapping every green to nearly the same
  // value made the whole valley read as one flat mass; foliage needs a lighter
  // canopy and a darker underside to have any shape at all.
  leafsGreen:   0x63b04a,   // canopy, lighter than the ground
  leafsDark:    0x2f6b34,   // shaded foliage and undersides
  grass:        0x7cbf5a,   // the tufts on rocks and logs
  woodBark:     0x6b4a2a,   // was orange
  woodBarkDark: 0x55381f,
  woodInner:    0xc9a882,
  dirt:         0x7a6142,   // was bright orange
  stone:        0x9aa3ab,   // matches the game's rock grey
  stoneDark:    0x767c84,
  _defaultMat:  0xa8a8a8,
  // colorRed and colorPurple are the flowers, and are left alone on purpose.
};

// kind -> array of prepared geometries, one per variant. Filled by loadProps().
export const PROPS = {};
export const PROP_RADIUS = Object.fromEntries(Object.entries(CATALOGUE).map(([k, v]) => [k, v.radius]));

// One material for every prop: the colour rides in the vertices.
export const PROP_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

/**
 * Flattens a loaded glTF scene into one geometry with baked vertex colours.
 *
 * The colours come from each mesh's own material, which GLTFLoader has already
 * converted into the renderer's working colour space, so they are copied
 * straight across rather than reinterpreted.
 */
function flatten(root){
  const pieces = [];
  root.updateWorldMatrix(true, true);
  root.traverse(node => {
    if (!node.isMesh) return;
    const geo = node.geometry.clone();
    geo.applyMatrix4(node.matrixWorld);

    // strip anything we do not use, so merging never fails on mismatched sets
    for (const name of Object.keys(geo.attributes)){
      if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();

    // COLOUR SPACE, and it matters.
    //
    // glTF says baseColorFactor is LINEAR, so GLTFLoader stores it as linear.
    // But Kenney's exporter wrote sRGB values into that field -- the .mtl files
    // in the same kit carry the identical numbers as Kd, which is sRGB by
    // convention. Taken as linear they render far too bright: bark came out
    // salmon and leaves came out turquoise.
    //
    // Reinterpreting them as sRGB puts them back where the artist meant, and
    // matches how every hand-written colour in this project is already treated.
    // A remapped colour is written as a plain hex, which THREE converts from
    // sRGB for us. Anything not remapped keeps the model's own colour, which
    // needs the same reinterpretation for the reason above.
    const name = node.material?.name;
    const c = PALETTE[name] !== undefined
      ? new THREE.Color(PALETTE[name])
      : new THREE.Color().copy(node.material?.color ?? new THREE.Color(0xffffff)).convertSRGBToLinear();
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++){ colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(geo);
  });
  if (!pieces.length) return null;
  return pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
}

/** Scales a geometry so its longest axis matches `size`, base on the ground. */
function normalise(geo, size){
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const longest = Math.max(
    box.max.x - box.min.x,
    box.max.y - box.min.y,
    box.max.z - box.min.z,
  );
  if (longest > 0){
    const s = size / longest;
    geo.scale(s, s, s);
    geo.computeBoundingBox();
  }
  // centre on x/z and drop the base to zero, so placement code can ignore size
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  geo.computeBoundingBox();
  return geo;
}

let loaded = false;

/**
 * Loads every model. Call once, and await it before building the world.
 * A model that fails to load is skipped with a warning rather than taking the
 * whole valley down with it.
 */
export async function loadProps(){
  if (loaded) return PROPS;
  const loader = new GLTFLoader();

  const jobs = [];
  for (const [kind, entry] of Object.entries(CATALOGUE)){
    PROPS[kind] = [];
    for (const file of entry.files){
      jobs.push(
        loader.loadAsync(`models/${file}.glb`)
          .then(gltf => {
            const geo = flatten(gltf.scene);
            if (geo) PROPS[kind].push(normalise(geo, entry.size));
          })
          .catch(err => console.warn(`could not load models/${file}.glb`, err))
      );
    }
  }
  await Promise.all(jobs);

  // Drop any kind that ended up with nothing, so world.js never asks for a
  // geometry that is not there.
  for (const kind of Object.keys(PROPS)){
    if (!PROPS[kind].length) delete PROPS[kind];
  }
  loaded = true;
  return PROPS;
}
