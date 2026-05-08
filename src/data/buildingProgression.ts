import type { BuildingLevelRequirement, ResourceBag } from "../game/types";

export const MAX_BUILDING_LEVEL = 20;

export function createBuildingLevelRequirements(options: {
  baseCost: ResourceBag;
  baseBuildSeconds: number;
  baseConstructionWorkers: number;
}): BuildingLevelRequirement[] {
  return Array.from({ length: MAX_BUILDING_LEVEL }, (_, index) => {
    const currentLevel = index;
    return {
      level: currentLevel + 1,
      cost: scaleResourceBag(options.baseCost, getCostMultiplier(currentLevel)),
      buildSeconds: Math.ceil(options.baseBuildSeconds * getBuildTimeMultiplier(currentLevel)),
      constructionWorkers: getConstructionWorkerRequirementForLevel(
        options.baseConstructionWorkers,
        currentLevel,
      ),
    };
  });
}

export function getCostMultiplier(currentLevel: number): number {
  return 1 + currentLevel * 0.72;
}

export function getBuildTimeMultiplier(currentLevel: number): number {
  return 1 + currentLevel * 0.35;
}

export function getConstructionWorkerRequirementForLevel(
  baseConstructionWorkers: number,
  currentLevel: number,
): number {
  return Math.min(6, baseConstructionWorkers + Math.floor(currentLevel / 3));
}

function scaleResourceBag(bag: ResourceBag, multiplier: number): ResourceBag {
  return Object.fromEntries(
    Object.entries(bag).map(([resourceId, amount]) => [
      resourceId,
      Math.ceil((amount ?? 0) * multiplier),
    ]),
  ) as ResourceBag;
}
