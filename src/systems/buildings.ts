import { buildingById, buildingDefinitions } from "../data/buildings";
import { getEnvironmentMoralePenaltyPerHour } from "../data/environment";
import { resourceIds } from "../data/resources";
import { defaultVillageLayout } from "../data/villageLayouts";
import { plotAllowsBuilding } from "../data/villagePlots";
import { GAME_HOUR_REAL_SECONDS, isDaylightHour } from "../game/time";
import type {
  BuildingId,
  GameState,
  ResourceBag,
  ResourceId,
} from "../game/types";
import { getAcademyBuildTimeMultiplier } from "./academy";
import { maybeInjureFromConstruction } from "./health";
import { pushLocalizedLog } from "./log";
import { getPopulation } from "./population";
import {
  getGlobalProductionMultiplier,
  getMainBuildingProductionBonus,
  getMoraleProductionMultiplier,
} from "./production";
import { addResources, canAfford, spendResources } from "./resources";

export {
  getGlobalProductionMultiplier,
  getMainBuildingProductionBonus,
  getMoraleProductionMultiplier,
} from "./production";

const BASE_CAPACITY: Record<ResourceId, number> = {
  food: 180,
  water: 180,
  material: 260,
  coal: 120,
  morale: 100,
};

export const MAX_ACTIVE_BUILDINGS = 2;
const BUILDING_LEVEL_GATE_LEVELS = [3, 5, 7, 10, 15] as const;
const MAIN_BUILDING_SURVIVOR_ATTRACTION_LEVELS = new Set([2, 3, 5, 7, 10, 15, 20]);
const COAL_MINE_BASE_COAL_RATE = 0.28;
const HOMELESS_MORALE_PENALTY_PER_HOUR = 1;
const CONTINUOUS_SHIFT_NIGHT_NET_MORALE_LOSS_PER_HOUR = 6;
const MAIN_BUILDING_BASE_MORALE_PER_HOUR = 0.08;
const villagePlotDefinitions = defaultVillageLayout.plots;
const villagePlotDefinitionById = new Map(villagePlotDefinitions.map((plot) => [plot.id, plot]));
const reservedBuildingIds = new Set(
  villagePlotDefinitions.flatMap((plot) => plot.allowedBuildingIds ?? []),
);
const MAIN_BUILDING_MAX_MORALE_PER_HOUR = 0.55;
const WORKSHOP_BASE_MATERIAL_RATE = 0.22;
const WORKSHOP_BASE_COAL_RATE = 0.025;
const FOOD_CONSUMPTION_PER_SURVIVOR_PER_SECOND = 0.017;
const WATER_CONSUMPTION_PER_SURVIVOR_PER_SECOND = 0.023;

export type ResourceBreakdownLine = {
  source:
    | "building"
    | "coalMine"
    | "survivorConsumption"
    | "homeless"
    | "foodShortage"
    | "waterShortage"
    | "continuousShifts"
    | "environment"
    | "mainBuildingBonus"
    | "moraleProductionPenalty";
  resourceId: ResourceId;
  ratePerSecond: number;
  buildingId?: BuildingId;
  count?: number;
};

export function getUpgradeCost(buildingId: BuildingId, level: number): ResourceBag {
  return getNextBuildingLevelRequirement(buildingId, level).cost;
}

export function getBuildingBuildSeconds(
  state: GameState,
  buildingId: BuildingId,
  currentLevel: number,
): number {
  const baseSeconds = getNextBuildingLevelRequirement(buildingId, currentLevel).buildSeconds;
  const academyMultiplier = getAcademyBuildTimeMultiplier(state.buildings.academy.level);
  return Math.max(1, Math.ceil(baseSeconds * academyMultiplier));
}

export function getActiveBuildingQueue(state: GameState): BuildingId[] {
  return buildingDefinitions
    .filter((definition) => state.buildings[definition.id].upgradingRemaining > 0)
    .map((definition) => definition.id);
}

