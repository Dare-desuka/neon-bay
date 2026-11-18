# Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Dare-desuka/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Dare-desuka/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for the make.fun [`gta6-01`](https://make.fun/bounty/gta6-01) bounty — built with Three.js, no network, no audio files, no build step.

Want to try make.fun yourself? [Join with my referral link](https://make.fun/r/q3egcwt3) (code `q3egcwt3`).

## The game

Rex is new in Neon Bay, a sun-soaked coastal city of grid streets, tower blocks, palms and a beach. Work for the fixer Marnie Voss through four chained story missions — a package pickup, a car theft and getaway, a timed drive with Vic, and a turf war against the Red Dogs — or just cruise, steal cars and see how much heat the city can take.

- **Open world:** a full street grid to explore on foot and by car, with traffic, pedestrians, parked cars to steal, a beach and the ocean.
- **Wanted level (0–5 stars):** stealing cars, hitting pedestrians, ramming police and shooting raise it. Police cars chase and ram; foot cops chase and arrest. Stay out of sight and the heat cools off.
- **Combat:** punch up close, or draw the pistol (unlocked after the first mission) and shoot.
- **Missions + story:** four chained missions with objective markers, on-screen objectives and dialogue, plus a free-roam ending when the city is yours.
- **HUD:** health, money, wanted stars, a game clock, the current objective and distance, a speedometer in cars, and a live minimap showing streets, traffic, police and the mission marker.
- **Sound + music:** everything is synthesized with WebAudio — engine hum, sirens, gunfire, pickup blips and a looping groove. Press M to toggle the music.
- **Save:** progress (mission, money, health, position, pistol) saves to localStorage; Continue picks up where you left off.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Run |
| Mouse drag | Orbit the camera |
| E | Enter / exit a car |
| Click | Punch, or shoot with the pistol |
| Q | Draw / holster the pistol |
| H | Horn |
| P / Esc | Pause |
| M | Toggle music |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` (Three.js is vendored as `game/vendor/three.module.min.js`). It loads nothing from the network.

## Screenshots

`shots.json` lists the four staged shots under `screenshots/`: the title screen over the city, driving with the HUD and minimap, a three-star police chase, and the first mission at the marina. Each is staged by the game itself (`?shot=start|drive|chase|mission&seed=1`) playing the real rules forward with an autopilot.

## License

MIT — see `LICENSE`.
