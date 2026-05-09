import type {
  BuildingId,
  DecisionOptionId,
  DecisionQuestId,
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

export type DecisionQuestOptionDefinition = {
  id: DecisionOptionId;
  resources?: ResourceBag;
  workers?: number;
  injured?: number;
  morale?: number;
};

export type DecisionQuestDefinition = {
  id: DecisionQuestId;
  minElapsedSeconds: number;
  weight: number;
  options: DecisionQuestOptionDefinition[];
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
    reward: { material: 50, energy: 20 },
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
  {
    id: "buildPalisade",
    buildingId: "palisade",
    requiredLevel: 1,
    prerequisiteIds: ["buildDormitory"],
    reward: { material: 60, morale: 2 },
  },
];

export const decisionQuestDefinitions: DecisionQuestDefinition[] = [
  {
    id: "survivorsAtGate",
    minElapsedSeconds: 0,
    weight: 5,
    options: [
      {
        id: "accept",
        resources: { food: -5 },
        workers: 2,
        injured: 1,
      },
      {
        id: "refuse",
      },
      {
        id: "execute",
        morale: -5,
      },
    ],
  },
  {
    id: "rationDispute",
    minElapsedSeconds: 0,
    weight: 3,
    options: [
      {
        id: "share",
        resources: { food: -6 },
        morale: 4,
      },
      {
        id: "guards",
        morale: -4,
      },
      {
        id: "ignore",
      },
    ],
  },
  {
    id: "radioCall",
    minElapsedSeconds: 0,
    weight: 2,
    options: [
      {
        id: "answer",
        resources: { energy: -6, material: 14 },
      },
      {
        id: "listen",
        resources: { energy: -2 },
        morale: 2,
      },
      {
        id: "silence",
      },
    ],
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

export const decisionQuestById = Object.fromEntries(
  decisionQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<DecisionQuestId, DecisionQuestDefinition>;

export const suddenQuestById = Object.fromEntries(
  suddenQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<SuddenQuestId, SuddenQuestDefinition>;
