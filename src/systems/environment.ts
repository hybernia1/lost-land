import {
  ENVIRONMENT_COOLDOWN_HOURS,
  ENVIRONMENT_INITIAL_DELAY_SECONDS,
  ENVIRONMENT_MAX_INTENSITY,
  ENVIRONMENT_MIN_INTENSITY,
  SHELTER_REPEAT_DEADLINE_HOURS,
  SHELTER_WARNING_LEAD_SECONDS,
  getEnvironmentDefinition,
  getEnvironmentIntensityIndex,
  getEnvironmentMoralePenaltyPerHour,
} from "../data/environment";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import type { EnvironmentConditionId, EnvironmentState, GameState } from "../game/types";
import { getHousingStatus } from "./buildings";
import { injureSurvivors, killCampSurvivor } from "./health";
import { pushLocalizedLog } from "./log";
import { addResources } from "./resources";

const activeConditionIds: Exclude<EnvironmentConditionId, "stable">[] = [
  "rain",
  "snowFront",
  "radiation",
];
const ACTIVE_CONDITION_ROLL_THRESHOLD = 80;

export function createDefaultEnvironmentState(
  nextConditionAt = ENVIRONMENT_INITIAL_DELAY_SECONDS,
): EnvironmentState {
  return {
    condition: "stable",
    intensity: 1,
    startedAt: 0,
    endsAt: 0,
    nextConditionAt,
    activeCrisis: null,
  };
}

export function normalizeEnvironmentState(state: GameState): void {
  const environment = state.environment ?? createDefaultEnvironmentState(state.elapsedSeconds + ENVIRONMENT_INITIAL_DELAY_SECONDS);
  const definition = getEnvironmentDefinitionOrStable(environment.condition);

  state.environment = {
    condition: definition.id,
    intensity: clampIntensity(environment.intensity),
    startedAt: Math.max(0, environment.startedAt || 0),
    endsAt: Math.max(0, environment.endsAt || 0),
    nextConditionAt: Math.max(
      state.elapsedSeconds,
      environment.nextConditionAt || state.elapsedSeconds + ENVIRONMENT_INITIAL_DELAY_SECONDS,
    ),
    activeCrisis: environment.activeCrisis?.kind === "shelter"
      ? {
        kind: "shelter",
        startedAt: Math.max(0, environment.activeCrisis.startedAt || state.elapsedSeconds),
        deadlineAt: Math.max(state.elapsedSeconds, environment.activeCrisis.deadlineAt || state.elapsedSeconds),
        initialHomeless: Math.max(0, Math.floor(environment.activeCrisis.initialHomeless || 0)),
        lastWarningAt: Math.max(0, environment.activeCrisis.lastWarningAt || 0),
      }
      : null,
  };
}

export function tickEnvironment(state: GameState, deltaSeconds: number): void {
  normalizeEnvironmentState(state);
  endExpiredCondition(state);
  startNextCondition(state);
  tickShelterCrisis(state, deltaSeconds);
}

export { getEnvironmentMoralePenaltyPerHour };

function endExpiredCondition(state: GameState): void {
  const environment = state.environment;

  if (environment.condition === "stable" || state.elapsedSeconds < environment.endsAt) {
    return;
  }

  const definition = getEnvironmentDefinition(environment.condition);

  if (definition.logEndKey) {
    pushLocalizedLog(state, definition.logEndKey);
  }

  state.environment = createDefaultEnvironmentState(
    state.elapsedSeconds + ENVIRONMENT_COOLDOWN_HOURS * GAME_HOUR_REAL_SECONDS,
  );
}

function startNextCondition(state: GameState): void {
  const environment = state.environment;

  if (environment.condition !== "stable" || state.elapsedSeconds < environment.nextConditionAt) {
    return;
  }

  const condition = pickNextCondition(state);
  if (!condition) {
    const stableDefinition = getEnvironmentDefinition("stable");
    const stableDurationHours = pickDurationHours(
      state,
      stableDefinition.minDurationHours,
      stableDefinition.maxDurationHours,
    );
    state.environment = createDefaultEnvironmentState(
      state.elapsedSeconds + stableDurationHours * GAME_HOUR_REAL_SECONDS,
    );
    return;
  }

  const intensity = pickIntensity(state);
  const definition = getEnvironmentDefinition(condition);
  const durationHours = pickDurationHours(state, definition.minDurationHours, definition.maxDurationHours);

  state.environment = {
    condition,
    intensity,
    startedAt: state.elapsedSeconds,
    endsAt: state.elapsedSeconds + durationHours * GAME_HOUR_REAL_SECONDS,
    nextConditionAt: state.elapsedSeconds + durationHours * GAME_HOUR_REAL_SECONDS,
    activeCrisis: null,
  };

  if (definition.logStartKey) {
    pushLocalizedLog(state, definition.logStartKey, {
      intensity,
    });
  }
}

