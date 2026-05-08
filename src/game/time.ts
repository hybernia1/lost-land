export const GAME_DAY_REAL_SECONDS = 45 * 60;
export const GAME_HOUR_REAL_SECONDS = GAME_DAY_REAL_SECONDS / 24;
const GAME_CLOCK_SECONDS_PER_DAY = 24 * 60 * 60;
const GAME_CLOCK_START_HOUR = 8;

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

function getAbsoluteGameSeconds(elapsedSeconds: number): number {
  const startOffsetSeconds = GAME_CLOCK_START_HOUR * 60 * 60;
  return startOffsetSeconds + (elapsedSeconds / GAME_DAY_REAL_SECONDS) * GAME_CLOCK_SECONDS_PER_DAY;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
