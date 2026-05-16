import type { MapNpcKindId } from "./mapNpcs";
import type { CombatUnitId } from "../game/types";

export const combatUnitNpcKindById: Record<CombatUnitId, MapNpcKindId> = {
  footman: "footmanFlea",
  archer: "archerFlea",
  bulwark: "bulwarkFlea",
  rat: "ratFlea",
  spider: "spiderFlea",
  snake: "snakeFlea",
  wolf: "wolfFlea",
  zombie: "zombieFlea",
  bandit: "banditFlea",
  berserkerZombie: "berserkerZombieFlea",
};
