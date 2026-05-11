import { GAME_HOUR_REAL_SECONDS } from "../../../game/time";

export function formatRate(value: number): string {
  if (Math.abs(value) >= 10) {
    return value.toFixed(0);
  }

  return value.toFixed(1);
}

export function formatPercentBonus(value: number): string {
  return `+${Math.round(value * 100)}%`;
}

export function formatTemplate(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function formatScoutingRemaining(seconds: number): string {
  const gameHours = seconds / GAME_HOUR_REAL_SECONDS;

  if (gameHours >= 1) {
    return `${Math.ceil(gameHours)}h`;
  }

  return `${Math.max(1, Math.ceil(gameHours * 60))}m`;
}

export function getHourlyRateLabel(ratePerSecond: number): string {
  const hourlyRate = ratePerSecond * GAME_HOUR_REAL_SECONDS;

  if (Math.abs(hourlyRate) < 0.05) {
    return "0/h";
  }

  return `${hourlyRate > 0 ? "+" : ""}${formatRate(hourlyRate)}/h`;
}

export function getRateColor(ratePerSecond: number): number {
  const hourlyRate = ratePerSecond * GAME_HOUR_REAL_SECONDS;

  if (hourlyRate > 0.05) {
    return 0x8fe0b8;
  }

  if (hourlyRate < -0.05) {
    return 0xff9aa2;
  }

  return 0xaeb4b8;
}
