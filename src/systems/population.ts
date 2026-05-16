import type { GameState } from "../game/types";

export function getAssignedBuildingWorkerCount(state: GameState): number {
  return Object.values(state.buildings).reduce(
    (total, building) => total + building.workers,
    0,
  );
}

export function getConstructionWorkerCount(state: GameState): number {
  return Object.values(state.buildings).reduce(
    (total, building) => total + building.constructionWorkers,
    0,
  );
}

export function getUnavailableWorkerCount(state: GameState): number {
  return getAssignedBuildingWorkerCount(state) +
    getConstructionWorkerCount(state);
}

export function getPopulation(state: GameState): number {
  const troops = Object.values(state.survivors.units).reduce((total, count) => total + count, 0);

  return state.survivors.workers +
    troops +
    state.health.injured +
    getUnavailableWorkerCount(state);
}
