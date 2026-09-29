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

## How it plays

- **Drag anywhere** to steer (a floating joystick). **⚡** sprints and burns length. **Hold CASH OUT** for 3s to bank your wallet.
- Every snake at a table buys in at the **same stake**. Cut a snake off and its wallet spills as gold coins for anyone to grab.
- The richest snake wears the **crown**. Hunter bots go after smaller snakes, and they like crowned players.
- **Frenzy** surges drop a cluster of mass somewhere on the map, and an edge arrow points to them.
- Cash-out pays 95%. The 5% house fee is already modelled.

## What keeps players coming back

| Loop | Where |
| --- | --- |
| Daily reward ladder (7 days, streak flame on home) | `store.js` → `claimDaily` |
| 3 daily missions with coin and XP rewards | `config.js` → `MISSION_POOL` |
| XP → levels → coin bonus and skin unlocks (10 skins) | `config.js` → `SKINS`, `xpForLevel` |
| Live multiplier (1.00× → 2.4×), cut combos (DOUBLE CUT, RAMPAGE…), crown | `game.js`, `main.js` HUD |
| Near-miss feedback ("0.4s from cashing out") and one-tap buy-back | `main.js` → `showResult` |
| Pitch-ladder pickup sounds, coin chimes, haptics, slow-mo death, screen shake | `fx.js`, `game.js` |

## Layout

| File | Purpose |
| --- | --- |
| `www/index.html` | Screens: home, HUD, result, sheets, modals |
| `www/css/app.css` | All styling (safe-area aware, portrait and landscape) |
| `www/js/config.js` | Tuning, skins, missions, bot names |
| `www/js/game.js` | Arena engine: snakes, bots, collisions, economy, canvas renderer |
| `www/js/main.js` | UI, input (joystick, buttons, keyboard), progression hooks |
| `www/js/store.js` | Persistent profile (localStorage), daily reward, missions, XP |
| `www/js/fx.js` | Synthesised WebAudio sfx and vibration |
| `www/sw.js` | Offline cache (bump `VERSION` on release) |

## Next: money and login

- `store.js` is the only persistence layer. Swap `load`/`save` for an authenticated API and keep the same shape.
- Coins are a closed pot: they enter only as stakes and leave only through cash-out. That maps 1:1 onto a real wallet, but the arena then **must run server-side** (an authoritative simulation), because a client-side sim can be edited.
- Daily and mission and level-up coins are *minted*. With real money they should become a separate non-withdrawable bonus balance.
- Real-money skill and stake games are regulated: check licensing, age and KYC, and responsible-play limits for each target market before launch.
