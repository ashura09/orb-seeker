// config.js — every number you would change to make the game feel different.
//
// This is the file to open when you want to balance the game. Nothing here
// imports anything, and nothing here does anything: it is only values. That
// means you can change a number, reload, and see the result without reading
// any other file.
//
// What is NOT here, on purpose:
//   - Shapes and proportions (the dragon's neck, the monkey's ears). Those are
//     art, not balance, and they live next to the code that builds them.
//   - Colours. Same reason.
//   - Anything that appears exactly once and has an obvious name where it is.
//
// A number earns its place here if you might reasonably want to tune it while
// playtesting.

export const CONFIG = {
  // ---------- the valley ----------
  world: {
    radius: 150, // how far you can walk from the centre, in metres
    // Scenery count. Instancing means this is cheap: every copy of one model is
    // a single draw call however many there are, so the limit is triangles, not
    // objects. 260 read as empty.
    props: 1150, // total scenery; regions decide the mix. Raised with
    // clumping: stands leave more open ground between them,
    // so the same count read as sparser than it did scattered.
    cliffRing: 26, // cliff blocks ringing the highland plateau
    pillars: 8,
    groundSegments: 128, // terrain detail, about 4.7 m per quad across 600 m
  },

  // ---------- the map ----------
  map: {
    resolution: 288, // pixels across the drawn valley. Every pixel costs
    // three height lookups, so this is the one number
    // that decides how long the map takes to build.
    grid: 128, // cells across, for what you have and have not seen
    seeRadius: 38, // how far walking reveals, in metres
  },

  // ---------- surface detail ----------
  //
  // The ground was one flat colour per region, on a grid of about 4.7 m per
  // vertex. Nothing that happens between two vertices could show at all, and a
  // cliff face was painted the same green as the meadow beside it.
  detail: {
    rockOnSlopes: 0.8, // how strongly steep ground turns to rock
    slopeFull: 0.55, // the gradient counted as "fully steep"
    rockColor: 0x7a7164,
    dryHigh: 0.12, // high ground bleaches slightly, low ground darkens
    wetLow: 0.2,

    // A tiling noise texture multiplied over the ground. Vertex colours cannot
    // describe anything smaller than a quad; this can.
    detailRepeat: 70, // tiles across the 600 m plane -- about 8.6 m each
    detailDepth: 0.11, // how dark the darkest speckle gets

    // Every copy of a model was the exact same colour, which is a large part of
    // why 1900 props read as 15 objects repeated. One colour per instance costs
    // nothing: it rides in the same buffer as the transform.
    propTint: 0.26, // brightness spread between individual copies
    propWarmth: 0.05, // and a little warm/cool drift
  },

  // ---------- how the scenery is arranged ----------
  //
  // Every prop used to land on an independent uniform random point. That is
  // exactly what confetti is, and it is why the valley read as scattered blocks
  // rather than as a place. Landscapes are not uniform:
  //
  //   stands     things grow in clumps, because they seed near each other
  //   clearings  open ground. A wood is only legible when there are gaps to see
  //              across; wall-to-wall trees is a texture, not a forest
  //   paths      routes between the landmarks where nothing grows, so the valley
  //              looks walked rather than generated
  //   scale      a few things much bigger than the rest, so there is a silhouette
  //              above the canopy and your eye can judge distance
  composition: {
    standsPerRegion: 5,
    standRadius: 22, // average clump size, metres
    standShare: 0.72, // share of props that grow in a clump; the rest are
    // stragglers, which is what stops clumps reading as circles
    clearings: 6,
    clearingRadius: 13,
    pathWidth: 5, // half-width of the cleared route, metres
    edgeThinning: 0.8, // how much density drops toward a region's border
    giantChance: 0.035, // how often a tree or boulder is a big one
    giantScale: 2.6,
  },

  // ---------- the shape of the ground ----------
  terrain: {
    amplitude: 7, // how tall the rolling hills you walk over are

    // The ground reaches far past where you can walk, and climbs into mountains
    // out there. That, rather than fog, is what stops the world having a
    // visible edge. Keep the rise gentle inside the valley: an early, steep rim
    // turns the place into a crater and you cannot see out at all.
    // The first attempt started the rise at 0.9 of the radius, which put a wall
    // climbing at 135 m -- INSIDE the 150 m you can walk. That is what turned
    // the valley into a bowl. The rise now begins beyond the walkable edge, so
    // the whole floor is open and the land only gathers itself up in the
    // distance.
    skirt: 250, // ground extends this far past the walkable radius
    rimStart: 1.05, // 157 m -- past the 150 m you can reach
    rimSpan: 220,
    rimHeight: 75,

    // Individual peaks beyond even that, to break the skyline. No collision.
    hillCount: 58,
    hillNear: 430,
    hillFar: 1000,
    hillMin: 70,
    hillMax: 220,
  },

  // ---------- water ----------
  // A sheet at a fixed height in the wetland basin. The shoreline is wherever
  // the terrain crosses that level, so the landscape draws its own outline.
  water: {
    // radius is the WIDEST the lake may be; the basin decides the rest. minRadius
    // is how far it may shrink before we decide there is no lake here at all,
    // and minDepth how deep it must be to be worth drawing.
    minRadius: 14,
    minDepth: 0.8,
    radius: 46,
    depth: 2.4, // how far above the basin floor the surface sits
    wadeSpeed: 0.55, // how much water slows you
  },

  // ---------- how far you can see ----------
  fog: {
    near: 140,
    far: 950, // started at 130, which ringed the valley with haze
  },

  // ---------- the sky ----------
  // A gradient dome rather than a flat background colour. Real skies are darker
  // overhead than at the horizon, and that alone makes a world feel large.
  sky: {
    envGround: 0x6f8a5e, // light bouncing back up off the grass, for the environment map
    radius: 900, // must sit inside the camera's far plane
    falloff: 0.55, // <1 tightens the gradient toward the horizon
    dayHorizon: 0xbfe0f5,
    dayZenith: 0x4a90d9,
    nightHorizon: 0x2a3560,
    nightZenith: 0x070d24,
    // Where the sun sits relative to you. Long shadows come from a low sun.
    sunOffsetX: 60,
    sunOffsetY: 85,
    sunOffsetZ: 40,
  },

  // ---------- shadows ----------
  // The single cheapest thing that makes a scene look real: without them
  // nothing has weight and everything looks pasted onto the ground.
  //
  // The shadow camera follows the player and covers `range` metres around them,
  // rather than trying to cover the whole valley -- one shadow map stretched
  // over 150 m would be soft and blocky everywhere.
  // ---------- glow ----------
  // A full extra pass over every pixel, which is the expensive kind of effect
  // on a phone. Turn it off first if the frame rate is poor there.
  bloom: {
    enabled: true,
    strength: 0.55, // how far the light bleeds
    radius: 0.5,
    threshold: 0.72, // only pixels brighter than this glow -- keeps the
    // grass out of it and leaves the orbs in
  },

  shadows: {
    enabled: true,
    mapSize: 2048, // drop to 1024 if a phone struggles
    range: 45, // metres around the player that receive shadows
    bias: -0.0005,
    normalBias: 0.035, // handles sloped terrain better than bias alone
  },

  // ---------- walking ----------
  player: {
    speed: 7, // metres per second
    bootsMultiplier: 1.4, // Swift boots. The shop text says "40% faster".
    bobRate: 10, // how fast the walk bounce cycles
    bobHeight: 0.12,
    radius: 0.45, // how close you can get to a tree trunk

    // Jumping. Height is speed squared over twice gravity, so 6.2 and 16 give
    // about 1.2 m -- enough to clear a rock, a stump or a fallen log, and not a
    // boulder or a tree. That ceiling is the point: a jump that clears
    // everything is a jump that deletes the obstacle course.
    jumpSpeed: 6.2, // metres per second, straight up
    gravity: 16, // metres per second squared
    jumpClearance: 0.05, // how far your feet must be above a thing to pass it

    // Crawling: quieter, but slow. The trade is the point -- you give up ground
    // to give up noise. Started at 0.42, which playtesting found unbearable:
    // slow enough that nobody ever chose it.
    crawlSpeedMultiplier: 0.62,
  },

  // ---------- camera ----------
  // The camera orbits the player on a sphere: camYaw spins around, camPitch
  // rides up and down. distance is the orbit RADIUS, not the ground distance.
  //
  // The defaults reproduce the old fixed camera exactly: at pitch 0.354 and
  // radius 6.93 the camera sits 6.5 m back and 3.6 m up, which is where it used
  // to be nailed in place.
  camera: {
    distance: 6.93,
    pitch: 0.354, // starting elevation, radians (~20 degrees up)
    lookAtHeight: 1.2, // the point on the player the camera aims at

    // How far up and down you can swing. Negative pitch drops the camera and
    // raises what it looks at, which is how you see the sky and the Keeper
    // overhead without the camera pushing through the ground.
    pitchMin: -0.62,
    pitchMax: 1.25, // nearly straight down
    minHeight: 0.8, // camera never gets closer than this to the ground
    lookUpGain: 1.5, // how much the aim point rises as you look up

    cinematicDistance: 12.01, // the ceremony pulls back
    cinematicPitch: 0.042,
    cinematicLookAt: 6.5,

    ease: 6, // higher = snappier follow, lower = floatier
    turnSpeed: 2, // Q and E keys, radians per second
    pitchKeySpeed: 1.4, // R and F keys
    dragSensitivity: 0.008,
    dragSensitivityY: 0.006,
    invertY: false, // flip if dragging up should look down instead

    // Scenery must not come between you and the camera.
    clearance: 0.7, // extra margin beyond a prop's own radius
    minClear: 3.4, // the camera never comes closer than this to you
    overClearance: 0.5, // how far the sight line must clear a prop's top by
    blockRadius: 0.7, // props thinner than this are ignored. A fern has no
    // business shoving the camera into your back.

    // Zoom. `distance` above is only the STARTING distance now; the live one
    // is G.camDist, which pinch and the scroll wheel move between these.
    minDistance: 3.0, // close enough to read the monkey's face
    maxDistance: 26, // far enough that he is a figure in a landscape
    wheelStep: 0.0012, // per unit of wheel delta, applied exponentially
    pinchThreshold: 24, // px the finger gap must change before it counts
    pinchJoyTolerance: 0.28, // how far the walking thumb may stray and still
    // be treated as resting rather than walking
  },

  // ---------- the seven orbs ----------
  orbs: {
    minDistanceFromPlayer: 30, // never spawn one on top of you
    minSpacing: 45, // metres between orbs, so they feel scattered
    innerRadius: 40, // nearest an orb can land to the centre
    outerRadius: 140, // furthest (innerRadius + spread)
    pickupRadius: 1.6, // how close you walk to collect one
    litAtOnce: 3, // how many orbs cast light -- see orbs.js for why
    lightRange: 9,
    lightIntensity: 1.2,
    lightCutoff: 40, // beyond this an orb gets no light at all
  },

  // ---------- the villagers ----------
  wanderers: {
    hearingRange: 14, // how far away they notice you
    hearingWithBell: 24, // Silver bell makes you louder
    challengeRange: 2.2, // how close before they start a duel
    huntSpeed: 3.2, // metres per second when coming for you
    roamSpeed: 2.2,
    roamRadius: 22, // how far they wander from camp
    campRadiusMin: 8, // where they start relative to their orb
    campRadiusMax: 18,
    waitMin: 1, // pause between wanders, seconds
    waitMax: 4,
    cooldown: 25, // seconds before the same villager challenges again
    bobRate: 9,

    // Crawling multiplies how far they hear you, so it stacks correctly with
    // the Silver bell instead of overriding it.
    crawlHearingMultiplier: 0.45,

    // Whistling is the opposite: for a moment you are audible from much
    // further away, and anyone in range comes looking.
    whistleRange: 55,
    whistleSeconds: 1.6, // how long the noise carries
    whistleCooldown: 5, // before you can whistle again
  },

  // ---------- the tap duel ----------
  duel: {
    seconds: 10,
    countdown: 3,
    tapValue: 0.05, // bar filled per tap. 1.0 wins, so 20 taps.
    tapValueWithGrip: 0.065, // Duelist grip. 16 taps.

    // The opponent's bar fills at (base + perTier x tier) per second.
    // Tier 1 needs about 4 taps/second to beat; tier 7 about 12.
    opponentBase: 0.16,
    opponentPerTier: 0.065,

    // Winning pays (lootBase + tier + 0..lootVariance) fragments,
    // doubled on a flawless roll. Losing always pays consolation.
    lootBase: 2,
    lootVariance: 3,
    flawlessChance: 0.12,
    flawlessMultiplier: 2,
    consolation: 1,

    resultDelay: 500, // ms before the result card replaces the bars
  },

  // ---------- the finder ----------
  finder: {
    range: 55, // metres shown on the radar
    rangeWithLens: 85, // Long lens. The shop text says "50% farther".
    revealDistance: 28, // within this, an orb shows its number and colour
    sweepSpeed: 1.6,
  },

  // ---------- the ceremony ----------
  ceremony: {
    keeperDistance: 14, // where the Keeper appears, in front of you
    riseSeconds: 2, // orbs lifting into their ring
    keeperGrowDelay: 2, // pause before the Keeper scales up
    keeperGrowSeconds: 2.5,
    wishPromptAt: 6.5, // seconds into the ending before the panel opens
    departSeconds: 4, // how long the Keeper takes to fly away
    respawnSeconds: 12, // wait before the orbs scatter again
    wishesInOrder: 3, // reward for collecting 1..7 in order
    wishesOutOfOrder: 1,
  },

  // ---------- day and night ----------
  dayNight: {
    easeRate: 0.8, // how quickly night falls
    // The hemisphere and ambient lights were CHEAP STAND-INS for sky light,
    // back when Lambert materials could not be lit by an environment map. Now
    // that they can, keeping all three meant three helpings of fill: nothing
    // had contrast and everything took the sky's blue. The stand-ins are turned
    // right down and the sun turned up, so the light has a direction again.
    hemiDay: 0.2,
    hemiNightDrop: 0.15,
    sunDay: 1.75,
    sunNightDrop: 1.62,
    ambientDay: 0.05,
    ambientNightDrop: 0.04,
    lanternBase: 0.2,
    lanternNightBoost: 1.4,
  },

  // ---------- what you can wear at once ----------
  // slots: 0 means no limit -- own eight things, wear all eight. Set it to 3 or
  // 4 and the shop stops being a checklist and starts being a decision: boots
  // OR lens, the bell that draws villagers to you OR the quiet of going without.
  // Everything needed for that is already here; the number is the whole switch.
  loadout: { slots: 0 },

  // ---------- how the image is developed ----------
  //
  // The renderer had NO tone mapping, which means raw linear light values were
  // written straight to the screen. Anything brighter than 1.0 simply clipped
  // to flat white and everything below it sat in a narrow band -- which is most
  // of why the valley looked chalky and plastic no matter what was in it.
  //
  // ACES filmic is the film-stock curve: it rolls highlights off smoothly
  // instead of clipping them and gives midtones contrast. Exposure is the stop
  // you shoot at, and it has to be raised a little because the curve darkens
  // midtones by design.
  render: {
    exposure: 1.02,
    envIntensity: 0.6, // how much sky-bounce lands on every surface
    envNightFloor: 0.12, // ...and how little of it survives at night
    roughness: 0.88, // matte, but not the perfectly flat matte of Lambert
  },

  // ---------- quality, and when to give some up ----------
  //
  // The target phone is a mid-range Android from about four years ago. It cannot
  // be asked about at build time, so the game measures its own frame rate and
  // drops quality if it cannot keep up. See src/graphics.js.
  graphics: {
    autoLowFps: 45, // below this average...
    autoLowSeconds: 5, // ...for this long, and quality drops
    sampleSeconds: 1, // averaging window; one slow frame is a GC, not a slow phone
    lowProps: 700, // scenery count in low mode
    forceLow: false, // set true to see low mode without waiting for a slow phone
  },

  // ---------- the frame loop ----------
  loop: {
    maxDelta: 0.05, // clamps a huge jump after the tab was in background
  },
};