export function hasAvailableBuildingSlot(state: GameState): boolean {
  return getActiveBuildingQueue(state).length < MAX_ACTIVE_BUILDINGS;
}

export function getConstructionWorkerRequirement(
  buildingId: BuildingId,
  currentLevel: number,
): number {
  return getNextBuildingLevelRequirement(buildingId, currentLevel).constructionWorkers;
}

export function getSurvivorAttractionOnCompletedLevel(
  buildingId: BuildingId,
  completedLevel: number,
): number {
  if (buildingId === "mainBuilding") {
    return MAIN_BUILDING_SURVIVOR_ATTRACTION_LEVELS.has(completedLevel) ? 1 : 0;
  }

  if (
    buildingId === "dormitory" ||
    buildingId === "clinic" ||
    buildingId === "watchtower"
  ) {
    return 1;
  }

  return 0;
}

export function getSurvivorAttractionMoraleReward(
  buildingId: BuildingId,
  attractedSurvivors: number,
): number {
  if (attractedSurvivors <= 0) {
    return 0;
  }

  return attractedSurvivors * (buildingId === "mainBuilding" ? 1 : 2);
}

export function getMainBuildingLevelRequirement(
  buildingId: BuildingId,
  targetLevel: number,
): number {
  const customLevelRequirements = buildingById[buildingId].requiredMainBuildingLevelByUpgradeLevel;
  const customRequiredLevel = customLevelRequirements?.[targetLevel - 1];

  if (typeof customRequiredLevel === "number") {
    return Math.max(1, Math.floor(customRequiredLevel));
  }

  if (buildingId === "mainBuilding") {
    return 1;
  }

  return Math.max(
    buildingById[buildingId].requiredMainBuildingLevel ?? 1,
    getMainBuildingLevelRequirementForTargetLevel(targetLevel),
  );
}

export function isMainBuildingRequirementMet(
  state: GameState,
  buildingId: BuildingId,
  targetLevel: number,
): boolean {
  return state.buildings.mainBuilding.level >=
    getMainBuildingLevelRequirement(buildingId, targetLevel);
}

export function getMainBuildingLevelRequirementForTargetLevel(targetLevel: number): number {
  let requiredLevel = 1;

  for (const gateLevel of BUILDING_LEVEL_GATE_LEVELS) {
    if (targetLevel > gateLevel) {
      requiredLevel = gateLevel;
    }
  }

  return requiredLevel;
}

export function getBuildingWorkerLimit(state: GameState, buildingId: BuildingId): number {
  const building = state.buildings[buildingId];

  if (
    (buildingId !== "coalMine" && buildingId !== "workshop") ||
    building.level <= 0
  ) {
    return 0;
  }

  return Math.min(4, building.level + 1);
}

export function setBuildingWorkers(
  state: GameState,
  buildingId: BuildingId,
  targetWorkers: number,
): boolean {
  const building = state.buildings[buildingId];
  const workerLimit = getBuildingWorkerLimit(state, buildingId);
  const nextWorkers = Math.max(0, Math.min(workerLimit, Math.floor(targetWorkers)));
  const difference = nextWorkers - building.workers;

  if (difference === 0) {
    return false;
  }

  if (difference > 0 && state.survivors.workers < difference) {
    return false;
  }

  building.workers = nextWorkers;
  state.survivors.workers -= difference;
  return true;
}

export function getCoalMineCoalRate(level: number, workers: number): number {
  if (level <= 0 || workers <= 0) {
    return 0;
  }

  const workerLimit = Math.min(4, level + 1);
  const maxOutput = COAL_MINE_BASE_COAL_RATE * (1 + (level - 1) * 0.42);
  return maxOutput * Math.min(workers, workerLimit) / workerLimit;
}

