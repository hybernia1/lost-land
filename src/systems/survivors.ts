import type { GameState } from "../game/types";

export function convertWorkerToTroop(state: GameState): boolean {
  if (state.buildings.barracks.level <= 0 || state.survivors.workers <= 0) {
    return false;
  }

  state.survivors.workers -= 1;
  state.survivors.troops += 1;
  return true;
}

export function convertTroopToWorker(state: GameState): boolean {
  if (state.buildings.barracks.level <= 0 || state.survivors.troops <= 0) {
    return false;
  }

  state.survivors.troops -= 1;
  state.survivors.workers += 1;
  return true;
}
