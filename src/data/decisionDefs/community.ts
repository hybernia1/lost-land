import type { DecisionQuestDraftDefinition } from "./types";

export const communityDecisionQuestDefinitions: DecisionQuestDraftDefinition[] = [
  {
    "id": "survivorsAtGate",
    "minElapsedSeconds": 0,
    "weight": 5,
    "options": [
      {
        "id": "accept",
        "resources": {
          "food": -5
        },
        "workers": 2,
        "injured": 1,
        "profileScores": {
          "communityMarket": -2,
          "authorityAutonomy": -1
        }
      },
      {
        "id": "refuse",
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 1
        }
      },
      {
        "id": "execute",
        "morale": -5,
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 2
        }
      }
    ]
  },
  {
    "id": "rationDispute",
    "minElapsedSeconds": 0,
    "weight": 3,
    "options": [
      {
        "id": "share",
        "resources": {
          "food": -6
        },
        "morale": 4,
        "profileScores": {
          "communityMarket": -2,
          "authorityAutonomy": -1
        }
      },
      {
        "id": "guards",
        "morale": -4,
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 2
        }
      },
      {
        "id": "ignore",
        "profileScores": {
          "authorityAutonomy": -1
        }
      }
    ]
  },
  {
    "id": "bittenStranger",
    "minElapsedSeconds": 0,
    "weight": 3,
    "options": [
      {
        "id": "isolate",
        "resources": {
          "food": -3
        },
        "injured": 1,
        "morale": 1,
        "profileScores": {
          "communityMarket": -1,
          "authorityAutonomy": 1
        }
      },
      {
        "id": "turnAway",
        "morale": -2,
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 1
        }
      },
      {
        "id": "execute",
        "morale": -6,
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 2
        }
      }
    ]
  },
  {
    "id": "nightScreams",
    "minElapsedSeconds": 0,
    "weight": 3,
    "options": [
      {
        "id": "sendPatrol",
        "resources": {
          "food": -3
        },
        "workers": -3,
        "morale": -4,
        "profileScores": {
          "communityMarket": -2,
          "authorityAutonomy": -2
        }
      },
      {
        "id": "signal",
        "resources": {
          "coal": -4
        },
        "morale": 2,
        "profileScores": {
          "communityMarket": -1,
          "authorityAutonomy": -1
        }
      },
      {
        "id": "stayQuiet",
        "morale": -2,
        "profileScores": {
          "authorityAutonomy": 1
        }
      }
    ]
  },
  {
    "id": "waterTheft",
    "minElapsedSeconds": 0,
    "weight": 3,
    "options": [
      {
        "id": "amnesty",
        "resources": {
          "water": -5
        },
        "morale": 3,
        "profileScores": {
          "communityMarket": -2,
          "authorityAutonomy": -1
        }
      },
      {
        "id": "punish",
        "morale": -3,
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 2
        }
      },
      {
        "id": "rationLock",
        "resources": {
          "material": -6
        },
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 2
        }
      }
    ]
  },
  {
    "id": "provenTheft",
    "minElapsedSeconds": 0,
    "weight": 3,
    "options": [
      {
        "id": "exile",
        "workers": -1,
        "morale": -2,
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 1
        }
      },
      {
        "id": "maim",
        "workers": -1,
        "injured": 1,
        "morale": -6,
        "profileScores": {
          "communityMarket": 1,
          "authorityAutonomy": 2
        }
      },
      {
        "id": "forgive",
        "resources": {
          "material": -12,
          "food": -4
        },
        "morale": 3,
        "profileScores": {
          "communityMarket": -2,
          "authorityAutonomy": -1
        }
      }
    ]
  }
];


