import type { BuildingId, GameState } from "../game/types";

const CLINIC_FOOD_PER_TREATMENT = 2;
const INCIDENT_BASE_DELAY_SECONDS = 600;
const INCIDENT_DELAY_RANGE_SECONDS = 420;

export function tickHealth(state: GameState, deltaSeconds: number): void {
  tickClinicTreatment(state, deltaSeconds);
  tickIncidents(state);
}

export function injureSurvivors(
  state: GameState,
  count: number,
  message: string,
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
    pushLog(state, message);
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
      pushLog(state, "A survivor was injured during construction.");
      return;
    }

    injureSurvivors(state, 1, "A survivor was injured during construction.");
  }
}

export function getClinicTreatmentRate(state: GameState): number {
  return state.buildings.clinic.level;
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

  state.health.treatmentProgress += (treatmentRate * deltaSeconds) / 60;

  while (
    state.health.treatmentProgress >= 1 &&
    state.health.injured > 0 &&
    state.resources.food >= CLINIC_FOOD_PER_TREATMENT
  ) {
    state.resources.food -= CLINIC_FOOD_PER_TREATMENT;
    state.health.injured -= 1;
    state.survivors.workers += 1;
    state.health.treatmentProgress -= 1;
    pushLog(state, "The clinic treated one survivor.");
  }

  if (state.resources.food < CLINIC_FOOD_PER_TREATMENT) {
    state.health.treatmentProgress = Math.min(state.health.treatmentProgress, 1);
  }
}

function tickIncidents(state: GameState): void {
  if (state.elapsedSeconds < state.health.nextIncidentAt) {
    return;
  }

  const roll = stableRoll(`illness:${Math.floor(state.health.nextIncidentAt)}`);
  const chance = state.resources.morale < 45 ? 18 : 7;

  if (roll < chance) {
    injureSurvivors(state, 1, "A survivor fell ill.");
  }

  state.health.nextIncidentAt =
    state.elapsedSeconds +
    INCIDENT_BASE_DELAY_SECONDS +
    stableRoll(`next:${Math.floor(state.elapsedSeconds)}`) *
      (INCIDENT_DELAY_RANGE_SECONDS / 100);
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

  const activeConstruction = Object.values(state.buildings).find(
    (building) => building.constructionWorkers > 0,
  );

  if (!activeConstruction) {
    return false;
  }

  activeConstruction.constructionWorkers -= 1;
  return true;
}

function stableRoll(seed: string): number {
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
