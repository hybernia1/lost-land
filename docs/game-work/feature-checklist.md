# Feature Checklist

Legenda:

- `todo` - jeste nezacato
- `doing` - rozpracovane
- `blocked` - ceka na rozhodnuti nebo asset
- `done` - hotovo a overeno

| Stav | Oblast | Ukol | Jak overit | Poznamky |
| --- | --- | --- | --- | --- |
| done | Environment | Pridat typy `EnvironmentConditionId`, `EnvironmentState`, `EnvironmentCrisisState`. | `npm run build` prosel. Save obsahuje environment. | `SAVE_VERSION` zvysen na 28. |
| done | Environment | Pridat default environment do nove hry. | Nova hra zacina se `stable` a naplanovanou dalsi zmenou. | `createInitialState`. |
| done | Environment | Pridat `systems/environment.ts`. | `tickEnvironment` se vola z `Game.tick()`. | Drzet logiku mimo renderer. |
| done | Environment | Implementovat nahodne prechody `stable`, `rain`, `snowFront`. | `npm run build` prosel. | Deterministicke podle save id a casu. |
| done | Config | Pridat globalni `src/game/config.ts`. | `npm run build` prosel. | Centralizuje timing, autosave, environment intervaly, scouting a market cooldown. |
| done | Snehova fronta | Spoustet shelter crisis, kdyz snezi a jsou bezdomovci. | `npm run build` prosel. | Pouziva `getHousingStatus`. |
| done | Snehova fronta | Vyresit shelter crisis, kdyz uz nejsou bezdomovci. | `npm run build` prosel. | Bez manualniho tlacitka. |
| done | Snehova fronta | Pridat nasledky po deadline. | `npm run build` prosel. | Zraneni/umrti/moralka podle intensity. |
| done | UI | Zobrazit environment stav ve statusu vesnice. | `npm run build` prosel. | Pixi top pill s tooltipem. |
| done | Logy/i18n | Doplnit CS/EN texty pro environment udalosti. | `npm run build` prosel. | V language packu, ne hard-code. |
| done | Rendering | Pridat jednoduchy overlay/tint pro rain/snow. | `npm run build` prosel. | Placeholder Pixi efekty. |
| done | Rendering | Pridat day/night svetelny overlay. | `npm run build` prosel. | Den 08:00-22:00; svitani 06:00-08:00; soumrak 20:00-22:00; noc tmavi world layer. |
| done | Dev Tools | Pridat dev-only god mode panel. | `npm run build` prosel; grep v `dist` nenasel god mode texty. | Dostupne jen ve Vite DEV, toggle `DEV` nebo F10/Ctrl+`. |
| done | Dev Tools | Zamknout god mode mimo produkcni hru. | Produkcni `dist` neobsahuje panel texty/CSS; `Game` dev metody maji DEV guard. | Dev panel je dynamicky importovany jen v DEV. |
| done | Backgroundy | Pripravit vyber backgroundu podle environment condition. | `npm run build` prosel. | Zatim vsechny condition pouzivaji stejny placeholder background. |
| done | Asset Pipeline | Vytvorit `src/render/villageAssets.ts`. | `npm run build` prosel. | Centralizuje atlasove assety budov a terenni tilesety. |
| done | Asset Pipeline | Zobecnit `buildingVisuals.ts` pro atlasove budovy. | `npm run build` prosel. | Manifest mapuje herni level na staticky atlas frame; atlasova animacni logika byla odstranena. |
| done | Asset Pipeline | Pripravit prvni atlas strukturu. | `npm run build` prosel; produkcni bundle pouziva `main-building-atlas`. | Main Building ma 20 statickych levelu v atlasu `5x4`, kazdy frame `256x256`; pohyb zustava v Pixi efektech. |
| done | Rendering | Doladit Pixi efekty hlavni budovy pro 20-level atlas. | `npm run build` prosel. | Efekty pouzivaji adaptivni effect bounds podle levelu, ne plnou atlas bunku. |
| done | Cleanup | Odstranit legacy spritesheet/fps kod kolem budov. | `npm run build` prosel. | `villageAssets` zustava atlas-only; rozestavena budova ma vlastni pixel-art asset. |
| done | Asset Pipeline | Odstranit canvas fallbacky pro chybejici sprity. | `npm run build` prosel. | Produkcni budovy maji explicitni atlasove assety. |
| todo | Verification | Pridat rychly manualni test scenare. | Lze projit nova hra, snezeni a shelter crisis. | Pozdeji automatizovat, pokud se stabilizuje UI. |