// The trader's stock. `cost` is in fragments; everything else is presentation.
// Kept beside the other tunables because price is the thing you will fiddle with.
export const ITEMS = [
  { id: 'boots', name: 'Swift boots', desc: 'Walk 40% faster.', cost: 12, color: 0x66d9e8 },
  { id: 'lens', name: 'Long lens', desc: 'Finder sees 50% farther.', cost: 10, color: 0x8ce99a },
  {
    id: 'grip',
    name: 'Duelist grip',
    desc: 'Each tap counts more in duels.',
    cost: 18,
    color: 0xe0553d,
  },
  {
    id: 'lantern',
    name: 'Brass lantern',
    desc: 'Carry your own light for the dark.',
    cost: 8,
    color: 0xffe066,
  },
  {
    id: 'hat',
    name: 'Straw hat',
    desc: 'A wide hat, worn over the hood.',
    cost: 6,
    color: 0xd9b86a,
  },
  {
    id: 'cloak',
    name: 'Violet suit',
    desc: 'A new color for your ninja suit.',
    cost: 9,
    color: 0x9b59b6,
  },
  {
    id: 'charm',
    name: 'Orbit charm',
    desc: 'A small ring that circles your sash.',
    cost: 14,
    color: 0xc9a15a,
  },
  {
    id: 'bell',
    name: 'Silver bell',
    desc: 'Wanderers hear you and seek you from farther.',
    cost: 16,
    color: 0xdddddd,
  },
];
