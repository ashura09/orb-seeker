# Credits

Everything in this game that we did not make ourselves, and the licence it comes
under. **Nothing enters `public/` without a line here.**

## 3D models

| Asset                                              | Source                      | Licence |
| -------------------------------------------------- | --------------------------- | ------- |
| Nature Kit (2.1) — 58 props                        | [Kenney](https://kenney.nl) | CC0     |
| Mini Characters (1.0) — the rig and its animations | [Kenney](https://kenney.nl) | CC0     |

**CC0** means public domain: free for personal, educational and commercial use,
with no attribution required. We credit anyway, because it costs nothing and the
people who make these packs are the reason this game has art at all.

Full licence texts ship beside the models in `public/models/`.

### What we use Mini Characters for

**All eight characters** — the monkey and the seven villagers — share this one
file, downloaded and retargeted once.

Only the **skeleton and the animation clips** — `seeker.glb` is loaded for its
seven bones (root, torso, head, two arms, two legs) and its 32 clips: idle, walk,
sprint, jump, fall, crouch, pick-up, emotes and more. Kenney's own character
meshes are discarded.

That is deliberate. The monkey has a hood, a headband, a scarf tail, ears, a
muzzle and a tail, and replacing him with a generic figure would lose more than
animation gains. So he keeps his own body and borrows a skeleton.

## Considered and not used

- **Mixamo** — still free and royalty-free, but Adobe has not actively maintained
  it and since a mid-2025 login outage the account page and auto-rigger have been
  intermittently broken. Not a dependency worth taking on.
- **Kenney Modular Characters** — 2D sprites, not 3D. Wrong pack for this.
