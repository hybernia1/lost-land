import type { ObjectiveQuestDefinition } from "../types";

export const tutorialObjectiveQuestDefinitions: ObjectiveQuestDefinition[] = [
  {
    id: "buildStorage",
    buildingId: "storage",
    requiredLevel: 1,
    reward: { material: 45, food: 10 },
  },
  {
    id: "buildCoalMine",
    buildingId: "coalMine",
    requiredLevel: 1,
    prerequisiteIds: ["buildStorage"],
    reward: { material: 50, coal: 20 },
  },
  {
    id: "buildWaterStill",
    buildingId: "waterStill",
    requiredLevel: 1,
    prerequisiteIds: ["buildCoalMine"],
    reward: { material: 45, water: 12 },
  },
  {
    id: "buildHydroponics",
    buildingId: "hydroponics",
    requiredLevel: 1,
    prerequisiteIds: ["buildWaterStill"],
    reward: { material: 50, food: 18 },
  },
  {
    id: "buildDormitory",
    buildingId: "dormitory",
    requiredLevel: 1,
    prerequisiteIds: ["buildHydroponics"],
    reward: { material: 65, food: 10 },
  },
];
