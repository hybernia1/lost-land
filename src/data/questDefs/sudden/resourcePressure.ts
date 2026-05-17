import type { SuddenQuestDefinition } from "../types";

export const resourcePressureSuddenQuestDefinitions: SuddenQuestDefinition[] = [
  {
    id: "cropSpoilage",
    minElapsedSeconds: 0,
    weight: 4,
    resourceLossPercent: {
      food: 0.18,
    },
  },
];
