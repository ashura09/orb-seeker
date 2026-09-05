# Orb Seeker — design specification

_September 2026. Sits beside `CLAUDE.md`, which stays the engineering law. Where this
document and the code disagree, **this document is the intention and the code is the
bug.** Nothing gets built that is not in here; if something should be built, it goes in
here first._

Readable version: the published artifact "Orb Seeker Design Spec".

---

## 1. Why this document exists

The code had outgrown the design. Evidence, all of it currently in the repo:

- **Crawl and whistle** exist with no situation that requires them. When they crowded
  the screen we removed the _buttons_ and kept the _mechanics_ — the signature of a
  feature nobody could justify and nobody wanted to delete.
- **`loadout.slots: 0`** — a complete, working equipment-slot system that grants no slots.
- **One 93-fragment sink.** Buy everything and the currency the duel keeps paying becomes
  confetti.
- **The order rule fails permanently** on one wrong orb in the first minute, and paid only
  cosmetically.
- **Four unbeatable duel opponents and a dead branch**, live for months, because nothing
  said what a duel was _for_.

Diagnosis: one five-minute loop, paying a currency with nothing to buy, ending in a world
re-roll that grants nothing. No reason to play a second valley; no reason to open it
tomorrow.

## 2. The model, and its limit

Researched September 2026 against the current top Roblox experiences.

| Pattern                  | What it means                                                                                    | Where we stand                                |
| ------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **Time-to-first-action** | Breakouts reach a clear repeatable activity inside the first minute. Beats genre as a predictor. | Nine-line text wall, then a 48 m walk.        |
| **A 30-second loop**     | _Steal a Brainrot_ converts in 30s and needs no explanation.                                     | Shortest complete loop ≈ 5 minutes.           |
| **Layered progression**  | _99 Nights in the Forest_: tiered daily quests on 24h reset, badges at 10/50/100, class levels.  | No levels, quests or badges.                  |
| **Prestige / rebirth**   | Reset at the cap, keep permanent bonuses.                                                        | The valley re-rolls already and pays nothing. |

**What does not transfer.** Those games monetise through Robux. `CLAUDE.md` forbids
purchases, ads and spending pressure aimed at players — and more fundamentally, Roblox's
monetisation _is the platform_: a Three.js page has no Robux, storefront or discovery
algorithm. We copy the structures that create momentum, not the business model. Going after
the business model means rebuilding in Luau on Roblox. That is Ashura's call, open below.

## 3. The spine: three nested loops

Every session must satisfy all three at once.

| Timescale      | Name      | What happens                                                                                                             |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| **30 seconds** | The beat  | See it, run to it, take it. **Rule: never more than 15 m of empty walking.** The collection burst is this beat's payoff. |
| **8 minutes**  | The run   | One valley, spawn to ceremony. Ends on a **score screen**: time, order, duels, taps/sec, XP.                             |
| **Weeks**      | The climb | Seeker levels, ranks, daily quests, the Turning.                                                                         |

## 4. Seeker levels

XP is earned by playing at all, not by playing well.

| Action              | XP            | Reasoning                                                   |
| ------------------- | ------------- | ----------------------------------------------------------- |
| Orb collected       | 10            | Seven a valley; the beat should always pay.                 |
| Duel won            | 10 + 5×tier   | Hard camps pay more, so the difficulty curve has a purpose. |
| Duel lost           | 5             | Losing is never a wasted minute.                            |
| Valley completed    | 150           | The biggest single award, so finishing beats grinding.      |
| Perfect order (1→7) | 100           | Gives the order rule teeth for the first time.              |
| Daily quest         | 40 / 90 / 200 | Easy / medium / hard.                                       |

**Curve:** XP to next level = `60 + 30 × current level`. Level 30 ≈ 14,800 XP ≈ **35
valleys** — weeks for a child, not an afternoon and not months.

| Levels | Rank             | Unlocks                                    |
| ------ | ---------------- | ------------------------------------------ |
| 1–4    | **Wanderer**     | 1 equipment slot. Daily quests at level 3. |
| 5–9    | **Finder**       | 2nd slot. Seed codes at level 7.           |
| 10–14  | **Seeker**       | 3rd slot. Best-time tracking per valley.   |
| 15–19  | **Orbkeeper**    | Valley modifiers. **The Turning** at 18.   |
| 20–24  | **Valewarden**   | 4th slot. Hard dailies appear.             |
| 25–30  | **Dragonfriend** | 5th slot. The Keeper greets you by rank.   |

### The Turning

The valley already regenerates from a seed after every ceremony, and today that is pure
loss. Rename it **the Turning**, attach a reward, and it becomes the reason to continue.
Keep everything — level, items, badges, wish stones — and choose one **modifier** for the
new valley (Night Valley, Thin Woods, Rich Vein, Fierce Camps), each unlocked by play.
Turning count shows on the HUD as a row of marks.

