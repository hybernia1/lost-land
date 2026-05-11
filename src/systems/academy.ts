export const ACADEMY_BASE_PRODUCTION_BONUS = 0.05;
export const ACADEMY_EXPEDITION_DEATH_RISK_REDUCTION = 0.22;
export const ACADEMY_BUILD_TIME_REDUCTION = 0.7;

export function getAcademyProductionBonus(level: number): number {
  return level >= 1 ? ACADEMY_BASE_PRODUCTION_BONUS : 0;
}

export function getAcademyExpeditionDeathRiskMultiplier(level: number): number {
  return level >= 2 ? 1 - ACADEMY_EXPEDITION_DEATH_RISK_REDUCTION : 1;
}

export function getAcademyBuildTimeMultiplier(level: number): number {
  return level >= 3 ? 1 - ACADEMY_BUILD_TIME_REDUCTION : 1;
}