export function getWorkshopMaterialRate(level: number, workers: number): number {
  if (level <= 0 || workers <= 0) {
    return 0;
  }

  return WORKSHOP_BASE_MATERIAL_RATE * level * getStaffedBuildingWorkerRatio(level, workers);
}

export function getWorkshopCoalRate(level: number, workers: number): number {
  if (level <= 0 || workers <= 0) {
    return 0;
  }

  return WORKSHOP_BASE_COAL_RATE * level * getStaffedBuildingWorkerRatio(level, workers);
}

function getStaffedBuildingWorkerRatio(level: number, workers: number): number {
  const workerLimit = Math.min(4, level + 1);

  return Math.min(workers, workerLimit) / workerLimit;
}

export function getMainBuildingMoraleRate(level: number): number {
  if (level <= 0) {
    return 0;
  }

  const clampedLevel = Math.min(20, Math.max(1, level));
  const moralePerHour = MAIN_BUILDING_BASE_MORALE_PER_HOUR +
    (clampedLevel - 1) *
      ((MAIN_BUILDING_MAX_MORALE_PER_HOUR - MAIN_BUILDING_BASE_MORALE_PER_HOUR) / 19);

  return moralePerHour / GAME_HOUR_REAL_SECONDS;
}

export function isBuildingInactiveDueToCoal(
  state: GameState,
  buildingId: BuildingId,
): boolean {
  const definition = buildingById[buildingId];
  const building = state.buildings[buildingId];
  const coalNeeded =
    (definition.consumes?.coal ?? 0) + (definition.alwaysConsumes?.coal ?? 0);

  return building.level > 0 &&
    building.upgradingRemaining <= 0 &&
    coalNeeded > 0 &&
    state.resources.coal <= 0;
}

export function isDayShiftHour(state: GameState): boolean {
  return isDaylightHour(state.elapsedSeconds);
}

export function isProductionShiftActive(state: GameState): boolean {
  return isDayShiftHour(state) || state.workMode === "continuous";
}

export function isContinuousNightShiftActive(state: GameState): boolean {
  return state.workMode === "continuous" && !isDayShiftHour(state);
}

export function isContinuousShiftFatigueActive(state: GameState): boolean {
  return isContinuousNightShiftActive(state);
}

export function getDormitoryHousingCapacity(state: GameState): number {
  const building = state.buildings.dormitory;
  const definition = buildingById.dormitory;

  if (building.level <= 0 || isBuildingInactiveDueToCoal(state, "dormitory")) {
    return 0;
  }

  return (definition.housing ?? 0) * building.level;
}

export function getHousingStatus(state: GameState): {
  housed: number;
  homeless: number;
  civilianCapacity: number;
} {
  const population = getPopulation(state);
  const troops = Object.values(state.survivors.units).reduce((total, count) => total + count, 0);
  const troopHousing = state.buildings.barracks.level > 0 ? troops : 0;
  const civilians = Math.max(0, population - troops);
  const civilianCapacity = getDormitoryHousingCapacity(state);
  const housedCivilians = Math.min(civilians, civilianCapacity);
  const housed = Math.min(population, troopHousing + housedCivilians);

  return {
    housed,
    homeless: Math.max(0, population - housed),
    civilianCapacity,
  };
}

