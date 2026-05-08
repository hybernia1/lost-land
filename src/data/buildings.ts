import type { BuildingDefinition, BuildingId } from "../game/types";
import { createBuildingLevelRequirements, MAX_BUILDING_LEVEL } from "./buildingProgression";

type BuildingDefinitionInput = Omit<
  BuildingDefinition,
  "maxLevel" | "levelRequirements"
>;

const buildingDefinitionInputs: BuildingDefinitionInput[] = [
  {
    id: "mainBuilding",
    name: "Main Building",
    description: "Coordinates construction, housing, and camp decisions.",
    buildSeconds: 24,
    baseConstructionWorkers: 2,
    baseCost: { material: 45 },
    produces: { morale: 0.03 },
    consumes: { energy: 0.01 },
  },
  {
    id: "storage",
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
    name: "Dormitory",
    description: "Houses civilian survivors, but needs power to stay livable.",
    buildSeconds: 34,
    baseConstructionWorkers: 2,
    baseCost: { material: 85, energy: 6 },
    alwaysConsumes: { energy: 0.02 },
    housing: 10,
  },
  {
    id: "hydroponics",
    name: "Hydroponics",
    description: "Grows food indoors, but needs water and power.",
    buildSeconds: 32,
    baseConstructionWorkers: 2,
    baseCost: { material: 70, energy: 8 },
    produces: { food: 0.24 },
    consumes: { water: 0.08, energy: 0.03 },
  },
  {
    id: "waterStill",
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
    name: "Workshop",
    description: "Turns scrap into useful construction material.",
    buildSeconds: 34,
    baseConstructionWorkers: 3,
    baseCost: { material: 80 },
    produces: { material: 0.14 },
    consumes: { energy: 0.025 },
  },
  {
    id: "generator",
    name: "Generator",
    description: "Turns assigned workers into power for the camp.",
    buildSeconds: 36,
    baseConstructionWorkers: 3,
    baseCost: { material: 90 },
  },
  {
    id: "watchtower",
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
    name: "Barracks",
    description: "Trains workers into troops and keeps the militia organized.",
    buildSeconds: 40,
    baseConstructionWorkers: 2,
    baseCost: { material: 95, food: 18 },
    consumes: { energy: 0.015 },
  },
  {
    id: "palisade",
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
    name: "Clinic",
    description: "Trains workers into troops for future outside missions and camp defense.",
    buildSeconds: 42,
    baseConstructionWorkers: 2,
    baseCost: { material: 85, food: 20 },
    consumes: { energy: 0.025 },
  },
];

export const buildingDefinitions: BuildingDefinition[] = buildingDefinitionInputs.map(
  (definition) => ({
    ...definition,
    maxLevel: MAX_BUILDING_LEVEL,
    levelRequirements: createBuildingLevelRequirements({
      baseCost: definition.baseCost,
      baseBuildSeconds: definition.buildSeconds,
      baseConstructionWorkers: definition.baseConstructionWorkers,
    }),
  }),
);

export const buildingIds = buildingDefinitions.map((building) => building.id);

export const buildingById = Object.fromEntries(
  buildingDefinitions.map((building) => [building.id, building]),
) as Record<BuildingId, BuildingDefinition>;
