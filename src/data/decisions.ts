import type {
  DecisionProfileAxisId,
  DecisionOptionId,
  DecisionQuestId,
  ResourceBag,
} from "../game/types";

export type DecisionQuestOptionDefinition = {
  id: DecisionOptionId;
  resources?: ResourceBag;
  workers?: number;
  injured?: number;
  morale?: number;
  profileScores?: Partial<Record<DecisionProfileAxisId, number>>;
};

export type DecisionQuestDefinition = {
  id: DecisionQuestId;
  minElapsedSeconds: number;
  weight: number;
  options: DecisionQuestOptionDefinition[];
};

export const decisionQuestDefinitions: DecisionQuestDefinition[] = [
  {
    id: "foundingBriefing",
    minElapsedSeconds: Number.MAX_SAFE_INTEGER,
    weight: 0,
    options: [
      {
        id: "fortify",
        resources: { material: -10, coal: -4 },
        morale: 1,
        profileScores: {
          communityMarket: -1,
          authorityAutonomy: 2,
        },
      },
      {
        id: "scoutRumors",
        resources: { food: -4, water: -4 },
        workers: 1,
        profileScores: {
          communityMarket: -1,
          authorityAutonomy: -1,
        },
      },
      {
        id: "emberOath",
        resources: { coal: -2 },
        morale: 4,
        profileScores: {
          communityMarket: -2,
          authorityAutonomy: -1,
        },
      },
    ],
  },
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
        profileScores: {
          communityMarket: -2,
          authorityAutonomy: -1,
        },
      },
      {
        id: "refuse",
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 1,
        },
      },
      {
        id: "execute",
        morale: -5,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 2,
        },
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
        profileScores: {
          communityMarket: -2,
          authorityAutonomy: -1,
        },
      },
      {
        id: "guards",
        morale: -4,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 2,
        },
      },
      {
        id: "ignore",
        profileScores: {
          authorityAutonomy: -1,
        },
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
    id: "bittenStranger",
    minElapsedSeconds: 0,
    weight: 3,
    options: [
      {
        id: "isolate",
        resources: { food: -3 },
        injured: 1,
        morale: 1,
        profileScores: {
          communityMarket: -1,
          authorityAutonomy: 1,
        },
      },
      {
        id: "turnAway",
        morale: -2,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 1,
        },
      },
      {
        id: "execute",
        morale: -6,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 2,
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
    id: "nightScreams",
    minElapsedSeconds: 0,
    weight: 3,
    options: [
      {
        id: "sendPatrol",
        resources: { food: -3 },
        workers: -3,
        morale: -4,
        profileScores: {
          communityMarket: -2,
          authorityAutonomy: -2,
        },
      },
      {
        id: "signal",
        resources: { coal: -4 },
        morale: 2,
        profileScores: {
          communityMarket: -1,
          authorityAutonomy: -1,
        },
      },
      {
        id: "stayQuiet",
        morale: -2,
        profileScores: {
          authorityAutonomy: 1,
        },
      },
    ],
  },
  {
    id: "waterTheft",
    minElapsedSeconds: 0,
    weight: 3,
    options: [
      {
        id: "amnesty",
        resources: { water: -5 },
        morale: 3,
        profileScores: {
          communityMarket: -2,
          authorityAutonomy: -1,
        },
      },
      {
        id: "punish",
        morale: -3,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 2,
        },
      },
      {
        id: "rationLock",
        resources: { material: -6 },
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 2,
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
    id: "provenTheft",
    minElapsedSeconds: 0,
    weight: 3,
    options: [
      {
        id: "exile",
        workers: -1,
        morale: -2,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 1,
        },
      },
      {
        id: "maim",
        workers: -1,
        injured: 1,
        morale: -6,
        profileScores: {
          communityMarket: 1,
          authorityAutonomy: 2,
        },
      },
      {
        id: "forgive",
        resources: { material: -12, food: -4 },
        morale: 3,
        profileScores: {
          communityMarket: -2,
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

export const decisionQuestById = Object.fromEntries(
  decisionQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<DecisionQuestId, DecisionQuestDefinition>;
