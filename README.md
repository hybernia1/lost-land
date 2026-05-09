# Lost Land

Single-player browser strategy/survival game about keeping a survivor settlement
alive under resource pressure, hostile environment events, and future zombie
hordes.

Current baseline:

- TypeScript + Vite
- PixiJS village scene and in-game HUD
- DOM title menu/settings/save-load flow
- localStorage save slots
- shared game tuning in `src/game/config.ts`
- environment conditions: stable, rain, snow front, radiation
- day/night lighting driven by the game clock
- main building atlas: 20 static upgrade levels in a `5x4` `256x256` sheet

Development:

```txt
npm install
npm run dev
npm run build
```
