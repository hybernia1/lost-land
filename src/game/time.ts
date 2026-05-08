const GAME_DAY_REAL_SECONDS = 45 * 60;
const GAME_CLOCK_SECONDS_PER_DAY = 24 * 60 * 60;
const GAME_CLOCK_START_HOUR = 8;

export function getGameDay(elapsedSeconds: number): number {
  return Math.floor(elapsedSeconds / GAME_DAY_REAL_SECONDS) + 1;
}

export function formatGameClock(elapsedSeconds: number): string {
  const dayProgress =
    (positiveModulo(elapsedSeconds, GAME_DAY_REAL_SECONDS) / GAME_DAY_REAL_SECONDS);
  const startOffsetSeconds = GAME_CLOCK_START_HOUR * 60 * 60;
  const gameSeconds = Math.floor(
    positiveModulo(
      startOffsetSeconds + dayProgress * GAME_CLOCK_SECONDS_PER_DAY,
      GAME_CLOCK_SECONDS_PER_DAY,
    ),
  );
  const hours = Math.floor(gameSeconds / 60 / 60);
  const minutes = Math.floor((gameSeconds % (60 * 60)) / 60);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
