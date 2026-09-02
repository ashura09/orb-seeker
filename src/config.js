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
    radius: 150,          // how far you can walk from the centre, in metres
    props: 260,           // total trees, rocks, reeds and scrub; regions decide the mix
    pillars: 8,
    groundSegments: 128,  // terrain detail, about 4.7 m per quad across 600 m
  },

  // ---------- the shape of the ground ----------
  terrain: {
    amplitude: 7,         // how tall the rolling hills you walk over are

    // The ground reaches far past where you can walk, and climbs into mountains
    // out there. That, rather than fog, is what stops the world having a
    // visible edge. Keep the rise gentle inside the valley: an early, steep rim
    // turns the place into a crater and you cannot see out at all.
    // The first attempt started the rise at 0.9 of the radius, which put a wall
    // climbing at 135 m -- INSIDE the 150 m you can walk. That is what turned
    // the valley into a bowl. The rise now begins beyond the walkable edge, so
    // the whole floor is open and the land only gathers itself up in the
    // distance.
    skirt: 250,           // ground extends this far past the walkable radius
    rimStart: 1.05,       // 157 m -- past the 150 m you can reach
    rimSpan: 220,
    rimHeight: 75,

    // Individual peaks beyond even that, to break the skyline. No collision.
    hillCount: 58,
    hillNear: 430,
    hillFar: 1000,
    hillMin: 70,
    hillMax: 220,
  },

  // ---------- how far you can see ----------
  fog: {
    near: 140,
    far: 950,             // started at 130, which ringed the valley with haze
  },

  // ---------- the sky ----------
  // A gradient dome rather than a flat background colour. Real skies are darker
  // overhead than at the horizon, and that alone makes a world feel large.
  sky: {
    radius: 900,          // must sit inside the camera's far plane
    falloff: 0.55,        // <1 tightens the gradient toward the horizon
    dayHorizon:   0xbfe0f5,
    dayZenith:    0x4a90d9,
    nightHorizon: 0x2a3560,
    nightZenith:  0x070d24,
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
    strength: 0.55,       // how far the light bleeds
    radius: 0.5,
    threshold: 0.72,      // only pixels brighter than this glow -- keeps the
                          // grass out of it and leaves the orbs in
  },

  shadows: {
    enabled: true,
    mapSize: 2048,        // drop to 1024 if a phone struggles
    range: 45,            // metres around the player that receive shadows
    bias: -0.0005,
    normalBias: 0.035,    // handles sloped terrain better than bias alone
  },

  // ---------- walking ----------
  player: {
    speed: 7,             // metres per second
    bootsMultiplier: 1.4, // Swift boots. The shop text says "40% faster".
    bobRate: 10,          // how fast the walk bounce cycles
    bobHeight: 0.12,
    radius: 0.45,         // how close you can get to a tree trunk

    // Crawling: quieter, but slow. The trade is the whole point -- you give up
    // ground to give up noise.
    crawlSpeedMultiplier: 0.42,
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
    pitch: 0.354,          // starting elevation, radians (~20 degrees up)
    lookAtHeight: 1.2,     // the point on the player the camera aims at

    // How far up and down you can swing. Negative pitch drops the camera and
    // raises what it looks at, which is how you see the sky and the Keeper
    // overhead without the camera pushing through the ground.
    pitchMin: -0.62,
    pitchMax: 1.25,        // nearly straight down
    minHeight: 0.8,        // camera never gets closer than this to the ground
    lookUpGain: 1.5,       // how much the aim point rises as you look up

    cinematicDistance: 12.01,   // the ceremony pulls back
    cinematicPitch: 0.042,
    cinematicLookAt: 6.5,

    ease: 6,               // higher = snappier follow, lower = floatier
    turnSpeed: 2,          // Q and E keys, radians per second
    pitchKeySpeed: 1.4,    // R and F keys
    dragSensitivity: 0.008,
    dragSensitivityY: 0.006,
    invertY: false,        // flip if dragging up should look down instead
  },

  // ---------- the seven orbs ----------
  orbs: {
    minDistanceFromPlayer: 30,  // never spawn one on top of you
    minSpacing: 45,             // metres between orbs, so they feel scattered
    innerRadius: 40,            // nearest an orb can land to the centre
    outerRadius: 140,           // furthest (innerRadius + spread)
    pickupRadius: 1.6,          // how close you walk to collect one
    litAtOnce: 3,               // how many orbs cast light -- see orbs.js for why
    lightRange: 9,
    lightIntensity: 1.2,
    lightCutoff: 40,            // beyond this an orb gets no light at all
  },

  // ---------- the villagers ----------
  wanderers: {
    hearingRange: 14,      // how far away they notice you
    hearingWithBell: 24,   // Silver bell makes you louder
    challengeRange: 2.2,   // how close before they start a duel
    huntSpeed: 3.2,        // metres per second when coming for you
    roamSpeed: 2.2,
    roamRadius: 22,        // how far they wander from camp
    campRadiusMin: 8,      // where they start relative to their orb
    campRadiusMax: 18,
    waitMin: 1,            // pause between wanders, seconds
    waitMax: 4,
    cooldown: 25,          // seconds before the same villager challenges again
    bobRate: 9,

    // Crawling multiplies how far they hear you, so it stacks correctly with
    // the Silver bell instead of overriding it.
    crawlHearingMultiplier: 0.45,

    // Whistling is the opposite: for a moment you are audible from much
    // further away, and anyone in range comes looking.
    whistleRange: 55,
    whistleSeconds: 1.6,      // how long the noise carries
    whistleCooldown: 5,       // before you can whistle again
  },

  // ---------- the tap duel ----------
  duel: {
    seconds: 10,
    countdown: 3,
    tapValue: 0.05,        // bar filled per tap. 1.0 wins, so 20 taps.
    tapValueWithGrip: 0.065,  // Duelist grip. 16 taps.

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

    resultDelay: 500,      // ms before the result card replaces the bars
  },

  // ---------- the finder ----------
  finder: {
    range: 55,             // metres shown on the radar
    rangeWithLens: 85,     // Long lens. The shop text says "50% farther".
    revealDistance: 28,    // within this, an orb shows its number and colour
    sweepSpeed: 1.6,
  },

  // ---------- the ceremony ----------
  ceremony: {
    keeperDistance: 14,    // where the Keeper appears, in front of you
    riseSeconds: 2,        // orbs lifting into their ring
    keeperGrowDelay: 2,    // pause before the Keeper scales up
    keeperGrowSeconds: 2.5,
    wishPromptAt: 6.5,     // seconds into the ending before the panel opens
    departSeconds: 4,      // how long the Keeper takes to fly away
    respawnSeconds: 12,    // wait before the orbs scatter again
    wishesInOrder: 3,      // reward for collecting 1..7 in order
    wishesOutOfOrder: 1,
  },

  // ---------- day and night ----------
  dayNight: {
    easeRate: 0.8,         // how quickly night falls
    hemiDay: 0.85,
    hemiNightDrop: 0.62,
    sunDay: 1.05,
    sunNightDrop: 0.95,
    ambientDay: 0.22,
    ambientNightDrop: 0.12,
    lanternBase: 0.2,
    lanternNightBoost: 1.4,
  },

  // ---------- the frame loop ----------
  loop: {
    maxDelta: 0.05,        // clamps a huge jump after the tab was in background
  },
};

// The trader's stock. `cost` is in fragments; everything else is presentation.
// Kept beside the other tunables because price is the thing you will fiddle with.
export const ITEMS = [
  {id:'boots',   name:'Swift boots',     desc:'Walk 40% faster.',                              cost:12, color:0x66d9e8},
  {id:'lens',    name:'Long lens',       desc:'Finder sees 50% farther.',                      cost:10, color:0x8ce99a},
  {id:'grip',    name:'Duelist grip',    desc:'Each tap counts more in duels.',                cost:18, color:0xe0553d},
  {id:'lantern', name:'Brass lantern',   desc:'Carry your own light for the dark.',            cost:8,  color:0xffe066},
  {id:'hat',     name:'Straw hat',       desc:'A wide hat, worn over the hood.',               cost:6,  color:0xd9b86a},
  {id:'cloak',   name:'Violet suit',     desc:'A new color for your ninja suit.',              cost:9,  color:0x9b59b6},
  {id:'charm',   name:'Orbit charm',     desc:'A small ring that circles your sash.',          cost:14, color:0xc9a15a},
  {id:'bell',    name:'Silver bell',     desc:'Wanderers hear you and seek you from farther.', cost:16, color:0xdddddd},
];
