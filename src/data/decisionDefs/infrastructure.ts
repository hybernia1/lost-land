import type { DecisionQuestDefinition } from "./types";

export const infrastructureDecisionQuestDefinitions: DecisionQuestDefinition[] = [
  {
    id: "radioCall",
    minElapsedSeconds: 0,
    weight: 2,
    options: [
      {
        id: "answer",
        resources: { coal: -6, material: 14 },
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: -2,
        },
      },
      {
        id: "listen",
        resources: { coal: -2 },
        morale: 2,
        profileScores: {
          communityMarket: -1,
          authorityAutonomy: -1,
        },
      },
      {
        id: "silence",
        profileScores: {
          authorityAutonomy: 1,
        },
      },
    ],
  },
  {
    id: "traderAtDusk",
    minElapsedSeconds: 0,
    weight: 3,
    options: [
      {
        id: "tradeFood",
        resources: { food: -8, material: 18 },
        profileScores: {
          communityMarket: 2,
          authorityAutonomy: -1,
        },
      },
      {
        id: "tradeWater",
        resources: { water: -8, coal: 6 },
        profileScores: {
          communityMarket: 2,
          authorityAutonomy: -1,
        },
      },
      {
        id: "refuse",
        profileScores: {
          authorityAutonomy: 1,
        },
      },
    ],
  },
  {
    id: "coalMineSpareParts",
    minElapsedSeconds: 0,
    weight: 2,
    options: [
      {
        id: "install",
        resources: { material: -10, coal: 14 },
        profileScores: {
          communityMarket: 1,
        },
      },
      {
        id: "store",
        resources: { material: 8 },
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 1,
        },
      },
      {
        id: "trade",
        resources: { coal: -4, food: 8 },
        profileScores: {
          communityMarket: 2,
          authorityAutonomy: -1,
        },
      },
    ],
  },
  {
    id: "collapsedUnderpass",
    minElapsedSeconds: 0,
    weight: 2,
    options: [
      {
        id: "digOut",
        resources: { food: -4, material: 16 },
        profileScores: {
          communityMarket: -2,
          authorityAutonomy: -1,
        },
      },
      {
        id: "markDanger",
        resources: { material: -4 },
        morale: 1,
        profileScores: {
          communityMarket: -1,
          authorityAutonomy: 2,
        },
      },
      {
        id: "leaveIt",
        morale: -2,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 1,
        },
      },
    ],
  },
  {
    id: "brokenWaterFilter",
    minElapsedSeconds: 0,
    weight: 3,
    options: [
      {
        id: "repair",
        resources: { material: -10, water: 12 },
        profileScores: {
          communityMarket: 1,
        },
      },
      {
        id: "ration",
        resources: { water: -5 },
        morale: -2,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 2,
        },
      },
      {
        id: "riskDirtyWater",
        injured: 1,
        morale: -1,
        profileScores: {
          communityMarket: -1,
          authorityAutonomy: -2,
        },
      },
    ],
  },
];
