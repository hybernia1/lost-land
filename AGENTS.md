# Lost Land - agent notes

## Product direction

Lost Land is a single-player browser strategy/survival game set around 2045.
The core fantasy is managing a survivor community under resource pressure,
holding a fortified home village, and surviving zombie hordes.

The first playable version should favor a clear strategy loop over visual
complexity:

- build and upgrade base buildings
- produce, consume, and store resources
- prepare for future random expeditions into the unknown outside world
- react to events and incoming hordes
- save and load the full game state locally

## Technical direction

Prefer a browser-first app that can later be wrapped by Electron.

Recommended baseline:

- TypeScript
- Vite for local development and production bundling
- PixiJS for in-game village rendering and game HUD
- DOM only for title menu, new-game flow, load/settings screens, and the shared floating tooltip host
- SVG sprite icons in `src/assets/icons.svg`, rendered in Pixi via `src/render/pixiIcons.ts`
- Local save system through versioned JSON in `localStorage` first

Do not add Babylon.js unless the project truly moves into real 3D.

## Codex workspace notes

Workspace path:

```txt
C:\Users\nikol\Documents\GitHub\lost-land
```

Default shell:

```txt
PowerShell
```

Once the Vite app exists, prefer these commands:

```txt
npm install
npm run dev
npm run build
npm run preview
```

Use `npm run dev` for the local development server. Keep only one Vite dev
server running for this workspace. Before starting another one, check whether an
existing server is already listening on the Vite port range and reuse or stop it
instead of creating multiple servers on 5173, 5174, 5175, etc. Prefer the
standard Vite URL `http://127.0.0.1:5173/` when available.

Python with Pillow is available in this workspace and is suitable for
deterministic raster atlas work, especially isometric tile assets that must keep
exact frame sizes and angles.

Python audio toolchain is also available for local SFX generation/post-processing:
`numpy`, `scipy`, `soundfile`, `librosa`, and `pedalboard`.

Keep temporary implementation notes in this file only when they are useful for
future Codex sessions. Do not put user-facing design docs, game lore, or task
lists here unless they are also useful as agent guidance.

### Codex Refactor Checkpoint (2026-05-11)

- `src/render/PixiVillageRenderer.ts` is being split into larger logical blocks, not micro-files.
- Already extracted:
  - `src/render/pixi/core/constants.ts`
  - `src/render/pixi/core/types.ts`
  - `src/render/pixi/helpers/formatters.ts`
  - `src/render/pixi/helpers/buildingEffects.ts`
  - `src/render/pixi/helpers/logFormatting.ts`
  - `src/render/pixi/helpers/decisionHelpers.ts`
  - `src/render/pixi/hud/hudPanels.ts` (active conquests, objective panel, event log, action controls, toolbar + left HUD area)
  - `src/render/pixi/modals/resultModals.ts` (quest decision modal, conquest result modal, game-over modal)
- `PixiVillageRenderer` now orchestrates those blocks via adapter-style host methods.
- Build status after each step: `npm run build` passes.

Before editing code, inspect the existing project shape and follow local
patterns. Use `rg` / `rg --files` for searches when available.

## Architecture preferences

Keep game logic independent from rendering and UI.

Global game tuning values belong in `src/game/config.ts` under the exported
`gameConfig` object. Prefer importing that config into domain helpers and
deriving named constants there, instead of scattering raw timing/cooldown values
through systems. Keep static content definitions such as building stats, quest
texts, and environment condition data in `src/data/`.

Preferred structure once the app is created:

```txt
src/
  main.ts
  game/
    config.ts
    Game.ts
    GameState.ts
    tick.ts
    constants.ts
  systems/
    resources.ts
    buildings.ts
    map.ts
    expeditions.ts
    zombies.ts
    events.ts
    save.ts
  data/
    buildings.ts
    resources.ts
    mapTiles.ts
    events.ts
  render/
    PixiVillageRenderer.ts
    pixiIcons.ts
    villageAssets.ts
  ui/
    App.ts
    panels/
  assets/
    icons.svg
```

Use data definitions for buildings, resources, map tiles, events, and zombie
types. Avoid copy-pasted per-building or per-resource logic.

## Code style

- Keep code clean, typed, and non-repetitive.
- Prefer small pure systems that transform `GameState`.
- Keep rendering side effects inside render modules.
- Keep DOM event wiring inside UI modules.
- Add comments only where they explain a non-obvious rule or simulation detail.
- Do not introduce large abstractions before there is real duplication.

## UI and assets

The game UI should be simple, readable, and operational rather than decorative.
Use PixiJS for the in-game village scene and controls.

