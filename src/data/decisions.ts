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
          philanthropyPrinciple: -2,
          mercySecurity: -2,
          opennessCaution: -1,
        },
      },
      {
        id: "refuse",
        profileScores: {
          philanthropyPrinciple: 1,
          mercySecurity: 1,
          opennessCaution: 1,
        },
      },
      {
        id: "execute",
        morale: -5,
        profileScores: {
          philanthropyPrinciple: 2,
          mercySecurity: 2,
          opennessCaution: 1,
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
          philanthropyPrinciple: -2,
          mercySecurity: -1,
        },
      },
      {
        id: "guards",
        morale: -4,
        profileScores: {
          philanthropyPrinciple: 2,
          mercySecurity: 1,
        },
      },
      {
        id: "ignore",
        profileScores: {
          opennessCaution: 1,
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
          opennessCaution: -2,
        },
      },
      {
        id: "listen",
        resources: { coal: -2 },
        morale: 2,
        profileScores: {
          philanthropyPrinciple: -1,
          opennessCaution: -1,
        },
      },
      {
        id: "silence",
        profileScores: {
          opennessCaution: 2,
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
          philanthropyPrinciple: -1,
          mercySecurity: -1,
          opennessCaution: 1,
        },
      },
      {
        id: "turnAway",
        morale: -2,
        profileScores: {
          philanthropyPrinciple: 1,
          mercySecurity: 1,
          opennessCaution: 1,
        },
      },
      {
        id: "execute",
        morale: -6,
        profileScores: {
          philanthropyPrinciple: 2,
          mercySecurity: 2,
          opennessCaution: 1,
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
          philanthropyPrinciple: 1,
          opennessCaution: -1,
        },
      },
      {
        id: "tradeWater",
        resources: { water: -8, coal: 6 },
        profileScores: {
          philanthropyPrinciple: 1,
          opennessCaution: -1,
        },
      },
      {
        id: "refuse",
        profileScores: {
          opennessCaution: 2,
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
          philanthropyPrinciple: -2,
          mercySecurity: -1,
          opennessCaution: -2,
        },
      },
      {
        id: "signal",
        resources: { coal: -4 },
        morale: 2,
        profileScores: {
          philanthropyPrinciple: -1,
          opennessCaution: -1,
        },
      },
      {
        id: "stayQuiet",
        morale: -2,
        profileScores: {
          mercySecurity: 1,
          opennessCaution: 2,
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
          philanthropyPrinciple: -2,
          mercySecurity: -2,
        },
      },
      {
        id: "punish",
        morale: -3,
        profileScores: {
          philanthropyPrinciple: 2,
          mercySecurity: 2,
        },
      },
      {
        id: "rationLock",
        resources: { material: -6 },
        profileScores: {
          philanthropyPrinciple: 1,
          mercySecurity: 1,
          opennessCaution: 1,
        },
      },
    ],
  },
  {
    id: "generatorSpareParts",
    minElapsedSeconds: 0,
    weight: 2,
    options: [
      {
        id: "install",
        resources: { material: -10, coal: 14 },
        profileScores: {
          philanthropyPrinciple: 1,
        },
      },
      {
        id: "store",
        resources: { material: 8 },
        profileScores: {
          opennessCaution: 1,
        },
      },
      {
        id: "trade",
        resources: { coal: -4, food: 8 },
        profileScores: {
          philanthropyPrinciple: -1,
          opennessCaution: -1,
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
          philanthropyPrinciple: 1,
          mercySecurity: 1,
          opennessCaution: 1,
        },
      },
      {
        id: "maim",
        workers: -1,
        injured: 1,
        morale: -6,
        profileScores: {
          philanthropyPrinciple: 2,
          mercySecurity: 2,
        },
      },
      {
        id: "forgive",
        resources: { material: -12, food: -4 },
        morale: 3,
        profileScores: {
          philanthropyPrinciple: -2,
          mercySecurity: -2,
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
          philanthropyPrinciple: -2,
          opennessCaution: -1,
        },
      },
      {
        id: "markDanger",
        resources: { material: -4 },
        morale: 1,
        profileScores: {
          philanthropyPrinciple: 1,
          mercySecurity: 1,
          opennessCaution: 1,
        },
      },
      {
        id: "leaveIt",
        morale: -2,
        profileScores: {
          philanthropyPrinciple: 2,
          opennessCaution: 1,
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
          philanthropyPrinciple: 1,
        },
      },
      {
        id: "ration",
        resources: { water: -5 },
        morale: -2,
        profileScores: {
          philanthropyPrinciple: 2,
          mercySecurity: 1,
        },
      },
      {
        id: "riskDirtyWater",
        injured: 1,
        morale: -1,
        profileScores: {
          philanthropyPrinciple: -1,
          mercySecurity: -2,
          opennessCaution: -1,
        },
      },
    ],
  },
];

export const decisionQuestById = Object.fromEntries(
  decisionQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<DecisionQuestId, DecisionQuestDefinition>;
