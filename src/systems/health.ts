import type { BuildingId, GameState } from "../game/types";
import { getEnvironmentDefinition, getEnvironmentIntensityIndex } from "../data/environment";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import { pushLocalizedLog } from "./log";
import { getPopulation } from "./population";
import { removeOneResourceSiteWorker } from "./resourceSites";

const CLINIC_FOOD_PER_TREATMENT = 2;
const INCIDENT_BASE_DELAY_SECONDS = 600;
const INCIDENT_DELAY_RANGE_SECONDS = 420;
const STARVATION_DEATH_SECONDS = 360;
const DEHYDRATION_DEATH_SECONDS = 240;

export function tickHealth(state: GameState, deltaSeconds: number): void {
  tickDeprivationDeaths(state, deltaSeconds);
  tickClinicTreatment(state, deltaSeconds);
  tickIncidents(state);
}

export function injureSurvivors(
  state: GameState,
  count: number,
  logKey: string,
): number {
  let injured = 0;

  for (let index = 0; index < count; index += 1) {
    if (!injureWorker(state)) {
      break;
    }

    state.health.injured += 1;
    injured += 1;
  }

  if (injured > 0) {
    pushLocalizedLog(state, logKey);
  }

  return injured;
}

export function maybeInjureFromConstruction(
  state: GameState,
  buildingId: BuildingId,
): void {
  const roll = stableRoll(`${buildingId}:${Math.floor(state.elapsedSeconds)}`);

  if (roll < 5) {
    const building = state.buildings[buildingId];

    if (building.constructionWorkers > 0) {
      building.constructionWorkers -= 1;
      state.health.injured += 1;
      pushLocalizedLog(state, "logConstructionInjury");
      return;
    }

    injureSurvivors(state, 1, "logConstructionInjury");
  }
}

export function getClinicTreatmentRate(state: GameState): number {
  return getClinicTreatmentRatePerGameHour(state.buildings.clinic.level);
}

export function getClinicTreatmentRatePerGameHour(level: number): number {
  return Math.max(0, level);
}

export function getClinicFoodPerTreatment(): number {
  return CLINIC_FOOD_PER_TREATMENT;
}

function tickClinicTreatment(state: GameState, deltaSeconds: number): void {
  const treatmentRate = getClinicTreatmentRate(state);

  if (treatmentRate <= 0 || state.health.injured <= 0) {
    state.health.treatmentProgress = 0;
    return;
  }

  state.health.treatmentProgress +=
    (treatmentRate * deltaSeconds) / GAME_HOUR_REAL_SECONDS;

  while (
    state.health.treatmentProgress >= 1 &&
    state.health.injured > 0 &&
    state.resources.food >= CLINIC_FOOD_PER_TREATMENT
  ) {
    state.resources.food -= CLINIC_FOOD_PER_TREATMENT;
    state.health.injured -= 1;
    state.survivors.workers += 1;
    state.health.treatmentProgress -= 1;
    pushLocalizedLog(state, "logClinicTreated");
  }

  if (state.resources.food < CLINIC_FOOD_PER_TREATMENT) {
    state.health.treatmentProgress = Math.min(state.health.treatmentProgress, 1);
  }
}

function tickDeprivationDeaths(state: GameState, deltaSeconds: number): void {
  tickDeprivation(
    state,
    "food",
    "starvationProgress",
    STARVATION_DEATH_SECONDS,
    "logStarvationDeath",
  );
  tickDeprivation(
    state,
    "water",
    "dehydrationProgress",
    DEHYDRATION_DEATH_SECONDS,
    "logDehydrationDeath",
  );

  function tickDeprivation(
    currentState: GameState,
    resourceId: "food" | "water",
    progressKey: "starvationProgress" | "dehydrationProgress",
    deathSeconds: number,
    logKey: string,
  ): void {
    if (currentState.resources[resourceId] > 0 || getPopulation(currentState) <= 0) {
      currentState.health[progressKey] = 0;
      return;
    }

    currentState.health[progressKey] += deltaSeconds / deathSeconds;

    while (currentState.health[progressKey] >= 1) {
      if (!killCampSurvivor(currentState)) {
        currentState.health[progressKey] = 0;
        return;
      }

      currentState.health[progressKey] -= 1;
      pushLocalizedLog(currentState, logKey);
    }
  }
}

