import type {
  BuildingId,
  ObjectiveQuestId,
  ResourceBag,
  ResourceId,
  SuddenQuestId,
} from "../game/types";

export type ObjectiveQuestDefinition = {
  id: ObjectiveQuestId;
  buildingId: BuildingId;
  requiredLevel: number;
  prerequisiteIds?: ObjectiveQuestId[];
  reward: ResourceBag;
};

export type SuddenQuestDefinition = {
  id: SuddenQuestId;
  minElapsedSeconds: number;
  weight: number;
  resourceLossPercent?: Partial<Record<ResourceId, number>>;
};

export const objectiveQuestDefinitions: ObjectiveQuestDefinition[] = [
  {
    id: "buildStorage",
    buildingId: "storage",
    requiredLevel: 1,
    reward: { material: 45, food: 10 },
  },
  {
    id: "buildGenerator",
    buildingId: "generator",
    requiredLevel: 1,
    prerequisiteIds: ["buildStorage"],
    reward: { material: 50, coal: 20 },
  },
  {
    id: "buildWaterStill",
    buildingId: "waterStill",
    requiredLevel: 1,
    prerequisiteIds: ["buildGenerator"],
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

export const suddenQuestDefinitions: SuddenQuestDefinition[] = [
  {
    id: "cropSpoilage",
    minElapsedSeconds: 0,
    weight: 4,
    resourceLossPercent: {
      food: 0.18,
    },
  },
];

export const objectiveQuestById = Object.fromEntries(
  objectiveQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<ObjectiveQuestId, ObjectiveQuestDefinition>;

export const suddenQuestById = Object.fromEntries(
  suddenQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<SuddenQuestId, SuddenQuestDefinition>;