export function getResourceBreakdown(
  state: GameState,
  resourceId: ResourceId,
): ResourceBreakdownLine[] {
  const lines: ResourceBreakdownLine[] = [];
  const productionActive = isProductionShiftActive(state);
  const productionBonus = getMainBuildingProductionBonus(state.buildings.mainBuilding.level);
  const moraleMultiplier = getMoraleProductionMultiplier(state.resources.morale);

  for (const definition of buildingDefinitions) {
    const building = state.buildings[definition.id];

    if (
      building.level <= 0 ||
      building.upgradingRemaining > 0
    ) {
      continue;
    }

    const alwaysRate = -(definition.alwaysConsumes?.[resourceId] ?? 0) * building.level;

    if (alwaysRate !== 0) {
      lines.push({
        source: "building",
        resourceId,
        buildingId: definition.id,
        ratePerSecond: alwaysRate,
      });
    }

    if (!productionActive) {
      continue;
    }

    if (definition.id === "coalMine") {
      const baseRatePerSecond = resourceId === "coal"
        ? getCoalMineCoalRate(building.level, building.workers)
        : 0;

      if (baseRatePerSecond !== 0) {
        lines.push({
          source: "coalMine",
          resourceId,
          buildingId: definition.id,
          ratePerSecond: baseRatePerSecond,
        });
        pushMainBuildingBonusLine(lines, resourceId, baseRatePerSecond, productionBonus);
        pushMoraleProductionPenaltyLine(
          lines,
          resourceId,
          baseRatePerSecond,
          productionBonus,
          moraleMultiplier,
        );
      }
      continue;
    }

    if (definition.id === "workshop") {
      if (isBuildingInactiveDueToCoal(state, definition.id)) {
        continue;
      }

      const productionRatePerSecond = resourceId === "material"
        ? getWorkshopMaterialRate(building.level, building.workers)
        : 0;
      const consumptionRatePerSecond = resourceId === "coal"
        ? getWorkshopCoalRate(building.level, building.workers)
        : 0;
      const ratePerSecond = productionRatePerSecond - consumptionRatePerSecond;

      if (ratePerSecond !== 0) {
        lines.push({
          source: "building",
          resourceId,
          buildingId: definition.id,
          ratePerSecond,
        });
      }
      pushMainBuildingBonusLine(lines, resourceId, productionRatePerSecond, productionBonus);
      pushMoraleProductionPenaltyLine(
        lines,
        resourceId,
        productionRatePerSecond,
        productionBonus,
        moraleMultiplier,
      );
      continue;
    }

    if (isBuildingInactiveDueToCoal(state, definition.id)) {
      continue;
    }

    if (definition.id === "mainBuilding") {
      const productionRatePerSecond = resourceId === "morale"
        ? getMainBuildingMoraleRate(building.level)
        : 0;
      const consumptionRatePerSecond = (definition.consumes?.[resourceId] ?? 0) * building.level;

      if (productionRatePerSecond !== 0) {
        lines.push({
          source: "building",
          resourceId,
          buildingId: definition.id,
          ratePerSecond: productionRatePerSecond,
        });
      }

      if (consumptionRatePerSecond !== 0) {
        lines.push({
          source: "building",
          resourceId,
          buildingId: definition.id,
          ratePerSecond: -consumptionRatePerSecond,
        });
      }
      continue;
    }

    const productionRatePerSecond = (definition.produces?.[resourceId] ?? 0) * building.level;
    const consumptionRatePerSecond = (definition.consumes?.[resourceId] ?? 0) * building.level;

    if (productionRatePerSecond !== 0) {
      lines.push({
        source: "building",
        resourceId,
        buildingId: definition.id,
        ratePerSecond: productionRatePerSecond,
      });
    }

    if (consumptionRatePerSecond !== 0) {
      lines.push({
        source: "building",
        resourceId,
        buildingId: definition.id,
        ratePerSecond: -consumptionRatePerSecond,
      });
    }

    if (resourceId !== "morale") {
      pushMainBuildingBonusLine(lines, resourceId, productionRatePerSecond, productionBonus);
      pushMoraleProductionPenaltyLine(
        lines,
        resourceId,
        productionRatePerSecond,
        productionBonus,
        moraleMultiplier,
      );
    }
  }

  const homeless = getHousingStatus(state).homeless;
  if (resourceId === "morale" && homeless > 0) {
    lines.push({
      source: "homeless",
      resourceId,
      count: homeless,
      ratePerSecond: -homeless * HOMELESS_MORALE_PENALTY_PER_HOUR / GAME_HOUR_REAL_SECONDS,
    });
  }

  if (resourceId === "morale" && isContinuousShiftFatigueActive(state)) {
    lines.push({
      source: "continuousShifts",
      resourceId,
      ratePerSecond: -getContinuousShiftMoralePenaltyPerHour(state) /
        GAME_HOUR_REAL_SECONDS,
    });
  }

  const environmentMoralePenaltyPerHour = getEnvironmentMoralePenaltyPerHour(state.environment);
  if (resourceId === "morale" && environmentMoralePenaltyPerHour > 0) {
    lines.push({
      source: "environment",
      resourceId,
      ratePerSecond: -environmentMoralePenaltyPerHour / GAME_HOUR_REAL_SECONDS,
    });
  }

  const population = getPopulation(state);
  if (resourceId === "food") {
    lines.push({
      source: "survivorConsumption",
      resourceId,
      count: population,
      ratePerSecond: -population * FOOD_CONSUMPTION_PER_SURVIVOR_PER_SECOND,
    });
  }

  if (resourceId === "water") {
    lines.push({
      source: "survivorConsumption",
      resourceId,
      count: population,
      ratePerSecond: -population * WATER_CONSUMPTION_PER_SURVIVOR_PER_SECOND,
    });
  }

  const currentRates = getProductionDelta(state, 1);
  if (resourceId === "morale" && (currentRates.food ?? 0) < 0 && state.resources.food <= 0) {
    lines.push({ source: "foodShortage", resourceId, ratePerSecond: -0.08 });
  }

  if (resourceId === "morale" && (currentRates.water ?? 0) < 0 && state.resources.water <= 0) {
    lines.push({ source: "waterShortage", resourceId, ratePerSecond: -0.11 });
  }

  return lines;
}

