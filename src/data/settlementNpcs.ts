import type { BuildingId, EnemyUnitId } from "../game/types";
import type { MapNpcKindId } from "./mapNpcs";

export type SettlementNpcRequirement = "workers" | "footman" | "archer" | "bulwark";

export type SettlementNpcDefinition = {
  buildingId: BuildingId;
  npcKindId: MapNpcKindId;
  requirement: SettlementNpcRequirement;
  maxCount: number;
  wanderRadius: number;
};

export type ResourceSiteNpcDefinition = {
  npcKindId: MapNpcKindId;
  maxCount: number;
  wanderRadius: number;
};

export type ResourceSiteEnemyNpcDefinition = ResourceSiteNpcDefinition & {
  enemyUnitId: EnemyUnitId;
};

export const settlementNpcDefinitions: SettlementNpcDefinition[] = [
  {
    buildingId: "hydroponics",
    npcKindId: "peonFlea",
    requirement: "workers",
    maxCount: 2,
    wanderRadius: 92,
  },
  {
    buildingId: "waterStill",
    npcKindId: "peonFlea",
    requirement: "workers",
    maxCount: 2,
    wanderRadius: 84,
  },
  {
    buildingId: "workshop",
    npcKindId: "peonFlea",
    requirement: "workers",
    maxCount: 2,
    wanderRadius: 88,
  },
  {
    buildingId: "coalMine",
    npcKindId: "peonFlea",
    requirement: "workers",
    maxCount: 2,
    wanderRadius: 92,
  },
  {
    buildingId: "barracks",
    npcKindId: "footmanFlea",
    requirement: "footman",
    maxCount: 2,
    wanderRadius: 92,
  },
  {
    buildingId: "barracks",
    npcKindId: "archerFlea",
    requirement: "archer",
    maxCount: 2,
    wanderRadius: 92,
  },
  {
    buildingId: "barracks",
    npcKindId: "bulwarkFlea",
    requirement: "bulwark",
    maxCount: 1,
    wanderRadius: 86,
  },
  {
    buildingId: "watchtower",
    npcKindId: "footmanFlea",
    requirement: "footman",
    maxCount: 1,
    wanderRadius: 76,
  },
  {
    buildingId: "watchtower",
    npcKindId: "archerFlea",
    requirement: "archer",
    maxCount: 2,
    wanderRadius: 76,
  },
  {
    buildingId: "watchtower",
    npcKindId: "bulwarkFlea",
    requirement: "bulwark",
    maxCount: 1,
    wanderRadius: 70,
  },
];

export const settlementNpcByBuildingId = settlementNpcDefinitions.reduce(
  (byBuildingId, definition) => {
    byBuildingId[definition.buildingId] ??= [];
    byBuildingId[definition.buildingId]?.push(definition);
    return byBuildingId;
  },
  {} as Partial<Record<BuildingId, SettlementNpcDefinition[]>>,
);

export const resourceSiteEnemyNpcDefinitions: ResourceSiteEnemyNpcDefinition[] = [
  {
    enemyUnitId: "rat",
    npcKindId: "ratFlea",
    maxCount: 4,
    wanderRadius: 118,
  },
  {
    enemyUnitId: "spider",
    npcKindId: "spiderFlea",
    maxCount: 3,
    wanderRadius: 104,
  },
  {
    enemyUnitId: "snake",
    npcKindId: "snakeFlea",
    maxCount: 3,
    wanderRadius: 110,
  },
  {
    enemyUnitId: "wolf",
    npcKindId: "wolfFlea",
    maxCount: 3,
    wanderRadius: 124,
  },
  {
    enemyUnitId: "zombie",
    npcKindId: "zombieFlea",
    maxCount: 3,
    wanderRadius: 96,
  },
  {
    enemyUnitId: "bandit",
    npcKindId: "banditFlea",
    maxCount: 3,
    wanderRadius: 112,
  },
  {
    enemyUnitId: "berserkerZombie",
    npcKindId: "berserkerZombieFlea",
    maxCount: 2,
    wanderRadius: 92,
  },
];
