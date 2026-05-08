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
  return getAssignedBuildingWorkerCount(state) + getConstructionWorkerCount(state);
}

export function getPopulation(state: GameState): number {
  return state.survivors.workers +
    state.survivors.troops +
    state.health.injured +
    getUnavailableWorkerCount(state);
}