Icons live in `src/assets/icons.svg` as a symbol sprite. In-game Pixi UI should
draw them through `drawPixiIcon` in `src/render/pixiIcons.ts`, so icon loading
stays centralized.

Translations live in `src/i18n/` as classic language packs. The initial
supported locales are Czech (`cs`) and English (`en`). Keep UI labels, resource
names, building names/descriptions, tile names, and survivor role labels in the
packs instead of hard-coding them in components.

## Save system

Save data should be a versioned JSON snapshot:

```ts
type SaveFile = {
  version: number;
  savedAt: string;
  state: GameState;
};
```

Start with `localStorage`. Saves are multi-slot by community name: each
`GameState` has a stable `saveId` and `communityName`, and the save system keeps
an index of saved communities for the Continue menu. Move to IndexedDB only
when save size makes it worthwhile.

Use autosave only during gameplay. Do not add manual in-game save/load toolbar
buttons; Continue from the title menu is the load flow.

The game is in active development. Do not preserve legacy save compatibility or
write migrations for old experimental state shapes unless explicitly requested.
When state schemas change, bump the save version and reject/delete old shapes
cleanly instead of carrying compatibility branches.

## Current design choices

- Do not render a world map screen for now. The outside world should be unknown
  and future expeditions should use random/outcome-driven flows instead of
  direct sector clicking, scouting, or attack actions.
- Use a separate home village screen with a palisade perimeter and building
  plots inside the camp.
- The village is a circular camp. The center plot starts with the Main Building
  already built at level 1; level 1 has no special population bonus.
- Village building plots are data-driven. A plot starts empty and receives a
  building only when the player starts construction there. Do not render every
  building as pre-placed by default.
- The palisade is a real unique building, not only decoration. It can only be
  built on the dedicated perimeter plot near the gate, improves defense, and
  each completed level attracts one survivor.
- Building construction/upgrades are limited to two active jobs at a time. Show
  the active building queue in the lower-left scene overlay.
- Start from a title menu with New Game, Continue, and Settings. Settings should
  include language selection.
- Keep construction tied to direct village interaction. Clicking an empty plot
  should open a build-choice modal for that plot; clicking an existing building
  should open that building's detail/upgrade modal. The side panel should stay
  focused on context, settlement status, and log.
- Resource and global status indicators should have hover tooltips explaining
  what the values mean.
- The game screen should behave like a fixed game viewport, not a scrolling web
  page. Keep `game-shell` locked to the viewport; allow scrolling only inside
  panels/drawers that need it.
- Start with real-time ticks, pause, and two speed controls: normal `1x` and
  fast `24x`.
- The visible game clock starts at 08:00 on a new game. One full in-game day
  lasts 45 real-time minutes at 1x speed.
- Day/night lighting is derived from `src/game/time.ts`: day starts at 08:00,
  dusk runs 20:00-22:00, night starts at 22:00, and dawn runs 06:00-08:00.
- Keep survivor management simple: only workers, injured survivors, and troops.
  Workers can be assigned to buildings or become troops. Injured survivors can
  only be treated by the Clinic. Troops do not become injured; combat losses are
  deaths.
- Troop training belongs to the Barracks building detail, not to the general
  survivors panel.
- Construction and upgrades reserve a logical number of workers for the whole
  build duration. Reserved construction workers are unavailable for other jobs
  until the job finishes or an injury removes them from the crew.
- Do not use a medicine resource or a medic role. Health is tracked through
  injured survivors; the Clinic treats injured people over time and consumes
  food per treatment.
- Use coal as the stored burnable fuel resource. The former Generator slot is
  now a Coal Mine: assigned workers extract coal, and technical/heated
  buildings consume coal. Level 1 supports 2 workers, level 2 supports 3
  workers, and level 3+ supports 4 workers.
- Do not use an ammo resource. Troops are currently a dummy/simple role until
  future random outside expeditions are designed.
- Use a minimal 2D/2.5D visual style before investing in detailed art.
- Building visuals load through `src/render/villageAssets.ts`. Atlas
  definitions live in `src/data/buildingVisuals.ts`; production buildings
  should use explicit pixel-art atlas assets instead of canvas/vector fallback
  renderers. Keep individual building silhouettes readable at small slot sizes
  and avoid moving game rules into visual asset code.
- The Main Building currently uses `src/assets/buildings/main-building-atlas.png`
  as a `5x4` static atlas with 20 level frames at `256x256`. Do not animate the
  building by cycling atlas frames; use Pixi effects for smoke, lights, weather,
  disabled-power warnings, and similar state overlays.
