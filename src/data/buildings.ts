import type { BuildingDefinition, BuildingId } from "../game/types";
import { createBuildingLevelRequirements, MAX_BUILDING_LEVEL } from "./buildingProgression";

type BuildingDefinitionInput = Omit<
  BuildingDefinition,
  "maxLevel" | "levelRequirements"
> & {
  maxLevel?: number;
};

const buildingDefinitionInputs: BuildingDefinitionInput[] = [
  {
    id: "mainBuilding",
    category: "support",
    name: "Main Building",
    description: "Coordinates construction, housing, and camp decisions.",
    buildSeconds: 24,
    baseConstructionWorkers: 2,
    baseCost: { material: 45 },
    consumes: { energy: 0.01 },
  },
  {
    id: "storage",
    category: "support",
    name: "Storage Depot",
    description: "Raises the stockpile limits for practical supplies.",
    buildSeconds: 28,
    baseConstructionWorkers: 2,
    baseCost: { material: 60 },
    storageBonus: {
      food: 90,
      water: 90,
      material: 130,
    },
    consumes: { energy: 0.005 },
  },
  {
    id: "dormitory",
    category: "housing",
    name: "Dormitory",
    description: "Houses civilian survivors, but needs power, water, and food to stay livable.",
    buildSeconds: 34,
    baseConstructionWorkers: 2,
    baseCost: { material: 85, energy: 6, food: 10, water: 14 },
    alwaysConsumes: { energy: 0.02, food: 0.003, water: 0.006 },
    housing: 10,
  },
  {
    id: "hydroponics",
    category: "resource",
    name: "Hydroponics",
    description: "Grows food indoors, but needs water and power.",
    buildSeconds: 32,
    baseConstructionWorkers: 2,
    baseCost: { material: 70, energy: 8, water: 16 },
    produces: { food: 0.24 },
    consumes: { water: 0.08, energy: 0.03 },
  },
  {
    id: "waterStill",
    category: "resource",
    name: "Water Still",
    description: "Filters contaminated water into drinkable reserves.",
    buildSeconds: 30,
    baseConstructionWorkers: 2,
    baseCost: { material: 65 },
    produces: { water: 0.2 },
    consumes: { energy: 0.02 },
  },
  {
    id: "workshop",
    category: "resource",
    name: "Workshop",
    description: "Turns scrap into useful construction material.",
    buildSeconds: 34,
    baseConstructionWorkers: 3,
    baseCost: { material: 80 },
    produces: { material: 0.22 },
    consumes: { energy: 0.025 },
  },
  {
    id: "generator",
    category: "resource",
    name: "Generator",
    description: "Turns assigned workers into power for the camp.",
    buildSeconds: 36,
    baseConstructionWorkers: 3,
    baseCost: { material: 90 },
    storageBonus: {
      energy: 60,
    },
  },
  {
    id: "market",
    category: "support",
    name: "Marketplace",
    description: "Trades stored supplies with distant communities over radio deals.",
    maxLevel: 5,
    buildSeconds: 42,
    baseConstructionWorkers: 3,
    baseCost: { material: 120 },
    requiredMainBuildingLevel: 5,
  },
  {
    id: "watchtower",
    category: "defense",
    name: "Watchtower",
    description: "Improves perimeter control against roaming hordes.",
    buildSeconds: 38,
    baseConstructionWorkers: 2,
    baseCost: { material: 75 },
    defense: 12,
    consumes: { energy: 0.01 },
  },
  {
    id: "barracks",
    category: "defense",
    name: "Barracks",
    description: "Trains workers into troops and keeps the militia organized.",
    buildSeconds: 40,
    baseConstructionWorkers: 2,
    baseCost: { material: 95, food: 22, water: 10 },
    consumes: { energy: 0.015, food: 0.004, water: 0.006 },
  },
  {
    id: "palisade",
    category: "defense",
    name: "Palisade",
    description: "A reinforced wooden perimeter that makes the camp safer.",
    buildSeconds: 40,
    baseConstructionWorkers: 3,
    baseCost: { material: 95 },
    produces: { morale: 0.01 },
    defense: 9,
    consumes: { energy: 0.005 },
  },
  {
    id: "clinic",
    category: "support",
    name: "Clinic",
    description: "Treats injured survivors over time and consumes food and water for care.",
    buildSeconds: 42,
    baseConstructionWorkers: 2,
    baseCost: { material: 85, food: 24, water: 18 },
    consumes: { energy: 0.025, food: 0.006, water: 0.012 },
  },
];

export const buildingDefinitions: BuildingDefinition[] = buildingDefinitionInputs.map(
  (definition) => {
    const maxLevel = definition.maxLevel ?? MAX_BUILDING_LEVEL;

    return {
      ...definition,
      maxLevel,
      levelRequirements: createBuildingLevelRequirements({
        baseCost: definition.baseCost,
        baseBuildSeconds: definition.buildSeconds,
        baseConstructionWorkers: definition.baseConstructionWorkers,
      }).slice(0, maxLevel),
    };
  },
);

export const buildingIds = buildingDefinitions.map((building) => building.id);

export const buildingById = Object.fromEntries(
  buildingDefinitions.map((building) => [building.id, building]),
) as Record<BuildingId, BuildingDefinition>;
