# Test plan

Two minutes, by hand, **on a phone**, before every deploy. Desktop is for building;
the phone is the truth.

Say in the session summary that you ran it. If a step fails, that is a bug even if
everything else passes — write it down before fixing, so it does not get lost.

> Run against the live link after deploying, not just `npm run dev`. The service
> worker only misbehaves on the deployed copy, and that is exactly where it matters.

## The two-minute pass

| #   | Step                                                                                                             | Passes if                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | **Move.** Left thumb on the joystick, walk in a circle. Right thumb to look around.                              | The monkey walks and turns, the camera follows smoothly, and it does not clip inside a tree. |
| 2   | **Zoom.** Pinch out, then in.                                                                                    | The view pulls back and pushes in, and the zoom you chose is still there after you let go.   |
| 3   | **Jump.** Tap Jump next to a rock or a log.                                                                      | He leaves the ground, clears the low thing, and lands without sticking.                      |
| 4   | **Map.** Tap the radar.                                                                                          | The map opens, shows only ground you have walked, and closes again.                          |
| 5   | **Collect.** Walk into an orb.                                                                                   | Counter goes up, the dot lights, a message appears, the phone buzzes.                        |
| 6   | **Duel.** Let a villager catch you and tap through it.                                                           | Their line appears, the bars fill, a result shows, and fragments are added.                  |
| 7   | **Buy.** Open the trader, buy the cheapest item, then walk over the crate.                                       | Fragments go down, the crate appears, picking it up shows the item in the satchel.           |
| 8   | **Wear.** In the satchel, take something off and put it back on.                                                 | The monkey visibly changes both times.                                                       |
| 9   | **Ceremony.** Gather all seven orbs, make a wish, pick up the token.                                             | The Keeper arrives, the wish is accepted, the token can be collected.                        |
| 10  | **Reload, and save persists.** Fully close the tab, reopen the link.                                             | Fragments, items, worn items and wishes are all still there.                                 |
| 11  | **Install to home screen.** iPhone: Share → Add to Home Screen. Android: menu → Install app. Open from the icon. | It opens fullscreen with no browser bar, and the game plays.                                 |
| 12  | **Background it.** Switch apps for ten seconds, come back.                                                       | It resumes where it was, without lurching forward, and the battery is not noticeably warmer. |

## Performance check (do this one on the oldest phone you can find)

Use **`?bench&stats`**, not `?stats`. Bench mode pins the seed, your position, the
camera and the time of day, and freezes the villagers, so two runs are comparable.
Plain `?stats` while walking around is fine for a rough look but useless as a
before/after — the same code measured 166 and 192 draw calls that way.

Bench does not pin the _window_, and the frustum follows it: the same build reads
302k triangles at 900x600 and 419k at 800x823. Compare at one screen size.

| Reading    |             Budget | Notes                                                                      |
| ---------- | -----------------: | -------------------------------------------------------------------------- |
| Triangles  |     under **300k** | The single biggest lever is `CONFIG.world.props`.                          |
| Draw calls |      under **150** | Currently ~184 at normal quality; see the note below.                      |
| FPS        | at or above **45** | Below this for five seconds and the game drops to low graphics on its own. |

**The budget is now enforced, not just written down.** Run it:

    npm run audit

It starts the game headless on `?bench`, reads the stats overlay in both normal
and low graphics, and exits non-zero if draw calls or triangles are over budget,
or if anything logged a console error. Current: 147 calls and 276.1k triangles
normal, 70 and 106.9k low.

It deliberately does NOT assert frame rate. Headless Chromium renders in software
with no GPU, where this scene reports about 10 fps against 120 in a real browser.
Counts transfer between machines; timings do not. **Frame rate is measured here,
on a phone, and nowhere else.**

## Multiplayer (not built yet)

When net features exist, this section gets a two-window procedure: open the game in
two browser windows, host in one, join by code in the other, and confirm both see
each other move before calling anything done.
