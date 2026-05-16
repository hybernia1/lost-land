import type { GameState, ResourceBag, UnitCounts, UnitId } from "../game/types";
import { gameConfig } from "../game/config";
import { playerUnitIds } from "../data/combatUnits";
import { isBuildingInactiveDueToCoal } from "./buildings";
import { pushLocalizedLog } from "./log";
import { canAfford, spendResources } from "./resources";

export const unitIds: UnitId[] = playerUnitIds;

export function createEmptyUnitCounts(): UnitCounts {
  return Object.fromEntries(unitIds.map((unitId) => [unitId, 0])) as UnitCounts;
}

export function getBarracksTrainingSeconds(unitId: UnitId): number {
  return gameConfig.barracks.troopTraining[unitId].seconds;
}

export function getBarracksTrainingCost(unitId: UnitId): ResourceBag {
  return { ...gameConfig.barracks.troopTraining[unitId].cost };
}

export function getTotalTroopCount(state: GameState): number {
  return getUnitCount(state.survivors.units);
}

export function getUnitCount(units: UnitCounts): number {
  return unitIds.reduce((total, unitId) => total + Math.max(0, Math.floor(units[unitId] ?? 0)), 0);
}

export function addUnits(target: UnitCounts, units: UnitCounts): void {
  for (const unitId of unitIds) {
    target[unitId] = Math.max(0, Math.floor((target[unitId] ?? 0) + (units[unitId] ?? 0)));
  }
}

export function removeTroops(state: GameState, count: number): UnitCounts | null {
  const remainingRequested = Math.max(1, Math.floor(count));

  if (getTotalTroopCount(state) < remainingRequested) {
    return null;
  }

  const removed = createEmptyUnitCounts();
  let remaining = remainingRequested;

  for (const unitId of unitIds) {
    const available = Math.max(0, Math.floor(state.survivors.units[unitId] ?? 0));
    const taken = Math.min(available, remaining);

    state.survivors.units[unitId] = available - taken;
    removed[unitId] = taken;
    remaining -= taken;

    if (remaining <= 0) {
      break;
    }
  }

  return removed;
}

export function removeUnits(state: GameState, units: UnitCounts): UnitCounts | null {
  const normalized = normalizeUnitCounts(units);

  if (getUnitCount(normalized) <= 0) {
    return null;
  }

  for (const unitId of unitIds) {
    if ((state.survivors.units[unitId] ?? 0) < normalized[unitId]) {
      return null;
    }
  }

  for (const unitId of unitIds) {
    state.survivors.units[unitId] = Math.max(0, Math.floor(state.survivors.units[unitId] - normalized[unitId]));
  }

  return normalized;
}

export function removeOneTroop(state: GameState): boolean {
  return removeTroops(state, 1) !== null;
}

export function tickBarracksTraining(state: GameState, deltaSeconds: number): void {
  const barracks = state.buildings.barracks;

  if (
    barracks.level <= 0 ||
    barracks.upgradingRemaining > 0 ||
    isBuildingInactiveDueToCoal(state, "barracks")
  ) {
    return;
  }

  let remainingDelta = Math.max(0, deltaSeconds);

  while (remainingDelta > 0 && state.survivors.barracksTrainingQueue.length > 0) {
    const activeJob = state.survivors.barracksTrainingQueue[0];
    const consumedSeconds = Math.min(activeJob.remainingSeconds, remainingDelta);

    activeJob.remainingSeconds = Math.max(0, activeJob.remainingSeconds - consumedSeconds);
    remainingDelta -= consumedSeconds;

    if (activeJob.remainingSeconds > 0) {
      break;
    }

    state.survivors.barracksTrainingQueue.shift();
    state.survivors.units[activeJob.unitId] = Math.max(
      0,
      Math.floor(state.survivors.units[activeJob.unitId] ?? 0),
    ) + 1;
    pushLocalizedLog(state, "logTroopTrainingCompleted");
  }
}

export function startBarracksTraining(state: GameState, unitId: UnitId, count: number): boolean {
  const barracks = state.buildings.barracks;
  const requestedCount = Math.max(1, Math.floor(count));

  if (
    barracks.level <= 0 ||
    barracks.upgradingRemaining > 0 ||
    isBuildingInactiveDueToCoal(state, "barracks")
  ) {
    return false;
  }

  const totalCost = getBarracksTrainingCostForCount(unitId, requestedCount);
  if (!canAfford(state.resources, totalCost)) {
    return false;
  }

  spendResources(state.resources, totalCost);

  const durationSeconds = getBarracksTrainingSeconds(unitId);
  for (let index = 0; index < requestedCount; index += 1) {
    state.survivors.barracksTrainingQueue.push({
      unitId,
      remainingSeconds: durationSeconds,
      durationSeconds,
    });
  }

  pushLocalizedLog(state, "logTroopTrainingStarted", { count: requestedCount });
  return true;
}

export function getBarracksTrainingCostForCount(unitId: UnitId, count: number): ResourceBag {
  const normalizedCount = Math.max(1, Math.floor(count));
  const cost = getBarracksTrainingCost(unitId);

  return Object.fromEntries(
    Object.entries(cost).map(([resourceId, amount]) => [resourceId, (amount ?? 0) * normalizedCount]),
  ) as ResourceBag;
}

function normalizeUnitCounts(units: UnitCounts): UnitCounts {
  return Object.fromEntries(
    unitIds.map((unitId) => [unitId, Math.max(0, Math.floor(units[unitId] ?? 0))]),
  ) as UnitCounts;
}
