import type { DecisionQuestDraftDefinition } from "./types";

export const openingDecisionQuestDefinitions: DecisionQuestDraftDefinition[] = [
  {
    "id": "foundingBriefing",
    "minElapsedSeconds": Number.MAX_SAFE_INTEGER,
    "weight": 0,
    "options": [
      {
        "id": "fortify",
        "resources": {
          "material": -10,
          "coal": -4
        },
        "morale": 1,
        "profileScores": {
          "communityMarket": -1,
          "authorityAutonomy": 2
        }
      },
      {
        "id": "scoutRumors",
        "resources": {
          "food": -4,
          "water": -4
        },
        "workers": 1,
        "profileScores": {
          "communityMarket": -1,
          "authorityAutonomy": -1
        }
      },
      {
        "id": "emberOath",
        "resources": {
          "coal": -2
        },
        "morale": 4,
        "profileScores": {
          "communityMarket": -2,
          "authorityAutonomy": -1
        }
      }
    ]
  }
];


