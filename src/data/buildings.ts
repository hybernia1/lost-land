import type { BuildingDefinition, BuildingId } from "../game/types";

export const buildingDefinitions: BuildingDefinition[] = [
  {
    id: "mainBuilding",
    name: "Main Building",
    description: "Coordinates construction, housing, and camp decisions.",
    maxLevel: 8,
    buildSeconds: 24,
    baseCost: { material: 45 },
    produces: { morale: 0.03 },
  },
  {
    id: "storage",
    name: "Storage Depot",
    description: "Raises the stockpile limits for practical supplies.",
    maxLevel: 10,
    buildSeconds: 28,
    baseCost: { material: 60 },
    storageBonus: {
      food: 90,
      water: 90,
      material: 130,
    },
  },
  {
    id: "hydroponics",
    name: "Hydroponics",
    description: "Grows food indoors, but needs water and power.",
    maxLevel: 10,
    buildSeconds: 32,
    baseCost: { material: 70, energy: 8 },
    produces: { food: 0.24 },
    consumes: { water: 0.08, energy: 0.03 },
  },
  {
    id: "waterStill",
    name: "Water Still",
    description: "Filters contaminated water into drinkable reserves.",
    maxLevel: 10,
    buildSeconds: 30,
    baseCost: { material: 65 },
    produces: { water: 0.2 },
    consumes: { energy: 0.02 },
  },
  {
    id: "workshop",
    name: "Workshop",
    description: "Turns scrap into useful construction material.",
    maxLevel: 10,
    buildSeconds: 34,
    baseCost: { material: 80 },
    produces: { material: 0.14 },
  },
  {
    id: "generator",
    name: "Generator",
    description: "Turns assigned workers into power for the camp.",
    maxLevel: 8,
    buildSeconds: 36,
    baseCost: { material: 90 },
  },
  {
    id: "watchtower",
    name: "Watchtower",
    description: "Improves perimeter control against roaming hordes.",
    maxLevel: 8,
    buildSeconds: 38,
    baseCost: { material: 75 },
    defense: 12,
  },
  {
    id: "barracks",
    name: "Barracks",
    description: "Trains workers into troops and keeps the militia organized.",
    maxLevel: 8,
    buildSeconds: 40,
    baseCost: { material: 95, food: 18 },
  },
  {
    id: "palisade",
    name: "Palisade",
    description: "A reinforced wooden perimeter that makes the camp safer.",
    maxLevel: 10,
    buildSeconds: 40,
    baseCost: { material: 95 },
    produces: { morale: 0.01 },
    defense: 9,
  },
  {
    id: "clinic",
    name: "Clinic",
    description: "Reduces expedition losses and keeps people fit.",
    maxLevel: 6,
    buildSeconds: 42,
    baseCost: { material: 85, food: 20 },
  },
];

export const buildingIds = buildingDefinitions.map((building) => building.id);

export const buildingById = Object.fromEntries(
  buildingDefinitions.map((building) => [building.id, building]),
) as Record<BuildingId, BuildingDefinition>;
