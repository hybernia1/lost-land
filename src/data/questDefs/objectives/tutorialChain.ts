import type { ObjectiveQuestDefinition } from "../types";

export const tutorialObjectiveQuestDefinitions: ObjectiveQuestDefinition[] = [
  {
    "id": "buildStorage",
    "kind": "single",
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "storage",
      "requiredLevel": 1
    },
    "reward": {
      "material": 45,
      "food": 10
    }
  },
  {
    "id": "buildCoalMine",
    "kind": "single",
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "coalMine",
      "requiredLevel": 1
    },
    "reward": {
      "material": 50,
      "coal": 20
    }
  },
  {
    "id": "buildWaterStill",
    "kind": "single",
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "waterStill",
      "requiredLevel": 1
    },
    "reward": {
      "material": 45,
      "water": 12
    }
  },
  {
    "id": "buildHydroponics",
    "kind": "single",
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "hydroponics",
      "requiredLevel": 1
    },
    "reward": {
      "material": 50,
      "food": 18
    }
  },
  {
    "id": "buildDormitory",
    "kind": "single",
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "dormitory",
      "requiredLevel": 1
    },
    "reward": {
      "material": 65,
      "food": 10
    }
  },
  {
    "id": "upgradeStorageLevel2",
    "kind": "chain",
    "chain": {
      "id": "upgradeStorageChain",
      "stage": 1
    },
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "storage",
      "requiredLevel": 2
    },
    "requires": [
      "buildStorage"
    ],
    "reward": {
      "material": 60,
      "coal": 10
    }
  },
  {
    "id": "upgradeStorageLevel3",
    "kind": "chain",
    "chain": {
      "id": "upgradeStorageChain",
      "stage": 2
    },
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "storage",
      "requiredLevel": 3
    },
    "requires": [
      "upgradeStorageLevel2"
    ],
    "reward": {
      "material": 90,
      "food": 20
    }
  },
  {
    "id": "upgradeCoalMineLevel2",
    "kind": "chain",
    "chain": {
      "id": "upgradeCoalMineChain",
      "stage": 1
    },
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "coalMine",
      "requiredLevel": 2
    },
    "requires": [
      "buildCoalMine"
    ],
    "reward": {
      "material": 55,
      "coal": 35
    }
  },
  {
    "id": "upgradeCoalMineLevel3",
    "kind": "chain",
    "chain": {
      "id": "upgradeCoalMineChain",
      "stage": 2
    },
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "coalMine",
      "requiredLevel": 3
    },
    "requires": [
      "upgradeCoalMineLevel2"
    ],
    "reward": {
      "material": 80,
      "coal": 55
    }
  },
  {
    "id": "upgradeHydroponicsLevel2",
    "kind": "chain",
    "chain": {
      "id": "upgradeHydroponicsChain",
      "stage": 1
    },
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "hydroponics",
      "requiredLevel": 2
    },
    "requires": [
      "buildHydroponics"
    ],
    "reward": {
      "food": 30,
      "water": 12,
      "morale": 4
    }
  },
  {
    "id": "upgradeHydroponicsLevel3",
    "kind": "chain",
    "chain": {
      "id": "upgradeHydroponicsChain",
      "stage": 2
    },
    "trigger": "buildingLevelChanged",
    "target": {
      "type": "buildingLevel",
      "buildingId": "hydroponics",
      "requiredLevel": 3
    },
    "requires": [
      "upgradeHydroponicsLevel2"
    ],
    "reward": {
      "food": 48,
      "water": 18,
      "morale": 6
    }
  },
  {
    "id": "reachPopulationChain06",
    "kind": "chain",
    "chain": {
      "id": "reachPopulationChain",
      "stage": 1
    },
    "trigger": "populationChanged",
    "target": {
      "type": "populationAtLeast",
      "requiredPopulation": 6
    },
    "reward": {
      "material": 30,
      "food": 14,
      "morale": 4
    }
  },
  {
    "id": "reachPopulationChain10",
    "kind": "chain",
    "chain": {
      "id": "reachPopulationChain",
      "stage": 2
    },
    "trigger": "populationChanged",
    "target": {
      "type": "populationAtLeast",
      "requiredPopulation": 10
    },
    "requires": [
      "reachPopulationChain06"
    ],
    "reward": {
      "material": 45,
      "food": 20,
      "morale": 6
    }
  },
  {
    "id": "reachPopulationChain14",
    "kind": "chain",
    "chain": {
      "id": "reachPopulationChain",
      "stage": 3
    },
    "trigger": "populationChanged",
    "target": {
      "type": "populationAtLeast",
      "requiredPopulation": 14
    },
    "requires": [
      "reachPopulationChain10"
    ],
    "reward": {
      "material": 60,
      "food": 28,
      "morale": 8
    }
  },
  {
    "id": "lootSettlementChain01",
    "kind": "chain",
    "chain": {
      "id": "lootSettlementChain",
      "stage": 1
    },
    "trigger": "resourceSitesLootedChanged",
    "target": {
      "type": "resourceSitesLootedAtLeast",
      "requiredCount": 1
    },
    "requires": [
      "reachPopulationChain10"
    ],
    "reward": {
      "material": 40,
      "coal": 18,
      "morale": 6
    }
  },
  {
    "id": "lootSettlementChain02",
    "kind": "chain",
    "chain": {
      "id": "lootSettlementChain",
      "stage": 2
    },
    "trigger": "resourceSitesLootedChanged",
    "target": {
      "type": "resourceSitesLootedAtLeast",
      "requiredCount": 2
    },
    "requires": [
      "lootSettlementChain01"
    ],
    "reward": {
      "material": 55,
      "coal": 28,
      "morale": 8
    }
  },
  {
    "id": "lootSettlementChain05",
    "kind": "chain",
    "chain": {
      "id": "lootSettlementChain",
      "stage": 3
    },
    "trigger": "resourceSitesLootedChanged",
    "target": {
      "type": "resourceSitesLootedAtLeast",
      "requiredCount": 5
    },
    "requires": [
      "lootSettlementChain02"
    ],
    "reward": {
      "material": 85,
      "coal": 45,
      "morale": 12
    }
  }
];
