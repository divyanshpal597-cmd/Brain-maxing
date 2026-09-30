# Cashcoil

**Eat · cut · cash out.** A stake-arena snake game, rebuilt mobile-first from the original `stake-snake` prototype.
It is a zero-build PWA (install to home screen, works offline) with a Capacitor wrapper for native Android and iOS builds.

## Run

```bash
cd cashcoil
npm run dev                # serves www/ on http://localhost:5173
```

Open it on a phone on the same network, then use **Add to Home Screen** to get the fullscreen app.

### Native app (Android / iOS)

```bash
npm install
npm run cap:add:android    # once (or cap:add:ios on a Mac)
npm run android            # syncs www/ and opens Android Studio
```

## Journey: the Nine Scales (main mode)

> Long ago a serpent called Ouro curled around this island and fell asleep. His coil held the land together. Last night he shed nine golden Scales, and they scattered across the nine lands. Without them he is fading. This morning, in the Nest, a very small egg began to crack…

You are the hatchling. Each chapter takes place in one region and teaches one of its mechanics. It ends when you **coil around** that region's Scale Shrine. Shrines are checkpoints: if you fall, you wake at the last one with half your length.

| # | Chapter | Region | Guide | What you do |
| --- | --- | --- | --- | --- |
| 1 | The Hatchling | The Nest | 🐢 Old Moss | Eat, then learn to coil (crack a chest) |
| 2 | The Thief in the Leaves | Wildwood | 🐍 Rattle | Chase down and cut off Rattle, who runs from you |
| 3 | Fish Tales | Mirewater Marsh | 🐸 Mother Mire | Catch 12 fish that swim away, in slowing water |
| 4 | The Leviathan's Hoard | Bone Desert | 🌬️ The Whisper | Grab 3 shards while the Leviathan hunts you |
| 5 | The Ice Run | Frostbite Tundra | ❄️ Glacier Spirit | Race through 7 ice gates in 60 s on slippery ice |
| 6 | Five Lights | Crystal Caves | ✨ Echo | Light 5 crystal hearts in the dark |
| 7 | Beat the House | Neon Strip | 🎰 Lucky Lou | Hit 7-7-7 on a jackpot machine |
| 8 | Through the Fire | Magma Wastes | 🦎 Cinder | Take 3 Ember Cores from beside the geysers |
| 9 | The Vault | Sunken Ruins | 🗿 The Warden | Coil the Vault's heart while its doors are open |
| ★ | The Great Coil | The Nest | 🐉 Ouro | Coil the World Egg. Ouro returns and you earn the **Ouro** skin |

Journey mode has no money: no stakes, no wallets, no banks. XP, levels, missions, discovery and skins all carry over. The **Stake Arena** (below) is the second tab on the home screen, kept for when money and login arrive. The story lives in `www/js/story.js`: chapters are data, so new chapters, lines or step types are easy to add.

## The island (open world)

The whole game is one seeded 12,000-unit island with nine regions. It is identical on every device, so players can learn it.

