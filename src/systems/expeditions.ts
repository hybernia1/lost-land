import type { Expedition, GameState, MapSector, ResourceBag } from "../game/types";
import { collectSectorLoot, getSector } from "./map";
import { canAfford, spendResources } from "./resources";

export function startExpedition(state: GameState, sectorId: string): boolean {
  const sector = getSector(state, sectorId);

  if (!sector || !sector.revealed || sector.kind === "base" || !hasLoot(sector)) {
    return false;
  }

  if (state.survivors.troops < 2) {
    return false;
  }

  const distance = Math.abs(sector.x - Math.floor(state.map.width / 2)) +
    Math.abs(sector.y - Math.floor(state.map.height / 2));
  const survivors = 2;
  const totalSeconds = 34 + distance * 18 + sector.threat * 0.25;
  const supplyCost = getExpeditionSupplyCost(state, sector);

  if (!canAfford(state.resources, supplyCost)) {
    return false;
  }

  spendResources(state.resources, supplyCost);
  state.survivors.troops -= survivors;
  state.expeditions.push({
    id: crypto.randomUUID(),
    targetSectorId: sectorId,
    survivors,
    totalSeconds,
    remainingSeconds: totalSeconds,
    risk: Math.min(92, sector.threat + distance * 5),
  });
  pushLog(state, `Expedition sent to ${sector.id}.`);
  return true;
}

export function getExpeditionSupplyCost(
  state: GameState,
  sector: MapSector,
): ResourceBag {
  const distance = Math.abs(sector.x - Math.floor(state.map.width / 2)) +
    Math.abs(sector.y - Math.floor(state.map.height / 2));
  const troops = 2;
  const dangerMultiplier = 1 + sector.threat / 180;
  const distanceMultiplier = 1 + distance * 0.18;

  return {
    food: Math.ceil(troops * 3 * distanceMultiplier * dangerMultiplier),
    water: Math.ceil(troops * 4 * distanceMultiplier * dangerMultiplier),
  };
}

export function tickExpeditions(state: GameState, deltaSeconds: number): void {
  const completed: Expedition[] = [];

  for (const expedition of state.expeditions) {
    expedition.remainingSeconds = Math.max(
      0,
      expedition.remainingSeconds - deltaSeconds,
    );

    if (expedition.remainingSeconds === 0) {
      completed.push(expedition);
    }
  }

  for (const expedition of completed) {
    completeExpedition(state, expedition);
  }

  state.expeditions = state.expeditions.filter(
    (expedition) => expedition.remainingSeconds > 0,
  );
}

function completeExpedition(state: GameState, expedition: Expedition): void {
  const sector = getSector(state, expedition.targetSectorId);

  if (!sector) {
    state.survivors.troops += expedition.survivors;
    return;
  }

  const deathThreshold = Math.max(6, Math.min(55, expedition.risk * 0.42));
  const lossRoll = stableRoll(state.elapsedSeconds, expedition.targetSectorId);

  collectSectorLoot(state, sector);

  if (lossRoll < deathThreshold) {
    const survivorsLost = Math.min(1, expedition.survivors);
    const survivorsReturning = expedition.survivors - survivorsLost;
    state.survivors.troops += survivorsReturning;
    state.resources.morale = Math.max(0, state.resources.morale - 8);
    pushLog(state, `Expedition returned from ${sector.id}, but one troop was lost.`);
    return;
  }

  state.survivors.troops += expedition.survivors;
  pushLog(state, `Expedition returned from ${sector.id} with supplies.`);
}

function hasLoot(sector: MapSector): boolean {
  return Object.values(sector.loot).some((amount) => (amount ?? 0) > 0);
}

function stableRoll(elapsedSeconds: number, sectorId: string): number {
  const seed = `${Math.floor(elapsedSeconds)}:${sectorId}`;
  let value = 0;

  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 100;
  }

  return value;
}

function pushLog(state: GameState, message: string): void {
  state.log.unshift(message);
  state.log = state.log.slice(0, 16);
}