- The village screen renders through PixiJS. Keep menu, settings, and save/load
  flows in DOM for now, but avoid adding DOM fallback for in-game HUD, build
  modals, or scene overlays.

## Codex checkpoints

- 2026-05-11: Renderer refactor wave continued.
  - Added `src/render/pixi/modals/infoPanels.ts` and moved info modal/panel block out of `PixiVillageRenderer`:
    - survivor overview modal
    - decision archive modal (including row expansion + scroll)
    - weather overview modal
    - resource breakdown modal (including tab + scroll state)
  - `PixiVillageRenderer` now calls `drawInfoPanel(this.infoPanelsHost(), ...)`.
  - Added `infoPanelsHost()` adapter in renderer for stateful scroll/tab wiring.
  - Restored shared helpers `drawModalBackdrop` and `drawOverlayHeader` in renderer after extraction.
  - Verification: `npm run build` passes.
- 2026-05-11: Renderer refactor wave continued (village modal block).
  - Added `src/render/pixi/modals/villageModals.ts`.
  - Moved village modal orchestration and resource-site modal rendering out of `PixiVillageRenderer`:
    - `drawVillageModal`
    - `drawModalHeader`
    - `drawModalClose`
    - `drawResourceSiteModal`
  - `PixiVillageRenderer` now calls `drawVillageModal(this.villageModalsHost(), ...)` and exposes a new `villageModalsHost()` adapter.
  - Kept troop selector state methods (`getResourceSiteTroopCount` / `setResourceSiteTroopCount`) in renderer and wired through host.
  - Verification: `npm run build` passes.
- 2026-05-11: Renderer refactor wave continued (all modal blocks + cleanup).
  - Added `src/render/pixi/modals/buildingModals.ts` for the remaining modal-heavy block:
    - build choices list/tabs/scroll and row rendering
    - building detail modal content
    - market controls
    - barracks controls
    - shared modal tokens/metric helpers used by those blocks
  - `villageModalsHost()` now delegates build/detail rendering through `buildingModalsHost()` into `buildingModals.ts`.
  - Removed the old in-class modal-heavy methods from `PixiVillageRenderer.ts`.
  - Kept shared modal shell helpers in renderer (`drawModalBackdrop`, `drawOverlayHeader`) and restored `drawRewardLine` for HUD objective rewards.
  - Verification: `npm run build` passes.
- 2026-05-11: Renderer refactor wave continued (camera + scene + UI primitives).
  - Added `src/render/pixi/camera/cameraController.ts` and moved camera/input logic:
    - wheel routing for modal scroll areas and zoom
    - pointer drag start/move/end behavior
    - camera animation/clamp/layout helpers
  - Added `src/render/pixi/scene/worldRenderer.ts` and moved world scene rendering:
    - background
    - terrain tiles and decor objects
    - palisade and resource site scene nodes
    - village plot rendering
  - Added `src/render/pixi/ui/primitives.ts` and moved reusable UI drawing primitives:
    - text/centered text
    - panel draw
    - rect/circle button creation
    - pill creation
  - `PixiVillageRenderer.ts` now delegates through `worldRendererHost()` and primitive adapters.
  - Verification: `npm run build` passes.
- 2026-05-11: Renderer refactor wave continued (ambient/weather + texture animations).
  - Added `src/render/pixi/ambient/ambientEffects.ts` with `AmbientEffectsController`.
  - Moved out of `PixiVillageRenderer.ts`:
    - full ambient overlay rendering (rain/snow/daylight)
    - ambient animation loop lifecycle
    - texture animation binding/frame update lifecycle
    - noise helpers used by ambient and texture animation phases
  - `PixiVillageRenderer.ts` now delegates ambient and texture animation responsibilities to `ambientEffects`.
  - `worldRendererHost()` terrain sprite creation now routes through `ambientEffects.createTerrainSprite(...)`.
  - Building animated frame resolution now routes through `ambientEffects.resolveAnimationTexture(...)`.
  - Verification: `npm run build` passes.
- 2026-05-11: PR cleanup pass (typing/contracts hardening).
  - Removed `any` usage from extracted Pixi renderer modules and replaced with explicit contracts:
    - `src/render/pixi/core/types.ts` now defines shared callback and option types (`DrawTextFn`, `DrawPanelFn`, `DrawIconFn`, `DrawOverlayHeaderFn`, `MeasureWrappedTextHeightFn`, etc.).
    - Updated host interfaces in:
      - `src/render/pixi/hud/hudPanels.ts`
      - `src/render/pixi/scene/worldRenderer.ts`
      - `src/render/pixi/modals/resultModals.ts`
      - `src/render/pixi/modals/infoPanels.ts`
      - `src/render/pixi/modals/villageModals.ts`
      - `src/render/pixi/modals/buildingModals.ts`
  - Behavioral intent unchanged; this pass improves refactor safety and future maintainability.
  - Verification: `npm run build` passes.