export function getPlacedBuildingIds(state: GameState): Set<BuildingId> {
  return new Set(
    state.village.plots
      .map((plot) => plot.buildingId)
      .filter((buildingId): buildingId is BuildingId => buildingId !== null),
  );
}

export function getAvailableBuildingsForPlot(
  state: GameState,
  plotId: string,
): BuildingId[] {
  const placedBuildingIds = getPlacedBuildingIds(state);
  const plotDefinition = villagePlotDefinitionById.get(plotId);
  const allowedBuildingIds = plotDefinition?.allowedBuildingIds;

  if (!plotDefinition) {
    return [];
  }

  return buildingDefinitions
    .filter((definition) => {
      if (allowedBuildingIds) {
        return allowedBuildingIds.includes(definition.id);
      }

      return !reservedBuildingIds.has(definition.id);
    })
    .filter((definition) => !placedBuildingIds.has(definition.id))
    .map((definition) => definition.id);
}

export function startBuildingConstruction(
  state: GameState,
  plotId: string,
  buildingId: BuildingId,
): boolean {
  const plot = state.village.plots.find((candidate) => candidate.id === plotId);
  const plotDefinition = villagePlotDefinitionById.get(plotId);
  const building = state.buildings[buildingId];
  const definition = buildingById[buildingId];

  if (!hasAvailableBuildingSlot(state)) {
    return false;
  }

  if (
    !plot ||
    !plotDefinition ||
    plot.buildingId !== null ||
    getPlacedBuildingIds(state).has(buildingId)
  ) {
    return false;
  }

  if (plotDefinition?.allowedBuildingIds && !plotAllowsBuilding(plotDefinition, buildingId)) {
    return false;
  }

  if (
    !plotDefinition?.allowedBuildingIds &&
    reservedBuildingIds.has(buildingId)
  ) {
    return false;
  }

  if (building.level > 0 || building.upgradingRemaining > 0) {
    return false;
  }

  if (!isMainBuildingRequirementMet(state, buildingId, 1)) {
    return false;
  }

  const cost = getUpgradeCost(buildingId, 0);
  const constructionWorkers = getConstructionWorkerRequirement(buildingId, 0);

  if (!canAfford(state.resources, cost) || state.survivors.workers < constructionWorkers) {
    return false;
  }

  plot.buildingId = buildingId;
  spendResources(state.resources, cost);
  state.survivors.workers -= constructionWorkers;
  building.constructionWorkers = constructionWorkers;
  building.upgradingRemaining = getBuildingBuildSeconds(state, buildingId, 0);
  pushLocalizedLog(state, "logConstructionStarted", {
    buildingId: definition.id,
  });
  return true;
}

