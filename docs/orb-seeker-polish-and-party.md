# Orb Seeker: The Polish & Party Guide

Three things in here, in the order you should care about them:

1. How big studios make blocky worlds look expensive, and how each trick maps to your Three.js code.
2. How to design multiplayer rooms for a 9-year-old and her school friends, safely.
3. A build plan that puts it together.

---

# Part 1 — How the pros polish blocky worlds

Here's the secret up front: **the blocks were never the problem.** Minecraft with a shader pack looks breathtaking and the blocks didn't change. Roblox spent years upgrading its lighting engine, not its geometry. Crossy Road is boxes. What changes between "programmer art" and "charming" is almost entirely light, color, atmosphere, and motion. Studios call this the polish pass, and it's a discipline of its own. Below are the eight tools, ordered by impact per effort.

## 1.1 A strict color palette

Amateur worlds use fifty colors; polished ones use about eight. Pick them once, write them down, use nothing else.

- The classic split is 60/30/10: one dominant family (your greens), one secondary (earth browns and stone grays), one accent reserved for things that matter (your rainbow orbs, the mint of the finder).
- Make gameplay objects the most saturated things in the scene, and the background slightly grayed. The eye goes to saturation. That's why coins and pickups in every big game are the brightest pixels on screen.
- Steal palettes rather than inventing them: search "color palette" sites for 8-color game palettes, or sample the colors from a screenshot of a game whose mood you love.
- One-hour exercise with huge payoff: take every color in your code, list them, delete half.

## 1.2 Lighting (the single biggest upgrade)

Film people light a scene with three lights and games copy the idea:

- **Key light**: your directional sun. Give it a warm tint (not pure white; try a pale gold).
- **Fill**: your hemisphere light — sky color from above, ground bounce color from below. Slightly blue-ish sky fill makes shadows feel cool and natural.
- **Rim/accent**: point lights on special things (you already do this on orbs). Rarity = light.

Then the two switches that transform everything:

- **Shadows.** `renderer.shadowMap.enabled = true`, sun casts, ground receives. Blocky objects with soft shadows immediately read as "a made thing" instead of floating clipart. Use `PCFSoftShadowMap` and keep the shadow camera tight around the play area for sharpness.
- **Tone mapping.** One line: `renderer.toneMapping = THREE.ACESFilmicToneMapping`. This is the same response curve used in film pipelines; it stops bright colors clipping to neon and makes everything sit together. Pair with `renderer.outputColorSpace = THREE.SRGBColorSpace`.

Time-of-day is lighting too: you already fade to night for the dragon. Extend that idea — a warm dawn tint when orbs respawn, long shadows in the evening. Mood for free.

## 1.3 Atmosphere: fog, sky, and air

Distance haze is how small maps feel vast. You already use fog to hide the world edge; now use it aesthetically:

- Tint fog toward the sky color at the horizon so ground and sky melt together instead of meeting at a hard line.
- Big studios use height fog (thicker in valleys). You can fake it with a large, flat, semi-transparent plane of mist hovering over low ground and the pond.
- Replace the flat background color with a gradient sky (Three.js ships `Sky` in its addons: a physical sky with a movable sun). Sunset for the ceremony will look absurdly good for ten lines of code.
- Air particles: a few hundred drifting motes — pollen in the day, fireflies at night (you already have the spark system on the dragon; reuse it world-wide at low density). Nothing sells "atmosphere" harder than visible air.

## 1.4 Post-processing (the "console game" filter)

These are full-screen effects applied after rendering. Three.js's EffectComposer chains them:

- **Bloom** (UnrealBloomPass): bright emissive things overflow with glow. Orbs, the dragon, lanterns at night. Keep strength ~0.5; the amateur mistake is cranking it.
- **Outlines / toon look**: an OutlinePass or a simple "inverted hull" trick draws dark edges around objects — instantly reads as an art style (the Zelda cartoon look). This is the cheapest way to make blocky = intentional.
- **Ambient occlusion (SSAO/GTAO pass)**: soft darkening where surfaces meet. Subtle, but it glues objects to the ground.
- **Vignette + slight color grade**: darken corners 10%, warm the mids. Every studio ships one; nobody notices it, everyone feels it.