| Region | Identity | Mechanic |
| --- | --- | --- |
| **The Nest** (centre) | Spawn meadow | Dense cheap food; every road starts here |
| **Frostbite Tundra** (N) | Ice sheets, snow pines | Ice: turns drift wide, slightly faster; fat frost orbs |
| **Crystal Caves** (NE) | Glowing crystals | Pitch dark: small light radius, distant snakes show only their eyes |
| **Neon Strip** (E) | City grid, neon | 4 **jackpot machines**: drive in to spin for gems/mass (7-7-7 = jackpot) |
| **Magma Wastes** (SE) | Lava pools, obsidian | **Lava kills**; **geysers** telegraph, then spray ember orbs |
| **Sunken Ruins** (S) | Pillared ruins | **The Vault** opens every 2.5 min for 25 s and pours out gems and mass |
| **Wildwood** (SW) | Forest canopy | Snakes under trees are hidden (no name tag, hunters can't target you) |
| **Mirewater Marsh** (W) | Swamp pools, rain | Shallow water slows you by 34%; fish orbs swim away |
| **Bone Desert** (NW) | Dunes, bones | The invincible **Dune Leviathan** roams, burrows, and bursts up under you |

**Everywhere:** the ocean coast (deep water drowns you) and solid rocks you slide along. Roads give +15% speed and blue **speed pads** on them give a free sprint. Three **portal pairs** link opposite ends of the map. **Coil chests** (wood/iron/gold) crack when you circle your body all the way around them. **Frenzy** surges pop up in random regions. A 4-minute **day/night cycle** darkens the map at night.

## How it plays

- **Drag anywhere** to steer. **⚡** sprints and burns length.
- You can only cash out at one of the **5 banks**. A gold arrow always points to the nearest one. Hold CASH OUT inside the ring for 2.5 s and your snake coils around the vault door on its own. Bots bank too, so camping a bank is a strategy.
- Every snake at a table buys in at the **same stake**. Cut a snake off and its wallet spills for anyone to grab. Money is never lost to lava or water; it washes ashore.
- The richest snake wears the **crown** and is shown on the minimap. Hunter bots prefer crowned and player targets.
- Tap the minimap (or press **M**) for the full live map.

## What keeps players coming back

| Loop | Where |
| --- | --- |
| **Exploration:** 9 regions to discover (+150 XP each), a fogged world map on the home screen | `world.js`, `main.js` → `mapSheet` |
| Extraction tension: carry a fat wallet across the map to a bank | `game.js` → `stepPlaying` |
| Scheduled world events (Vault timer, frenzy, geysers, night) that pull everyone together | `game.js` → `stepFeatures` |
| XP gems from vault, chests and jackpots (the world pays in XP and mass, never cash) | `game.js` |
| Daily reward ladder, 3 daily missions from a pool of 13, levels, 10 skins | `store.js`, `config.js` |
| Live multiplier, cut combos, crown, near-miss feedback, one-tap buy-back | `main.js` |

## Layout

| File | Purpose |
| --- | --- |
| `www/index.html` | Screens: home, HUD, result, sheets, modals |
| `www/css/app.css` | All styling (safe-area aware, portrait and landscape) |
| `www/js/config.js` | Tuning, skins, missions, bot names |
| `www/js/world.js` | The island: seeded terrain bake, regions, landmarks, rocks, decor, weather, map rendering |
| `www/js/story.js` | The Nine Scales: chapters, dialogue, objectives, checkpoints |
| `www/js/game.js` | Engine: snakes, bots, boss, orb spatial grid, collisions, economy, world events, renderer |
| `www/js/main.js` | UI, input (joystick, buttons, keyboard), progression hooks |
| `www/js/store.js` | Persistent profile (localStorage), daily reward, missions, XP |
| `www/js/fx.js` | Synthesised WebAudio sfx and vibration |
| `www/sw.js` | Offline cache (bump `VERSION` on release) |

## Next: money and login

- `store.js` is the only persistence layer. Swap `load`/`save` for an authenticated API and keep the same shape.
- Coins are a closed pot: they enter only as stakes and leave only through cash-out. That maps 1:1 onto a real wallet, but the arena then **must run server-side** (an authoritative simulation), because a client-side sim can be edited.
- Daily and mission and level-up coins are *minted*. With real money they should become a separate non-withdrawable bonus balance.
- Real-money skill and stake games are regulated: check licensing, age and KYC, and responsible-play limits for each target market before launch.

## Building the APK

```bash
cd cashcoil && npm install && npx cap sync android
cd android && ./gradlew assembleDebug     # needs JDK 21 + Android SDK 35 (set ANDROID_HOME)
# → android/app/build/outputs/apk/debug/app-debug.apk
```

The Android project is committed with the app icon, splash, immersive fullscreen and keep-screen-on already set up in `MainActivity.java`.