- 2026-05-13: Map render performance and texture sampling pass.
  - `PixiVillageRenderer` now enables `cameraStaticLayer.cacheAsTexture(...)` for static terrain + decor after rebuild, which reduces per-frame render overhead of large map tile counts.
  - Static cache auto-disables when animated terrain textures are used, preventing frozen tile animations.
  - Environment tint updates now trigger `updateCacheTexture()` so cached static visuals remain in sync with weather/condition tint changes.
  - `VillageAssets` now pre-indexes terrain texture definitions by key, prewarms terrain sub-textures after atlas load, and applies `nearest` scale mode on loaded building/terrain textures for clearer pixel-art sampling.
  - Verification: `npm run build` passes.
- 2026-05-13: Hotfix for black map regression.
  - Static world cache path is temporarily disabled (`computeStaticWorldCacheEligibility()` returns `false`) because some layouts/devices render cached terrain as black.
  - Texture/index/prewarm changes remain active; map rendering falls back to stable pre-cache behavior.
  - Verification: `npm run build` passes.
- 2026-05-13: Safe follow-up map render optimization (no static texture cache).
  - Enabled Pixi `CullerPlugin` during renderer init and configured `cameraStaticLayer` as cullable with `cullArea` based on current terrain bounds.
  - Marked static terrain and decor sprites as `cullable = true` so off-screen sprites can be skipped by culling path.
  - Reduced terrain tint bookkeeping overhead: `trackTerrainSprite` now stores bindings only when `tintByEnvironment` is actually defined and non-empty.
  - Static world cache remains disabled to avoid black-map regression.
  - Verification: `npm run build` passes.
- 2026-05-13: Environment terrain tint defaults for weather.
  - Added default `tintByEnvironment` assignment in `src/data/tiledMap.ts` while building `tileTextures` from Tiled tilesets.
  - Current presets are data-driven by tileset id (`ground`, `brick`, `trees`, `objects`) and include:
    - `rain` (cooler/darker tint)
    - `snowFront` (colder/brighter tint)
  - `stable` remains un-tinted (`0xffffff` fallback in renderer).
  - Verification: `npm run build` passes.
- 2026-05-13: Rain ambient loop added to runtime audio switching.
  - Added `src/assets/audio/ambient-rain-loop.ogg` from OpenGameArt `Rain (loopable)` (CC0), package file `3.ogg`.
  - Updated `src/ui/App.ts` ambient selection:
    - when `state.environment.condition === "rain"`, app now plays rain loop instead of day/night loop.
    - day/night behavior remains unchanged for non-rain conditions.
  - Updated source/license notes:
    - `src/assets/audio/README.md`
    - `src/assets/audio/LICENSE-opengameart-ambient-cc0.txt`
  - Verification: `npm run build` passes.
- 2026-05-13: Ambient loop transitions smoothed with crossfade.
  - Replaced hard stop/start ambient switching in `src/ui/App.ts` with requestAnimationFrame-driven crossfade logic.
  - Added shared ambient loop volume map and `AMBIENT_CROSSFADE_MS` timing (currently 900 ms).
  - Transition behavior now:
    - day/night/rain loop fades out and incoming loop fades in smoothly,
    - active loop changes no longer produce abrupt audio cuts.
  - `stopAmbientLoops()` now cancels in-flight crossfade and restores per-loop baseline volumes.
  - Verification: `npm run build` passes.
- 2026-05-13: Decision alert SFX replaced with heartbeat.
  - Replaced quest decision alert import in `src/ui/App.ts` from `quest-decision-alert.wav` to `decision-heartbeat-alert.wav`.
  - Decision alert asset is now a locally generated synthetic heartbeat (16-bit PCM WAV) with stronger mid-frequency attack for better audibility on laptop/mobile speakers.
  - Latest render was regenerated through Python audio tooling (`numpy` + `scipy` + `soundfile` + `pedalboard`) for envelope shaping, filtering, and dynamics consistency.
  - Extended variant length to ~3 seconds (repeating lub-dub phrase) for a less abrupt decision popup cue.
  - Decision alert volume set to `0.72` via `createUiAudio(source, volume)` helper signature.
  - Updated docs/license notes:
    - `src/assets/audio/README.md`
    - `src/assets/audio/LICENSE-opengameart-ambient-cc0.txt`
  - Verification: `npm run build` passes.