Order matters for performance on phones: shadows and tone mapping first (cheap), bloom second, AO last (most expensive — test on the worst phone you can find, and keep a "low" setting that disables passes).

## 1.5 Terrain with shape and story

Flat green circle → sculpted place:

- **Heightmap terrain**: generate hills with layered noise (simplex noise, low frequency for big forms + a little high frequency for texture). Keep slopes gentle where players walk; use steep spikes only as distant mountains.
- **Vertex colors**: tint the terrain mesh by height and slope — sandy near water, grass on flats, gray on steeps, pale on peaks. No textures needed, fits the low-poly style, costs nothing.
- **Distant mountains as theater scenery**: a ring of big, cheap cones far outside the playable area, slightly fogged. They only exist as silhouettes. Every "huge" game world is mostly scenery you can't reach.
- **Water**: the pro tricks are (a) animate it — even just scrolling a subtle normal/distortion, (b) a foam ring where water meets land (a light-colored band at the shoreline), and (c) darker color with depth. Three.js addons ship `Water` and `Reflector` examples worth borrowing.
- **Landmarks**: one weird memorable thing per region (your pillar ring is one; add a giant skull rock, a lone huge tree, a hot spring). Players navigate by landmarks, and screenshots need a subject.

## 1.6 Motion everywhere ("juice")

A polished world is never still:

- Grass and leaves sway (cheap vertex trick or just gently rotating the leaf cones a few degrees on a sine wave).
- Everything interactive idles: orbs bob (yours do), chests pulse, wanderers shift weight.
- **Tweening**: nothing appears or disappears instantly. Scale pickups in with a bounce, fade panels, ease the camera. An easing library, or just `value += (target - value) * dt * speed` (you already use this pattern for the camera — apply it to everything).
- **Feedback hits**: on collecting an orb — tiny screen shake (3 frames), particle burst in the orb's color, sound, haptic. You have the haptic; add the burst and the sound and collection becomes physically satisfying. This trio is why picking things up in Mario feels good.
- Footstep puffs, splash rings in the pond, birds that scatter. Pick three, not thirty.

## 1.7 Sound (half of "graphics")

Blind-test any polished game muted and it loses most of its magic. Minimum viable soundscape:

- One ambient loop (wind + birds; night variant with crickets).
- One sound per action: step, collect, purchase, duel tap, win, dragon roar (make it musical, not scary — remember the audience).
- Music only at key moments: a gentle theme when the dragon appears beats constant background music.
- Sources: Kenney's audio packs (CC0), freesound.org (check each license). Use the Howler.js library; start audio on the first tap (browsers require it).

## 1.8 Readability (the discipline that ties it together)

Ask of every screen: can a new player tell in one second what's interactive? Rules the pros follow: interactive = saturated + lit + moving; scenery = muted + still. Silhouettes distinct (your seven wanderers should be tellable apart in shadow — vary shapes, not just colors: one tall, one round, one huge hat). UI never covers the center. If a screenshot doesn't read, the scene doesn't either.

## Priority order for your game

1. Tone mapping + shadows (an evening, transforms everything)
2. Palette pass (an evening)
3. Sky + fog tuning + distant mountains (an evening)
4. Bloom + collection feedback burst (an evening)
5. Sound pass (a weekend)
6. Terrain vertex colors + water edge foam (a weekend)
7. Outlines, AO, particles-in-air (when comfortable)

---

# Part 2 — Rooms for a 9-year-old and her friends

The model: **the valley becomes a place her group visits together.** One player opens it, gets a short room code or link, friends join from their phones in seconds, they play for 15 minutes, they leave. Jackbox and skribbl.io proved this loop; you have an advantage they don't — a world to be _in_ together, not just a quiz screen.

## 2.1 What playing together looks like

Start with presence, then add games:

