# Lost Land Game Work

Tahle slozka drzi pracovni plan hry: rozhodnuti, checklisty a dalsi veci,
ktere nechceme ztratit mezi jednotlivymi implementacnimi tahy.

## Soubory

- [environment-and-textures-plan.md](./environment-and-textures-plan.md) - aktualni plan pro environment hrozby, pozadi, stavebni atlasy a Pixi efekty.
- [feature-checklist.md](./feature-checklist.md) - prubezny checker, co je hotovo, co je rozpracovane a jak se to ma overit.

## Aktualni stav

- Environment mechaniky jsou ve hre jako sirsi system, ne jen pocasi.
- Globální herni nastaveni je v `src/game/config.ts`.
- Aktivni condition jsou `stable`, `rain`, `snowFront` a `radiation`.
- Snehova fronta umi spustit shelter crisis pro bezdomovce.
- Radiace zvysuje zdravotni incidenty a tlaci na moralku.
- Day/night overlay je napojeny na herni clock: den 08:00-22:00, soumrak
  20:00-22:00, svitani 06:00-08:00.
- Hlavni budova ma prvni realny atlas: `5x4` statickych levelu, kazdy `256x256`.
- Animace budov nejsou atlasove smycky. Zivot sceni delaji Pixi efekty nad statickym spritem.
- Ostatni budovy zatim pouzivaji canvas fallback.

## Pravidla pro pouzivani

- Sem patri dlouhodobejsi feature plany a kontrolni seznamy.
- `AGENTS.md` zustava pro instrukce agentum a aktualni technicke preference.
- Konkretni implementacni poznamky udrzuj kratke a pravidelne je prevadej do ukolu nebo rozhodnuti.
- Kdyz se rozhodnuti zmeni, uprav plan i checklist ve stejnem tahu.