export function startBuildingUpgrade(state: GameState, buildingId: BuildingId): boolean {
  const building = state.buildings[buildingId];
  const definition = buildingById[buildingId];

  if (
    !hasAvailableBuildingSlot(state) ||
    !getPlacedBuildingIds(state).has(buildingId) ||
    building.level <= 0 ||
    building.level >= definition.maxLevel ||
    building.upgradingRemaining > 0 ||
    !isMainBuildingRequirementMet(state, buildingId, building.level + 1)
  ) {
    return false;
  }

  const cost = getUpgradeCost(buildingId, building.level);
  const constructionWorkers = getConstructionWorkerRequirement(buildingId, building.level);

  if (!canAfford(state.resources, cost) || state.survivors.workers < constructionWorkers) {
    return false;
  }

  spendResources(state.resources, cost);
  state.survivors.workers -= constructionWorkers;
  building.constructionWorkers = constructionWorkers;
  building.upgradingRemaining = getBuildingBuildSeconds(state, buildingId, building.level);
  pushLocalizedLog(state, "logUpgradeStarted", {
    buildingId: definition.id,
  });
  return true;
}

export function tickBuildings(state: GameState, deltaSeconds: number): void {
  for (const definition of buildingDefinitions) {
    const building = state.buildings[definition.id];

    if (building.upgradingRemaining <= 0) {
      continue;
    }

    building.upgradingRemaining = Math.max(
      0,
      building.upgradingRemaining - deltaSeconds,
    );

    if (building.upgradingRemaining === 0) {
      building.level += 1;
      recalculateCapacities(state);
      pushLocalizedLog(state, "logReachedLevel", {
        buildingId: definition.id,
        level: building.level,
      });

      const attractedSurvivors = getSurvivorAttractionOnCompletedLevel(
        definition.id,
        building.level,
      );

      if (attractedSurvivors > 0) {
        const moraleReward = getSurvivorAttractionMoraleReward(
          definition.id,
          attractedSurvivors,
        );

        state.survivors.workers += attractedSurvivors;
        state.resources.morale = Math.min(
          100,
          state.resources.morale + moraleReward,
        );
        pushLocalizedLog(
          state,
          attractedSurvivors === 1 ? "logSurvivorJoined" : "logSurvivorsJoined",
          { count: attractedSurvivors },
        );
      }

      building.workers = Math.min(
        building.workers,
        getBuildingWorkerLimit(state, definition.id),
      );
      maybeInjureFromConstruction(state, definition.id);
      releaseConstructionWorkers(state, building);
    }
  }
}

export function applyProduction(state: GameState, deltaSeconds: number): void {
  addResources(
    state.resources,
    getProductionDelta(state, deltaSeconds),
    state.capacities,
  );
}

export function getResourceProductionRates(state: GameState): Record<ResourceId, number> {
  return getProductionDelta(state, 1);
}