## 5. Daily quests

Three per day, one of each tier, 24-hour reset, drawn from a **fixed pool** so they can be
tested. No server.

| Tier       | Examples                                                           | XP  |
| ---------- | ------------------------------------------------------------------ | --- |
| **Easy**   | Collect 3 orbs · Win one duel · Walk 500 m                         | 40  |
| **Medium** | Finish a valley · Win 3 duels · Beat a tier-5 camp                 | 90  |
| **Hard**   | Perfect order · A valley losing no duel · A valley under 8 minutes | 200 |

**Badges** at 10, 50 and 100 completions — the long goal that outlasts the level cap.

## 6. Seed codes — the social layer

The strongest asset in the project, already built: **the valley is generated
deterministically from a seed.** The same seed makes the same valley on any phone.

Show it as a short code (`VALE-7K2M`) with a _Share this valley_ button. A friend types it
in and gets an identical world — same orbs, same camps, same hills — and can race. Best
time per seed stored locally, shown on the score screen beside yours.

This needs no accounts, networking, chat or moderation, so it satisfies every child-safety
rule in `CLAUDE.md` **by construction rather than by policing**. Roughly two days of work
against weeks for live multiplayer. Live co-op by room code stays on the roadmap; it is
just no longer the first way friends touch the game.

## 7. What every mechanic is for

**The rule that stops this happening again: if a mechanic has no answer in this column, it
does not ship.**

| Mechanic        | What it is for                                                                                                                                                      | Verdict   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Orb gathering   | The 30-second beat. The thing you do most.                                                                                                                          | keep      |
| Duels           | Breaks up walking; the one test of skill. Two strategies: buy the grip, or use two thumbs.                                                                          | keep      |
| Fragments       | Pays for the run. Modifiers and keepsakes become new sinks.                                                                                                         | extend    |
| Equipment slots | Currently nothing (`slots: 0`). Becomes the main reward for levelling: 1 slot at L1, 5 by L25.                                                                      | fix       |
| The order rule  | A mastery challenge. Stop it failing permanently; make it a scored 100 XP bonus and a hard daily.                                                                   | rework    |
| Wishes & stones | The run's payoff and its memory.                                                                                                                                    | keep      |
| Whistle         | Nothing today. **Whistle to call the nearest villager for a duel on demand** — turns an ambush you endure into a fight you choose, and makes duel dailies playable. | repurpose |
| Crawl           | Nothing, and no proposal is convincing. Adding stealth to justify a button is the exact mistake this document exists to stop.                                       | **cut**   |
| Map / radar     | Navigation, and why exploring feels directed.                                                                                                                       | keep      |

## 8. The first sixty seconds

| Time   | What happens                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------ |
| 0–5s   | **No wall of text.** One line: _"Something is glowing over the rise."_ Then the game starts.     |
| 5–20s  | **The first orb is visible from spawn** — within 15 m, in the open, lit. Walk into it.           |
| 20–35s | **First reward.** +10 XP, a dot fills, one sentence explains orbs _after_ the player did it.     |
| 35–60s | **A scripted first duel.** Bram walks over. Tier 1, comfortably winnable, pays fragments and XP. |

By sixty seconds the player has collected, fought, won and levelled.

## 9. Build order

Sequenced so each step is playable alone, ordered by momentum bought per day of work.
Draw-call cost against a budget with **one call spare of 150**.

| #   | Step                              | Cost      |
| --- | --------------------------------- | --------- |
| 1   | XP, levels and ranks              | 0 calls   |
| 2   | Equipment slots by level          | 0 calls   |
| 3   | The run score screen              | 0 calls   |
| 4   | First-sixty-seconds rewrite       | 0 calls   |
| 5   | Daily quests + badges             | 0 calls   |
| 6   | Seed codes and racing             | 0 calls   |
| 7   | The Turning + modifiers           | 0 calls   |
| 8   | Whistle repurposed, crawl removed | −1 call   |
| 9   | Merge the player's ~31 meshes     | frees ~25 |
| 10  | The landmark, then sound          | +2 calls  |

**Steps 1–8 add no 3D objects at all.** The thing that has been blocking us — 149 of 150
draw calls — does not touch the part of the game that is actually missing. The plan is
cheap because what Orb Seeker lacks was never geometry.

## 10. Open decisions

1. **Web game, or eventually Roblox?** Everything here works on the web. Chasing Roblox
   earnings means rebuilding in Luau with this document as the brief.
2. **Does the monetisation rule stand?** `CLAUDE.md` forbids purchases and spending
   pressure. This spec is designed to it. Revisiting it must be explicit.
3. **Level 30, or higher?** 30 ≈ 35 valleys. Recommendation: 30, with badges continuing
   indefinitely.
4. **Is crawl really cut?** The only outright deletion here.