- **Just being there**: see each other as monkeys (each picks a suit color and a name from a list), emote wheel with 6 emotes (wave, laugh, dance, heart, "come here!", sleep). For kids, running around together and spamming the dance emote _is_ the game for the first twenty minutes. Don't underestimate it.
- **Orb race**: same seven orbs, first to each one claims it; most orbs summons the dragon and makes the wish for the group.
- **Co-op gathering**: the orbs only respond when two players stand together — forces teamwork, great for friend groups.
- **PvP tap duel**: your duel, pointed at two humans. Winner takes a fragment pot. This will be the schoolyard favorite; it's Mario Party energy.
- **Hide and seek with the finder**: one player hides, the others' finders point vaguely toward them, reveal radius shrinks over time.
- **Host controls**: whoever opened the room can start a mode, and there's a "everyone back to me" button. Give the host (your daughter) the power; it mirrors how kids actually organize play.

Design rules for this age: rounds under 5 minutes; icons over text; nothing permanently lost when you lose; joining mid-session always works (school friends trickle in).

## 2.2 Safety, designed in from day one

This part is not optional, and the good news is the safest design is also the simplest to build:

- **Private rooms only.** No public lobby, no stranger matchmaking, no "join random valley." The only way in is the code/link from a friend. This single decision removes most risk.
- **No free-text chat.** Preset phrases and emotes only. This is exactly what the big kid-focused games do with their most restrictive settings, and it costs you nothing because you didn't have to build chat anyway. Free text between players means moderation duties you cannot staff.
- **No voice.** Her group will be in the same room or on their own call anyway.
- **Names from a list** (or first name only, no surnames), so nobody can write anything inappropriate or identifying into a name tag.
- **Collect nothing.** No accounts, no emails, no birthdays for the multiplayer version — room codes don't need identity. The moment you collect personal data from under-13s you're into COPPA/GDPR-K territory (US/EU children's privacy law); the clean answer at this stage is: don't collect any.
- **No spending pressure.** Fragments stay earnable-only. If you ever monetize, never aim purchases at the kids.
- Room codes should expire when the room empties, so yesterday's shared link doesn't become a door later.

Write these six rules in your README as policy. They'll keep you honest as features grow.

## 2.3 The technology, honestly sized

Real-time multiplayer is the hardest thing you'll have built so far — not impossible, but respect it. The 2026 standard is WebSockets with an authoritative server (the server owns the truth; phones just send inputs), using a framework so you don't hand-write netcode:

- **Playroom** — the zero-backend option, built exactly for casual room-code games. Fastest path to "we're in the same world"; free tier to start. Start here.
- **Colyseus** — open-source Node.js framework with rooms, matchmaking, and automatic state sync built in; free to self-host, managed cloud from ~$15/month. Graduate here when you want server-side game logic you fully control (needed for fair orb races).
- What you sync is small: each player's position, suit color, emote, and game-mode events. Positions 10–15 times a second with interpolation between updates is plenty for a cozy game.
- Latency reality: fine for racing to orbs and tap duels (each player taps their own bar); avoid designs needing frame-perfect contact between players.

Path of least regret: **Milestone A** — two monkeys see each other move (Playroom, one evening with help). **Milestone B** — emotes + name pick + host "gather" button. **Milestone C** — orb race mode. **Milestone D** — PvP duel. Ship A to her group immediately; watching four kids just _find each other_ in the valley will teach you what to build next better than any plan.

---

# Part 3 — Putting it together

Suggested order, given one person and evenings:

1. **Polish pass 1–4** (tone mapping, shadows, palette, sky, bloom, feedback). Two weekends. Do this first: screenshots start selling the game, and it makes the multiplayer reveal land harder.
2. **Multiplayer Milestone A–B.** The moment her friends can wave at each other, you have your product hypothesis tested for free every recess.
3. **Orb race + duel PvP.**
4. **Daily valley + share card** (single-player retention between get-togethers).
5. **Sound pass**, then keep alternating polish and party features.

And keep the ritual you accidentally started: she plays, she suggests, you ship one of her suggestions each week and tell her which one. That loop — a real player whose ideas visibly appear in the game — is the actual secret of the studios you're asking about.