function getProductionDelta(
  state: GameState,
  deltaSeconds: number,
): Record<ResourceId, number> {
  const delta = createEmptyResourceDelta();
  const productionActive = isProductionShiftActive(state);
  const productionMultiplier = getGlobalProductionMultiplier(state);

  for (const definition of buildingDefinitions) {
    const building = state.buildings[definition.id];

    if (building.level <= 0 || building.upgradingRemaining > 0) {
      continue;
    }

    applyRate(delta, definition.alwaysConsumes, building.level, deltaSeconds, -1);

    if (!productionActive) {
      continue;
    }

    if (definition.id === "coalMine") {
      delta.coal +=
        getCoalMineCoalRate(building.level, building.workers) *
        productionMultiplier *
        deltaSeconds;
      continue;
    }

    if (definition.id === "workshop") {
      if (isBuildingInactiveDueToCoal(state, definition.id)) {
        continue;
      }

      delta.material +=
        getWorkshopMaterialRate(building.level, building.workers) *
        productionMultiplier *
        deltaSeconds;
      delta.coal -= getWorkshopCoalRate(building.level, building.workers) * deltaSeconds;
      continue;
    }

    if (isBuildingInactiveDueToCoal(state, definition.id)) {
      continue;
    }

    if (definition.id === "mainBuilding") {
      delta.morale += getMainBuildingMoraleRate(building.level) * deltaSeconds;
      applyRate(delta, definition.consumes, building.level, deltaSeconds, -1);
      continue;
    }

    applyProductionRate(delta, definition.produces, building.level, productionMultiplier, deltaSeconds);
    applyRate(delta, definition.consumes, building.level, deltaSeconds, -1);
  }

  const population = getPopulation(state);
  delta.food = (delta.food ?? 0) -
    population * FOOD_CONSUMPTION_PER_SURVIVOR_PER_SECOND * deltaSeconds;
  delta.water = (delta.water ?? 0) -
    population * WATER_CONSUMPTION_PER_SURVIVOR_PER_SECOND * deltaSeconds;

  const homeless = getHousingStatus(state).homeless;
  delta.morale = (delta.morale ?? 0) -
    homeless * HOMELESS_MORALE_PENALTY_PER_HOUR * deltaSeconds / GAME_HOUR_REAL_SECONDS;

  if (isContinuousShiftFatigueActive(state)) {
    delta.morale = (delta.morale ?? 0) -
      getContinuousShiftMoralePenaltyPerHour(state) *
        deltaSeconds /
        GAME_HOUR_REAL_SECONDS;
  }

  delta.morale = (delta.morale ?? 0) -
    getEnvironmentMoralePenaltyPerHour(state.environment) *
      deltaSeconds /
      GAME_HOUR_REAL_SECONDS;

  if ((delta.food ?? 0) < 0 && state.resources.food <= 0) {
    delta.morale = (delta.morale ?? 0) - 0.08 * deltaSeconds;
  }

  if ((delta.water ?? 0) < 0 && state.resources.water <= 0) {
    delta.morale = (delta.morale ?? 0) - 0.11 * deltaSeconds;
  }

  return delta;
}

export function recalculateCapacities(state: GameState): void {
  const nextCapacities = { ...BASE_CAPACITY };

  for (const definition of buildingDefinitions) {
    const building = state.buildings[definition.id];

    if (!definition.storageBonus || building.level <= 0) {
      continue;
    }

    for (const resourceId of resourceIds) {
      nextCapacities[resourceId] +=
        (definition.storageBonus[resourceId] ?? 0) * building.level;
    }
  }

  state.capacities = nextCapacities;

  for (const resourceId of resourceIds) {
    state.resources[resourceId] = Math.min(
      state.resources[resourceId],
      state.capacities[resourceId],
    );
  }
}

function applyRate(
  delta: ResourceBag,
  bag: ResourceBag | undefined,
  level: number,
  deltaSeconds: number,
  sign: 1 | -1,
): void {
  if (!bag) {
    return;
  }

  for (const resourceId of resourceIds) {
    const rate = bag[resourceId];

    if (rate === undefined) {
      continue;
    }

    delta[resourceId] = (delta[resourceId] ?? 0) + rate * level * deltaSeconds * sign;
  }
}

