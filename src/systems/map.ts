import { tileById } from "../data/mapTiles";
import type { GameState, MapSector, ResourceBag, TileKind } from "../game/types";
import { addResources } from "./resources";

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
    selectedSectorId: `${centerX}:${centerY}`,
    sectors,
  };
}

export function getSector(state: GameState, sectorId: string): MapSector | undefined {
  return state.map.sectors.find((sector) => sector.id === sectorId);
}

export function revealAround(state: GameState, sector: MapSector): void {
  for (const candidate of state.map.sectors) {
    const distance = Math.abs(candidate.x - sector.x) + Math.abs(candidate.y - sector.y);

    if (distance <= 1) {
      candidate.revealed = true;
    }
  }
}

export function tickThreat(state: GameState, deltaSeconds: number): void {
  const base = getSector(state, `${Math.floor(state.map.width / 2)}:${Math.floor(state.map.height / 2)}`);

  if (!base) {
    return;
  }

  const pressure = state.map.sectors.reduce((total, sector) => {
    if (!sector.revealed || sector.kind === "base") {
      return total;
    }

    const distance = Math.max(1, Math.abs(sector.x - base.x) + Math.abs(sector.y - base.y));
    return total + sector.threat / distance;
  }, 0);

  if (pressure > 110) {
    state.resources.morale = Math.max(
      0,
      state.resources.morale - 0.008 * deltaSeconds,
    );
  }
}

export function collectSectorLoot(state: GameState, sector: MapSector): void {
  const loot = { ...sector.loot };
  addResources(state.resources, loot, state.capacities);
  sector.loot = {};
  sector.scouted = true;
  sector.threat = Math.max(0, sector.threat - 18);
  revealAround(state, sector);
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
