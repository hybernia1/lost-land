export const ACADEMY_BASE_PRODUCTION_BONUS = 0.05;
export const ACADEMY_BUILD_TIME_REDUCTION = 0.7;

export function getAcademyProductionBonus(level: number): number {
  return level >= 1 ? ACADEMY_BASE_PRODUCTION_BONUS : 0;
}

export function getAcademyBuildTimeMultiplier(level: number): number {
  return level >= 3 ? 1 - ACADEMY_BUILD_TIME_REDUCTION : 1;
}
