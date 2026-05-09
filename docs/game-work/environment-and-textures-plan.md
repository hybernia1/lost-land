# Environment And Texture Plan

## Proc to delame

Lost Land ma byt browserova strategie, kde svet okolo vesnice neni jen kulisa.
Environment hrozby maji menit rozhodovani hrace a vizualni stav mapy ma hraci
rychle rict, ze se situace zmenila.

Spojujeme proto dve vrstvy:

- gameplay system pro environment hrozby
- vizualni system pro pozadi, overlaye, stavebni atlasy a Pixi efekty

## Aktualni rozhodnuti

- Nepouzivat rocni obdobi jako hlavni osu. Svet kolem roku 2045 muze posilat
  nahodne fronty, radiacni vlny a dalsi anomalie.
- Nepojmenovavat system jen `weather`. Pouzivame sirsi pojem `environment`,
  protoze radiace, toxicka mlha nebo popelovy spad patri do stejne rodiny
  systemu jako dest nebo snih.
- Mechaniky maji mit prednost pred finalnim artem. Vizuály nasleduji pravidla
  hry, ne obracene.
- Aktualni implementovane condition jsou `stable`, `rain`, `snowFront` a
  `radiation`.
- Vliv environmentu na mapu zatim delaji Pixi overlaye/tinty nad sdilenym
  backgroundem. Samostatne backgroundy podle condition jsou pripraveny v
  `src/render/villageAssets.ts`, ale zatim pouzivaji stejny placeholder obrazek.
- Day/night je vizualni rezim odvozeny z herniho clocku. Den zacina v 08:00,
  noc zacina ve 22:00, svitani bezi 06:00-08:00 a soumrak 20:00-22:00.
- Budovy nepouzivaji atlasove animacni smycky. Atlas drzi staticke stavebni
  levely; pohyb a zivot sceni patri do Pixi efektu.

## Implementovany stav

```ts
type EnvironmentConditionId =
  | "stable"
  | "rain"
  | "snowFront"
  | "radiation";

type EnvironmentState = {
  condition: EnvironmentConditionId;
  intensity: number;
  startedAt: number;
  endsAt: number;
  nextConditionAt: number;
  activeCrisis: EnvironmentCrisisState | null;
};

type EnvironmentCrisisState = {
  kind: "shelter";
  startedAt: number;
  deadlineAt: number;
  initialHomeless: number;
  lastWarningAt: number;
};
```

Kodove vlastnictvi:

- `src/data/environment.ts` definuje condition data a intenzity.
- `src/game/config.ts` drzi globalni tuning, napr. delku dne, hranice den/noc,
  environment intervaly, autosave, scouting a market cooldown.
- `src/systems/environment.ts` resi prechody, trvani a shelter crisis.
- `src/systems/health.ts` bere environment jako zdroj zdravotnich incidentu.
- `src/systems/buildings.ts` zahrnuje environment moralni dopad do resource
  breakdownu.
- `src/render/PixiVillageRenderer.ts` kresli environment status a overlaye.
- `src/game/time.ts` drzi denni cas, daylight faze a hranice den/noc.
- `src/dev/godMode.ts` umi environment stavy testovat jen ve Vite DEV.

## Snehova Fronta

Kdyz zacne `snowFront` a `getHousingStatus(state).homeless > 0`, vznikne
shelter crisis.

Pravidla:

- log upozorni, ze zacala snehova fronta a X lidi nema pristresi
- hrac dostane casovy limit podle intenzity
- krize se sama vyresi, pokud `homeless === 0`
- pokud deadline dobehne a bezdomovci zustanou, nasleduji zraneni/umrti a
  pokles moralky
- dormitory bez uhli se nepocita jako funkcni ubytovani, coz sedi na existujici
  pravidlo vytapeni

## Radiace

Radiace je `environment` condition:

- ma zacatek, intenzitu, trvani a dalsi naplanovanou zmenu
- zvysuje sanci na zdravotni incidenty
- ubira moralku podle intenzity
- vizualne pouziva zeleny tint/scanline overlay

Pozdejsi smer:

- navazat ochranu pred radiaci na upgrade hlavni budovy, Clinic nebo specialni
  modul
- pridat toxickou mlhu/popelovy spad jako dalsi environment condition, az bude
  jasne, jak se maji mechanicky lisit

## Textury Budov

Aktualni cil neni animovat samotny atlas. Atlas ma drzet ciste, citelne stavebni
stupne. Animace patri do Pixi vrstev, aby se neblikala okna ani nehybala cela
budova.

Soucasny stav:

- `src/assets/buildings/main-building-atlas.png`
- `src/assets/buildings/main-building-atlas.json`
- atlas hlavni budovy ma `5x4` bunek
- kazdy frame ma `256x256`
- frame order je level 1 az 20 zleva doprava, shora dolu
- level 1 je chuda chatrc, level 20 je velka low-tech plechova zakladna
- `src/data/buildingVisuals.ts` mapuje herni level primo na staticky frame
- `src/render/villageAssets.ts` nacita atlasy a drzi canvas fallbacky pro budovy
  bez hotoveho spritu
- `src/render/PixiVillageRenderer.ts` kresli adaptivni Pixi efekty nad hlavni
  budovou podle levelu

Palisade je specialni pripad. Je to perimeter building, ne bezny plot sprite.
Muze zustat kreslena samostatne nebo mit vlastni sirsi asset.

## Day/Night

Day/night zatim neni samostatna hrozba. Je to vizualni vrstva a sdilena casova
pravda pro system smen.

Soucasna pravidla:

- nova hra zacina v 08:00
- denni svetlo zacina v 08:00
- denni smena konci a noc zacina ve 22:00
- svitani je plynuly prechod 06:00-08:00
- soumrak je plynuly prechod 20:00-22:00
- noc ztmavi cely world layer, ne jen pozadi
- HUD zustava cisty a ctelny

Pozdejsi smer:

- pridat mechanicky dopad noci na hordy, pruzkum nebo spotrebu uhli
- pridat samostatne nocni varianty backgroundu, pokud overlay nebude stacit
- navazat vetsi nocni riziko na watchtower/palisade/svetla

## Dalsi Kroky

1. Manualne projit day/night prechod v herni scene na casech 06:00, 08:00,
   20:00, 22:00 a 00:00.
2. Udelat samostatne backgroundy pro `rain`, `snowFront` a `radiation`.
3. Pridat dalsi budovu do atlas pipeline, idealne Dormitory nebo Storage.
4. Rozhodnout, jestli vsechny budovy budou mit 20 levelu, nebo jen hlavni
   budova a ostatni zustanou u mensiho poctu vizualnich stupnu.
5. Manualne projit hlavni budovu na levelech 1, 5, 10, 15 a 20 v herni scene.
6. Pozdeji zvazit kompresi atlasu do WebP/AVIF podle Electron/browser podpory.

## Co Zatim Nedelat

- Nedelat seasonal kalendar.
- Nedelat finalni detailni art pro vsechny budovy pred overenim prvni atlas
  pipeline.
- Nedelat radiaci jako samostatny questovy system mimo environment.
- Nedavat snih, radiaci nebo vypnute uhli jako dalsi atlasove varianty kazde
  budovy. Tyto stavy maji byt overlay/tint/effect vrstva, pokud zustanou
  citelne.
