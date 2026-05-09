import { gameConfig } from "./config";

export const GAME_DAY_REAL_SECONDS = gameConfig.time.dayRealSeconds;
export const GAME_HOUR_REAL_SECONDS = GAME_DAY_REAL_SECONDS / 24;
export const DAY_START_HOUR = gameConfig.time.dayStartHour;
export const DUSK_START_HOUR = gameConfig.time.duskStartHour;
export const NIGHT_START_HOUR = gameConfig.time.nightStartHour;
export const DAWN_START_HOUR = gameConfig.time.dawnStartHour;
const GAME_CLOCK_SECONDS_PER_DAY = 24 * 60 * 60;
const GAME_CLOCK_START_HOUR = gameConfig.time.clockStartHour;

export type DaylightPhase = "day" | "dusk" | "night" | "dawn";

export type DaylightState = {
  phase: DaylightPhase;
  darkness: number;
};

export function getGameDay(elapsedSeconds: number): number {
  return Math.floor(getAbsoluteGameSeconds(elapsedSeconds) / GAME_CLOCK_SECONDS_PER_DAY) + 1;
}

export function formatGameClock(elapsedSeconds: number): string {
  const gameSeconds = Math.floor(
    positiveModulo(getAbsoluteGameSeconds(elapsedSeconds), GAME_CLOCK_SECONDS_PER_DAY),
  );
  const hours = Math.floor(gameSeconds / 60 / 60);
  const minutes = Math.floor((gameSeconds % (60 * 60)) / 60);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function getGameHour(elapsedSeconds: number): number {
  const gameSeconds = Math.floor(
    positiveModulo(getAbsoluteGameSeconds(elapsedSeconds), GAME_CLOCK_SECONDS_PER_DAY),
  );

  return Math.floor(gameSeconds / 60 / 60);
}

export function getGameHourFloat(elapsedSeconds: number): number {
  const gameSeconds = positiveModulo(getAbsoluteGameSeconds(elapsedSeconds), GAME_CLOCK_SECONDS_PER_DAY);

  return gameSeconds / 60 / 60;
}

export function isDaylightHour(elapsedSeconds: number): boolean {
  const hour = getGameHour(elapsedSeconds);

  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR;
}

export function getDaylightState(elapsedSeconds: number): DaylightState {
  const hour = getGameHourFloat(elapsedSeconds);

  if (hour >= DAY_START_HOUR && hour < DUSK_START_HOUR) {
    return { phase: "day", darkness: 0 };
  }

  if (hour >= DUSK_START_HOUR && hour < NIGHT_START_HOUR) {
    return {
      phase: "dusk",
      darkness: interpolate(0, 0.48, (hour - DUSK_START_HOUR) / (NIGHT_START_HOUR - DUSK_START_HOUR)),
    };
  }

  if (hour >= DAWN_START_HOUR && hour < DAY_START_HOUR) {
    return {
      phase: "dawn",
      darkness: interpolate(0.52, 0, (hour - DAWN_START_HOUR) / (DAY_START_HOUR - DAWN_START_HOUR)),
    };
  }

  return { phase: "night", darkness: 0.52 };
}

function getAbsoluteGameSeconds(elapsedSeconds: number): number {
  const startOffsetSeconds = GAME_CLOCK_START_HOUR * 60 * 60;
  return startOffsetSeconds + (elapsedSeconds / GAME_DAY_REAL_SECONDS) * GAME_CLOCK_SECONDS_PER_DAY;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function interpolate(from: number, to: number, progress: number): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return from + (to - from) * clampedProgress;
}
