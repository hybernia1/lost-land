import type { ResourceBag, TileKind } from "../game/types";

export type TileDefinition = {
  id: TileKind;
  name: string;
  color: string;
  accent: string;
  lootBias: ResourceBag;
};

export const tileDefinitions: TileDefinition[] = [
  {
    id: "base",
    name: "Home Base",
    color: "#36514a",
    accent: "#6ed0a8",
    lootBias: {},
  },
  {
    id: "ruins",
    name: "City Ruins",
    color: "#4b4f57",
    accent: "#b8bec8",
    lootBias: { material: 42, energy: 5 },
  },
  {
    id: "forest",
    name: "Overgrown Woods",
    color: "#2f5a3d",
    accent: "#78c279",
    lootBias: { food: 25, water: 12, material: 15 },
  },
  {
    id: "highway",
    name: "Dead Highway",
    color: "#514b43",
    accent: "#d6b06b",
    lootBias: { energy: 12, material: 24 },
  },
  {
    id: "hospital",
    name: "Abandoned Hospital",
    color: "#435762",
    accent: "#8ad8e8",
    lootBias: { food: 18, water: 12, material: 12 },
  },
  {
    id: "warehouse",
    name: "Supply Warehouse",
    color: "#5c5544",
    accent: "#e0c66d",
    lootBias: { material: 45, food: 16, water: 10 },
  },
  {
    id: "infested",
    name: "Infested Block",
    color: "#523b46",
    accent: "#f07a87",
    lootBias: { food: 14, water: 10, energy: 7, material: 24 },
  },
];

export const tileById = Object.fromEntries(
  tileDefinitions.map((tile) => [tile.id, tile]),
) as Record<TileKind, TileDefinition>;
