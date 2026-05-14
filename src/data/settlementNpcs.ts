import type { BuildingId } from "../game/types";
import type { MapNpcKindId } from "./mapNpcs";

export type SettlementNpcRequirement = "workers" | "troops";

export type SettlementNpcDefinition = {
  buildingId: BuildingId;
  npcKindId: MapNpcKindId;
  requirement: SettlementNpcRequirement;
  maxCount: number;
  wanderRadius: number;
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
    buildingId: "generator",
    npcKindId: "peonFlea",
    requirement: "workers",
    maxCount: 2,
    wanderRadius: 92,
  },
  {
    buildingId: "barracks",
    npcKindId: "soldierFlea",
    requirement: "troops",
    maxCount: 3,
    wanderRadius: 92,
  },
  {
    buildingId: "watchtower",
    npcKindId: "soldierFlea",
    requirement: "troops",
    maxCount: 2,
    wanderRadius: 76,
  },
];

export const settlementNpcByBuildingId = Object.fromEntries(
  settlementNpcDefinitions.map((definition) => [definition.buildingId, definition]),
) as Partial<Record<BuildingId, SettlementNpcDefinition>>;