function applyProductionRate(
  delta: ResourceBag,
  bag: ResourceBag | undefined,
  level: number,
  productionMultiplier: number,
  deltaSeconds: number,
): void {
  if (!bag) {
    return;
  }

  for (const resourceId of resourceIds) {
    const rate = bag[resourceId];

    if (rate === undefined) {
      continue;
    }

    const multiplier = resourceId === "morale" ? level : level * productionMultiplier;
    delta[resourceId] = (delta[resourceId] ?? 0) + rate * multiplier * deltaSeconds;
  }
}

function createEmptyResourceDelta(): Record<ResourceId, number> {
  return Object.fromEntries(resourceIds.map((resourceId) => [resourceId, 0])) as Record<
    ResourceId,
    number
  >;
}

function getContinuousShiftMoralePenaltyPerHour(state: GameState): number {
  if (!isContinuousNightShiftActive(state)) {
    return 0;
  }

  const positiveMoralePerHour =
    getPositiveMoraleProductionRate(state) * GAME_HOUR_REAL_SECONDS;

  return positiveMoralePerHour + CONTINUOUS_SHIFT_NIGHT_NET_MORALE_LOSS_PER_HOUR;
}

function getPositiveMoraleProductionRate(state: GameState): number {
  if (!isProductionShiftActive(state)) {
    return 0;
  }

  return buildingDefinitions.reduce((total, definition) => {
    const building = state.buildings[definition.id];

    if (
      building.level <= 0 ||
      building.upgradingRemaining > 0 ||
      definition.id === "coalMine" ||
      definition.id === "workshop" ||
      isBuildingInactiveDueToCoal(state, definition.id)
    ) {
      return total;
    }

    if (definition.id === "mainBuilding") {
      return total + getMainBuildingMoraleRate(building.level);
    }

    return total + (definition.produces?.morale ?? 0) * building.level;
  }, 0);
}

function releaseConstructionWorkers(
  state: GameState,
  building: GameState["buildings"][BuildingId],
): void {
  state.survivors.workers += building.constructionWorkers;
  building.constructionWorkers = 0;
}

function pushMainBuildingBonusLine(
  lines: ResourceBreakdownLine[],
  resourceId: ResourceId,
  baseProductionRatePerSecond: number,
  productionBonus: number,
): void {
  const bonusRatePerSecond = baseProductionRatePerSecond * productionBonus;

  if (bonusRatePerSecond <= 0) {
    return;
  }

  const existingLine = lines.find(
    (line) => line.source === "mainBuildingBonus" && line.resourceId === resourceId,
  );

  if (existingLine) {
    existingLine.ratePerSecond += bonusRatePerSecond;
    return;
  }

  lines.push({
    source: "mainBuildingBonus",
    resourceId,
    buildingId: "mainBuilding",
    ratePerSecond: bonusRatePerSecond,
  });
}

function pushMoraleProductionPenaltyLine(
  lines: ResourceBreakdownLine[],
  resourceId: ResourceId,
  baseProductionRatePerSecond: number,
  productionBonus: number,
  moraleMultiplier: number,
): void {
  if (resourceId === "morale" || moraleMultiplier >= 1) {
    return;
  }

  const penaltyRatePerSecond =
    baseProductionRatePerSecond * (1 + productionBonus) * (1 - moraleMultiplier);

  if (penaltyRatePerSecond <= 0) {
    return;
  }

  const existingLine = lines.find(
    (line) => line.source === "moraleProductionPenalty" && line.resourceId === resourceId,
  );

  if (existingLine) {
    existingLine.ratePerSecond -= penaltyRatePerSecond;
    return;
  }

  lines.push({
    source: "moraleProductionPenalty",
    resourceId,
    buildingId: "mainBuilding",
    ratePerSecond: -penaltyRatePerSecond,
  });
}

function getNextBuildingLevelRequirement(
  buildingId: BuildingId,
  currentLevel: number,
) {
  const definition = buildingById[buildingId];
  const targetLevel = Math.min(definition.maxLevel, Math.max(1, currentLevel + 1));
  return definition.levelRequirements[targetLevel - 1];
}
