import type { GameState } from "../game/types";
import { getAcademyProductionBonus } from "./academy";

const MAIN_BUILDING_LEVEL_2_PRODUCTION_BONUS = 0.05;
const MAIN_BUILDING_LEVEL_3_PRODUCTION_BONUS = 0.07;
const MAIN_BUILDING_MAX_PRODUCTION_BONUS = 0.5;

export function getMainBuildingProductionBonus(level: number): number {
  if (level <= 1) {
    return 0;
  }

  if (level === 2) {
    return MAIN_BUILDING_LEVEL_2_PRODUCTION_BONUS;
  }

  if (level >= 20) {
    return MAIN_BUILDING_MAX_PRODUCTION_BONUS;
  }

  return MAIN_BUILDING_LEVEL_3_PRODUCTION_BONUS +
    (level - 3) *
      ((MAIN_BUILDING_MAX_PRODUCTION_BONUS - MAIN_BUILDING_LEVEL_3_PRODUCTION_BONUS) / 17);
}

export function getMoraleProductionMultiplier(morale: number): number {
  if (morale >= 75) {
    return 1;
  }

  if (morale >= 50) {
    return 0.8;
  }

  return 0.6;
}

export function getGlobalProductionMultiplier(state: GameState): number {
  return (1 +
    getMainBuildingProductionBonus(state.buildings.mainBuilding.level) +
    getAcademyProductionBonus(state.buildings.academy.level)) *
    getMoraleProductionMultiplier(state.resources.morale);
}
