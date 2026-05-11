import type { GameState } from "../game/types";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import { isBuildingInactiveDueToCoal } from "./buildings";

const BARRACKS_LEVEL_1_TRAINING_PER_HOUR = 1;
const BARRACKS_LEVEL_20_TRAINING_PER_HOUR = 12;

export function getBarracksTrainingRatePerGameHour(level: number): number {
  if (level <= 0) {
    return 0;
  }

  if (level >= 20) {
    return BARRACKS_LEVEL_20_TRAINING_PER_HOUR;
  }

  return BARRACKS_LEVEL_1_TRAINING_PER_HOUR +
    (level - 1) *
      ((BARRACKS_LEVEL_20_TRAINING_PER_HOUR - BARRACKS_LEVEL_1_TRAINING_PER_HOUR) / 19);
}

export function tickBarracksTraining(state: GameState, deltaSeconds: number): void {
  const barracks = state.buildings.barracks;

  if (
    barracks.level <= 0 ||
    barracks.upgradingRemaining > 0 ||
    isBuildingInactiveDueToCoal(state, "barracks")
  ) {
    state.survivors.barracksTrainingProgress = 0;
    return;
  }

  const ratePerHour = getBarracksTrainingRatePerGameHour(barracks.level);
  if (ratePerHour <= 0) {
    state.survivors.barracksTrainingProgress = 0;
    return;
  }

  state.survivors.barracksTrainingProgress +=
    (ratePerHour * deltaSeconds) / GAME_HOUR_REAL_SECONDS;

  while (
    state.survivors.barracksTrainingProgress >= 1 &&
    state.survivors.workers > 0
  ) {
    state.survivors.workers -= 1;
    state.survivors.troops += 1;
    state.survivors.barracksTrainingProgress -= 1;
  }

  if (state.survivors.workers <= 0) {
    state.survivors.barracksTrainingProgress = Math.min(
      state.survivors.barracksTrainingProgress,
      1,
    );
  }
}

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
