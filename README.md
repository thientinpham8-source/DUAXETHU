# Đua Xe Thú

A Vietnamese-first, pastel 3D kart racer built with Three.js and Rapier. Race three laps against five AI rivals, drift for boosts, collect round candy orbs and use seven playful power-ups. Six baby animal drivers have distinct kart colors, silhouettes and balanced handling.

The race simulation is currently single-player against AI. An online Firebase room lobby is available for creating rooms and seeing other players; real-time synchronized racing is still to be implemented. The game does not connect to Google or Telegram accounts. Settings and race results are stored locally in the browser.

The online-room lobby uses Firebase Anonymous Authentication and Cloud Firestore. Before using it on GitHub Pages, enable Anonymous sign-in, publish the included `firestore.rules` in Firebase Console, and add the Pages host (`thientinpham8-source.github.io`) under Authentication → Settings → Authorized domains. The lobby currently supports creating/joining rooms and live player lists; synchronized races are not implemented yet.

## Run

```bash
pnpm install
pnpm dev      # local Vite development server
pnpm test     # rules, save migration, localization and preview checks
pnpm build    # typecheck + production build + bundle budget
```

On Windows you can also simply double-click **`ChayGame.hta`** — the single-file launcher. It shows a
themed loading screen, runs `pnpm install` / `pnpm dev` in fully hidden windows (no console flashes)
and opens the browser as soon as the server answers. Closing the launcher window stops the server again.

## Gameplay

- **Tracks:** choose Candy Valley or Halloween Circuit from the racer-selection screen. Halloween has its own moonlit sky, purple dusk lighting, floating ghosts, rounded gravestones and glowing pumpkins; the prototype currently reuses Candy Valley's loop geometry and collision layout.
- **Race:** three laps, six racers total (you plus five AI rivals).
- **Controls:** follow the in-game tutorial for keyboard, gamepad or touch prompts; touch play auto-accelerates. Drift through corners to charge a boost, then release. Press the item button/Space/X to use a held item.
- **Power-ups:** Bubble Shield, Pepper Blast, Taffy Trap, Homing Bee, Candy Rocket (homing projectile), Sonic Pop (nearby area shockwave), and Sugarbolt (strikes a leading rival). Candy Orbs award a position-weighted random item.
- **Weather and effects:** a gentle cycling rain-and-sun sky, soft pastel sparks, rounded candy bursts, brief hit-stops and camera shake. Reduced-motion and quality settings remain available.
- **Racers:** **Bunny Thỏ** (rabbit), **Panda Gấu** (panda), **Đại Ka Kọp** (tiger with stripes), **Gà Wala** (chick), **Ngưu Ma Vương** (water buffalo), and **SleepingDog** (puppy). Rounded models include visible little legs and smooth wheels.

## About

The in-game **Giới thiệu** button shows the requested credits:

- Game được phát triển bởi Tín Phạm
- Copyright @SushiSoft 2026

## Languages

Vietnamese is the default. English and Simplified Chinese remain selectable in Settings. Player-facing text is stored in `src/i18n/`; the localization test checks identical keys and placeholder sets.

## Project layout

| Path | Role |
| --- | --- |
| `src/engine/` | Fixed-step game loop, input, Rapier physics, rendering, audio and local save |
| `src/game/` | Track themes, kart physics, baby-animal models, AI rivals, item simulation, effects and race rules |
| `src/ui/` and `src/styles/` | Character/map selection, HUD, menus, controls and results |
| `src/i18n/` | Vietnamese, English and Simplified Chinese copy |
| `tests/` | Rule, localization, save migration and preview checks |

Models and SFX are procedural/in-project; fonts are Sora, Figtree and Noto Sans SC (SIL OFL 1.1). The project preserves its initialized Vite/Three.js runtime and Rapier dependency.