function tickShelterCrisis(state: GameState, _deltaSeconds: number): void {
  const environment = state.environment;

  if (environment.condition !== "snowFront") {
    environment.activeCrisis = null;
    return;
  }

  const homeless = getHousingStatus(state).homeless;

  if (homeless <= 0) {
    if (environment.activeCrisis) {
      pushLocalizedLog(state, "logShelterCrisisResolved");
      environment.activeCrisis = null;
    }
    return;
  }

  if (!environment.activeCrisis) {
    const definition = getEnvironmentDefinition("snowFront");
    const deadlineHours =
      definition.shelterDeadlineHoursByIntensity?.[
        getEnvironmentIntensityIndex(environment.intensity)
      ] ?? 8;

    environment.activeCrisis = {
      kind: "shelter",
      startedAt: state.elapsedSeconds,
      deadlineAt: state.elapsedSeconds + deadlineHours * GAME_HOUR_REAL_SECONDS,
      initialHomeless: homeless,
      lastWarningAt: 0,
    };
    pushLocalizedLog(state, "logShelterCrisisStarted", {
      count: homeless,
      hours: deadlineHours,
    });
    return;
  }

  const crisis = environment.activeCrisis;
  if (
    crisis.lastWarningAt <= crisis.startedAt &&
    state.elapsedSeconds >= crisis.deadlineAt - SHELTER_WARNING_LEAD_SECONDS
  ) {
    crisis.lastWarningAt = state.elapsedSeconds;
    pushLocalizedLog(state, "logShelterCrisisWarning", {
      count: homeless,
    });
  }

  if (state.elapsedSeconds < crisis.deadlineAt) {
    return;
  }

  applyShelterExposure(state, homeless);
  environment.activeCrisis = {
    ...crisis,
    startedAt: state.elapsedSeconds,
    deadlineAt: state.elapsedSeconds + SHELTER_REPEAT_DEADLINE_HOURS * GAME_HOUR_REAL_SECONDS,
    initialHomeless: getHousingStatus(state).homeless,
    lastWarningAt: 0,
  };
}

function applyShelterExposure(state: GameState, homeless: number): void {
  const intensity = clampIntensity(state.environment.intensity);
  const deaths = getExposureDeaths(homeless, intensity);
  const injuries = getExposureInjuries(homeless, deaths, intensity);
  let killed = 0;

  for (let index = 0; index < deaths; index += 1) {
    if (!killCampSurvivor(state)) {
      break;
    }

    killed += 1;
  }

  const injured = injureSurvivors(state, injuries, "logShelterExposureInjury");
  const moraleLoss = killed * 8 + injured * 3 + intensity * 2;

  if (moraleLoss > 0) {
    addResources(state.resources, { morale: -moraleLoss }, state.capacities);
  }

  pushLocalizedLog(state, "logShelterExposure", {
    deaths: killed,
    injured,
    morale: moraleLoss,
  });
}

function getExposureDeaths(homeless: number, intensity: number): number {
  if (intensity <= 1) {
    return 0;
  }

  const ratio = intensity >= 3 ? 0.4 : 0.25;
  return Math.min(homeless, Math.max(1, Math.floor(homeless * ratio)));
}

function getExposureInjuries(homeless: number, deaths: number, intensity: number): number {
  const remaining = Math.max(0, homeless - deaths);
  const ratio = intensity >= 3 ? 0.5 : 0.35;

  return Math.min(remaining, Math.ceil(remaining * ratio));
}

function pickNextCondition(state: GameState): Exclude<EnvironmentConditionId, "stable"> | null {
  const activeRoll = stableRoll(`condition-active:${Math.floor(state.environment.nextConditionAt)}:${state.saveId}`);
  if (activeRoll >= ACTIVE_CONDITION_ROLL_THRESHOLD) {
    return null;
  }

  const roll = stableRoll(`condition:${Math.floor(state.environment.nextConditionAt)}:${state.saveId}`);
  const index = roll < 38 ? 0 : roll < 70 ? 1 : 2;

  return activeConditionIds[index];
}

function pickIntensity(state: GameState): number {
  const roll = stableRoll(`intensity:${Math.floor(state.environment.nextConditionAt)}:${state.saveId}`);

  if (roll < 61) {
    return 1;
  }

  return 2;
}

function pickDurationHours(state: GameState, minHours: number, maxHours: number): number {
  const roll = stableRoll(`duration:${Math.floor(state.environment.nextConditionAt)}:${state.saveId}`);
  const span = Math.max(0, maxHours - minHours);

  return minHours + (roll / 100) * span;
}

function getEnvironmentDefinitionOrStable(condition: EnvironmentConditionId | undefined) {
  return condition ? getEnvironmentDefinition(condition) : getEnvironmentDefinition("stable");
}

function clampIntensity(intensity: number): number {
  return Math.max(
    ENVIRONMENT_MIN_INTENSITY,
    Math.min(ENVIRONMENT_MAX_INTENSITY, Math.floor(intensity || 1)),
  );
}

function stableRoll(seed: string): number {
  let value = 0;

  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 100;
  }

  return value;
}