function tickIncidents(state: GameState): void {
  if (state.elapsedSeconds < state.health.nextIncidentAt) {
    return;
  }

  const roll = stableRoll(`illness:${Math.floor(state.health.nextIncidentAt)}`);
  const moraleChance = state.resources.morale < 45 ? 18 : 7;
  const scarcityChance = getScarcityInjuryChance(state);
  const chance = Math.min(72, moraleChance + scarcityChance);

  if (roll < chance) {
    injureSurvivors(
      state,
      1,
      scarcityChance > 0 && roll >= moraleChance
        ? "logScarcityInjury"
        : "logIllness",
    );
  }

  state.health.nextIncidentAt =
    state.elapsedSeconds +
    INCIDENT_BASE_DELAY_SECONDS +
    stableRoll(`next:${Math.floor(state.elapsedSeconds)}`) *
      (INCIDENT_DELAY_RANGE_SECONDS / 100);
}

function getScarcityInjuryChance(state: GameState): number {
  const foodIndex = getResourceIndex(state, "food");
  const waterIndex = getResourceIndex(state, "water");
  const foodPressure = Math.max(0, 1 - foodIndex);
  const waterPressure = Math.max(0, 1 - waterIndex);
  const environment = state.environment;
  const environmentDefinition = getEnvironmentDefinition(environment.condition);
  const environmentChance =
    environmentDefinition.healthIncidentChanceByIntensity[
      getEnvironmentIntensityIndex(environment.intensity)
    ] ?? 0;

  return Math.round(foodPressure * 10 + waterPressure * 14 + environmentChance);
}

function getResourceIndex(state: GameState, resourceId: "food" | "water"): number {
  const capacity = Math.max(1, state.capacities[resourceId]);

  return Math.max(0, Math.min(1, state.resources[resourceId] / capacity));
}

function injureWorker(state: GameState): boolean {
  if (state.survivors.workers > 0) {
    state.survivors.workers -= 1;
    return true;
  }

  const staffedBuilding = Object.values(state.buildings).find(
    (building) => building.workers > 0,
  );

  if (staffedBuilding) {
    staffedBuilding.workers -= 1;
    return true;
  }

  if (removeOneResourceSiteWorker(state)) {
    return true;
  }

  const activeConstruction = Object.values(state.buildings).find(
    (building) => building.constructionWorkers > 0,
  );

  if (!activeConstruction) {
    return false;
  }

  activeConstruction.constructionWorkers -= 1;
  return true;
}

export function killCampSurvivor(state: GameState): boolean {
  if (state.survivors.workers > 0) {
    state.survivors.workers -= 1;
    return true;
  }

  const staffedBuilding = Object.values(state.buildings).find(
    (building) => building.workers > 0,
  );

  if (staffedBuilding) {
    staffedBuilding.workers -= 1;
    return true;
  }

  if (removeOneResourceSiteWorker(state)) {
    return true;
  }

  const activeConstruction = Object.values(state.buildings).find(
    (building) => building.constructionWorkers > 0,
  );

  if (activeConstruction) {
    activeConstruction.constructionWorkers -= 1;
    return true;
  }

  if (state.survivors.troops > 0) {
    state.survivors.troops -= 1;
    return true;
  }

  if (state.health.injured <= 0) {
    return false;
  }

  state.health.injured -= 1;
  return true;
}

function stableRoll(seed: string): number {
  let value = 0;

  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 100;
  }

  return value;
}
