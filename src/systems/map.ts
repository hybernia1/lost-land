import { tileById } from "../data/mapTiles";
import type { GameState, MapSector, ResourceBag, TileKind } from "../game/types";

const MAP_WIDTH = 9;
const MAP_HEIGHT = 9;

export function createInitialMap(): GameState["map"] {
  const centerX = Math.floor(MAP_WIDTH / 2);
  const centerY = Math.floor(MAP_HEIGHT / 2);
  const sectors: MapSector[] = [];

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const distance = Math.abs(x - centerX) + Math.abs(y - centerY);
      const kind = distance === 0 ? "base" : pickTileKind(x, y, distance);

      sectors.push({
        id: `${x}:${y}`,
        x,
        y,
        kind,
        revealed: distance <= 1,
        scouted: distance === 0,
        threat: kind === "base" ? 0 : Math.min(96, 12 + distance * 9 + hash(x, y) % 18),
        loot: createLoot(kind, distance, x, y),
      });
    }
  }

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    sectors,
  };
}

function pickTileKind(x: number, y: number, distance: number): TileKind {
  const value = hash(x, y) % 100;

  if (distance > 4 && value > 76) {
    return "infested";
  }

  if (value < 18) {
    return "forest";
  }

  if (value < 33) {
    return "highway";
  }

  if (value < 48) {
    return "warehouse";
  }

  if (value < 60) {
    return "hospital";
  }

  return "ruins";
}

function createLoot(kind: TileKind, distance: number, x: number, y: number): ResourceBag {
  const definition = tileById[kind];
  const loot: ResourceBag = {};

  for (const [resourceId, amount] of Object.entries(definition.lootBias)) {
    const noise = 0.75 + (hash(x + amount, y + distance) % 50) / 100;
    loot[resourceId as keyof ResourceBag] = Math.ceil(amount * noise * (1 + distance * 0.08));
  }

  return loot;
}

function hash(x: number, y: number): number {
  return Math.abs(Math.imul(x + 31, 73856093) ^ Math.imul(y + 17, 19349663));
}