- 2026-05-13: Audio tuning centralized in config.
  - Added `audio` section to `src/game/config.ts` for shared runtime tuning:
    - base UI volume
    - decision alert volume
    - ambient loop volumes (`day/night/rain`)
    - ambient crossfade duration
  - `src/ui/App.ts` now reads these values from `gameConfig.audio` instead of hard-coded literals.
  - Verification: `npm run build` passes.
- 2026-05-13: Title/menu/settings/load moved to canvas runtime.
  - Added front-screen rendering path to `PixiVillageRenderer` (`renderFrontScreen`) for:
    - main menu
    - new game naming flow
    - settings language selection
    - load-game list with in-canvas scrolling
  - `App` now routes non-game modes through the same Pixi runtime instead of DOM start pages.
  - Return-to-menu no longer destroys the renderer; session switches back to front-screen mode in the same canvas.
  - Save list actions in canvas:
    - load only for loadable/current-version saves
    - legacy saves visible but locked
    - delete via in-canvas confirm modal (no browser confirm dialog).
  - Removed legacy DOM menu/start screen CSS and old DOM action routing in `App` (front flow is canvas-only).
  - Verification: `npm run build` passes.
- 2026-05-14: Ambient humanoids moved from map spawn zones to settlement emitters.
  - Added render-only settlement NPC definitions for production buildings, barracks, and watchtower.
  - Peon/soldier sprites now spawn only around built relevant buildings, only when workers/troops exist.
  - Day-shift mode hides settlement humanoids outside daylight hours; continuous shifts keep them visible.
  - Settlement NPCs use the same camera-gated materialization pattern as wildlife, so off-screen emitters do not create sprites or update movement.
  - Removed manual peon/soldier objects from the hidden `npcSpawns` map layer; deer wildlife remains map-spawned.
  - Verification: `npm run build` passes.
- 2026-05-14: Lightweight map NPC ambient movement added.
  - Added hidden Tiled object layer `npcSpawns` in `src/maps/woodland-camp-01.tmj`; loader reads it as data even when `visible:false`.
  - Added `src/data/mapNpcs.ts` for NPC kind tuning and a small local test atlas at `src/assets/npcs/deer-flea-atlas.png`.
  - Added follow-up ambient NPC kinds/assets for `peonFlea` and `soldierFlea`, with camp/gate spawn zones in the same hidden layer.
  - Added `src/render/pixi/scene/mapNpcs.ts`; NPCs live on a dedicated Pixi layer between static map/decor and interactive village objects.
  - Movement is intentionally cheap: no pathfinding, capped spawn count, deterministic random wandering inside spawn rectangles, and low-priority render cadence (~10 FPS when only NPCs are animating).
  - NPC spawn zones are camera-gated: offscreen spawn zones do not materialize Pixi sprites, and their entities are destroyed again when the camera leaves the padded viewport.
  - Verification: `npm run build` passes.
- 2026-05-14: Sky ambient bird layer added.
  - Added `src/data/mapBirds.ts`, `src/render/pixi/scene/mapBirds.ts`, and `src/assets/npcs/small-bird-atlas.png`.
  - Added follow-up white bird variant at `src/assets/npcs/white-bird-atlas.png`; bird flocks randomly choose between black and white variants.
  - Bird density was increased with larger flocks, shorter spawn delays, and max active count 12.
  - Birds render on a dedicated `cameraSkyLayer` above map/building objects and below HUD/weather overlays.
  - Each bird has a ground position plus altitude offset and a subtle ground shadow, giving depth without real 3D.
  - Flights are lightweight: randomized edge-to-edge paths, small flock sizes, low active cap, the existing low-priority visual loop, and viewport checks that skip flights outside the padded camera view.
  - Verification: `npm run build` passes.
- 2026-05-14: Foreground decor depth pass for ambient NPCs.
  - Added object-layer `renderBand` support from Tiled (`base` default, `foreground` optional).
  - `src/maps/woodland-camp-01.tmj` marks the high `decor` layer as `renderBand=foreground`.
  - Removed the empty `water` object layer; water visuals should come from terrain/tile layers, not an unused free object layer.
  - Pixi render order is now terrain/base decor -> ground NPC -> foreground decor -> buildings/resource sites -> birds/HUD overlays.
  - This intentionally solves small NPC/tree overlap visually without collision/pathfinding.
  - Verification: `npm run build` passes.
- 2026-05-14: Sky ambient clouds were prototyped and then removed by direction.
  - Keep the current sky ambient system focused on birds for now.
  - Removed cloud atlas/data/controller wiring; no cloud assets should remain active.
