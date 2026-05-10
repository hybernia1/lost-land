import { gameConfig } from "../game/config";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import type { EnvironmentConditionId, EnvironmentState } from "../game/types";

export type EnvironmentDefinition = {
  id: EnvironmentConditionId;
  labelKey: string;
  logStartKey?: string;
  logEndKey?: string;
  minDurationHours: number;
  maxDurationHours: number;
  moralePenaltyPerHourByIntensity: number[];
  healthIncidentChanceByIntensity: number[];
  shelterDeadlineHoursByIntensity?: number[];
};

export const environmentDefinitions: Record<EnvironmentConditionId, EnvironmentDefinition> = {
  stable: {
    id: "stable",
    labelKey: "environmentStable",
    minDurationHours: 10,
    maxDurationHours: 16,
    moralePenaltyPerHourByIntensity: [0, 0],
    healthIncidentChanceByIntensity: [0, 0],
  },
  rain: {
    id: "rain",
    labelKey: "environmentRain",
    logStartKey: "logEnvironmentRainStarted",
    logEndKey: "logEnvironmentRainEnded",
    minDurationHours: 6,
    maxDurationHours: 10,
    moralePenaltyPerHourByIntensity: [0.25, 0.45],
    healthIncidentChanceByIntensity: [2, 4],
  },
  snowFront: {
    id: "snowFront",
    labelKey: "environmentSnowFront",
    logStartKey: "logEnvironmentSnowStarted",
    logEndKey: "logEnvironmentSnowEnded",
    minDurationHours: 8,
    maxDurationHours: 14,
    moralePenaltyPerHourByIntensity: [0.35, 0.7],
    healthIncidentChanceByIntensity: [3, 6],
    shelterDeadlineHoursByIntensity: [10, 7],
  },
  radiation: {
    id: "radiation",
    labelKey: "environmentRadiation",
    logStartKey: "logEnvironmentRadiationStarted",
    logEndKey: "logEnvironmentRadiationEnded",
    minDurationHours: 5,
    maxDurationHours: 9,
    moralePenaltyPerHourByIntensity: [0.55, 0.95],
    healthIncidentChanceByIntensity: [8, 14],
  },
};

export const ENVIRONMENT_MIN_INTENSITY = gameConfig.environment.minIntensity;
export const ENVIRONMENT_MAX_INTENSITY = gameConfig.environment.maxIntensity;
export const ENVIRONMENT_INITIAL_DELAY_SECONDS =
  GAME_HOUR_REAL_SECONDS * gameConfig.environment.initialDelayHours;
export const ENVIRONMENT_COOLDOWN_HOURS = gameConfig.environment.cooldownHours;
export const SHELTER_WARNING_LEAD_SECONDS =
  GAME_HOUR_REAL_SECONDS * gameConfig.environment.shelterWarningLeadHours;
export const SHELTER_REPEAT_DEADLINE_HOURS = gameConfig.environment.shelterRepeatDeadlineHours;

export function getEnvironmentDefinition(
  condition: EnvironmentConditionId,
): EnvironmentDefinition {
  return environmentDefinitions[condition];
}

export function getEnvironmentIntensityIndex(intensity: number): number {
  return Math.max(
    0,
    Math.min(ENVIRONMENT_MAX_INTENSITY - 1, Math.floor(intensity) - 1),
  );
}

export function getEnvironmentMoralePenaltyPerHour(environment: EnvironmentState): number {
  const definition = getEnvironmentDefinition(environment.condition);

  return definition.moralePenaltyPerHourByIntensity[
    getEnvironmentIntensityIndex(environment.intensity)
  ] ?? 0;
}
