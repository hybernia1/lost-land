import { buildingById, buildingDefinitions } from "../data/buildings";
import { resourceIds } from "../data/resources";
import { villagePlotDefinitions } from "../data/villagePlots";
import { GAME_HOUR_REAL_SECONDS, getGameHour } from "../game/time";
import type {
  BuildingId,
  GameState,
  ResourceBag,
  ResourceId,
} from "../game/types";
import { maybeInjureFromConstruction } from "./health";
import { getLocalizedBuildingName, pushLocalizedLog } from "./log";
import { addResources, canAfford, spendResources } from "./resources";

const BASE_CAPACITY: Record<ResourceId, number> = {
  food: 180,
  water: 180,
  material: 260,
  energy: 120,
  morale: 100,
};

export const MAX_ACTIVE_BUILDINGS = 2;
const GENERATOR_BASE_ENERGY_RATE = 0.28;
const HOMELESS_MORALE_PENALTY_PER_HOUR = 1;
const CONTINUOUS_SHIFT_MORALE_PENALTY_PER_HOUR = 2;

export type MoraleBreakdownLine = {
  source:
    | "building"
    | "homeless"
    | "foodShortage"
    | "waterShortage"
    | "continuousShifts";
  ratePerSecond: number;
  buildingId?: BuildingId;
  count?: number;
};

export function getUpgradeCost(buildingId: BuildingId, level: number): ResourceBag {
  return getNextBuildingLevelRequirement(buildingId, level).cost;
}

export function getBuildingBuildSeconds(buildingId: BuildingId, currentLevel: number): number {
  return getNextBuildingLevelRequirement(buildingId, currentLevel).buildSeconds;
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

export function getBuildingWorkerLimit(state: GameState, buildingId: BuildingId): number {
  const building = state.buildings[buildingId];

  if (buildingId !== "generator" || building.level <= 0) {
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

export function getGeneratorEnergyRate(level: number, workers: number): number {
  if (level <= 0 || workers <= 0) {
    return 0;
  }

  const workerLimit = Math.min(4, level + 1);
  const maxOutput = GENERATOR_BASE_ENERGY_RATE * (1 + (level - 1) * 0.42);
  return maxOutput * Math.min(workers, workerLimit) / workerLimit;
}

export function isBuildingInactiveDueToEnergy(
  state: GameState,
  buildingId: BuildingId,
): boolean {
  const definition = buildingById[buildingId];
  const building = state.buildings[buildingId];
  const energyNeeded =
    (definition.consumes?.energy ?? 0) + (definition.alwaysConsumes?.energy ?? 0);

  return building.level > 0 &&
    building.upgradingRemaining <= 0 &&
    energyNeeded > 0 &&
    state.resources.energy <= 0;
}

export function isDayShiftHour(state: GameState): boolean {
  const hour = getGameHour(state.elapsedSeconds);

  return hour >= 8 && hour < 22;
}

export function isProductionShiftActive(state: GameState): boolean {
  return isDayShiftHour(state) || state.workMode === "continuous";
}

export function isContinuousNightShiftActive(state: GameState): boolean {
  return state.workMode === "continuous" && !isDayShiftHour(state);
}

export function getDormitoryHousingCapacity(state: GameState): number {
  const building = state.buildings.dormitory;
  const definition = buildingById.dormitory;

  if (building.level <= 0 || isBuildingInactiveDueToEnergy(state, "dormitory")) {
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
  const troopHousing = state.buildings.barracks.level > 0 ? state.survivors.troops : 0;
  const civilians = Math.max(0, population - state.survivors.troops);
  const civilianCapacity = getDormitoryHousingCapacity(state);
  const housedCivilians = Math.min(civilians, civilianCapacity);
  const housed = Math.min(population, troopHousing + housedCivilians);

  return {
    housed,
    homeless: Math.max(0, population - housed),
    civilianCapacity,
  };
}

export function getMoraleBreakdown(state: GameState): MoraleBreakdownLine[] {
  const lines: MoraleBreakdownLine[] = [];
  const productionActive = isProductionShiftActive(state);

  for (const definition of buildingDefinitions) {
    const building = state.buildings[definition.id];

    if (
      building.level <= 0 ||
      building.upgradingRemaining > 0 ||
      !productionActive ||
      isBuildingInactiveDueToEnergy(state, definition.id)
    ) {
      continue;
    }

    const ratePerSecond =
      ((definition.produces?.morale ?? 0) - (definition.consumes?.morale ?? 0)) *
      building.level;

    if (ratePerSecond !== 0) {
      lines.push({
        source: "building",
        buildingId: definition.id,
        ratePerSecond,
      });
    }
  }

  const homeless = getHousingStatus(state).homeless;
  if (homeless > 0) {
    lines.push({
      source: "homeless",
      count: homeless,
      ratePerSecond: -homeless * HOMELESS_MORALE_PENALTY_PER_HOUR / GAME_HOUR_REAL_SECONDS,
    });
  }

  if (isContinuousNightShiftActive(state)) {
    lines.push({
      source: "continuousShifts",
      ratePerSecond: -CONTINUOUS_SHIFT_MORALE_PENALTY_PER_HOUR / GAME_HOUR_REAL_SECONDS,
    });
  }

  const currentRates = getProductionDelta(state, 1);
  if ((currentRates.food ?? 0) < 0 && state.resources.food <= 0) {
    lines.push({ source: "foodShortage", ratePerSecond: -0.08 });
  }

  if ((currentRates.water ?? 0) < 0 && state.resources.water <= 0) {
    lines.push({ source: "waterShortage", ratePerSecond: -0.11 });
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
  const plotDefinition = villagePlotDefinitions.find((plot) => plot.id === plotId);
  const allowedBuildingIds = plotDefinition?.allowedBuildingIds;

  if (!plotDefinition) {
    return [];
  }

  return buildingDefinitions
    .filter((definition) => {
      if (allowedBuildingIds) {
        return allowedBuildingIds.includes(definition.id);
      }

      return !villagePlotDefinitions.some((plot) =>
        plot.allowedBuildingIds?.includes(definition.id),
      );
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
  const plotDefinition = villagePlotDefinitions.find((candidate) => candidate.id === plotId);
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

  if (
    plotDefinition?.allowedBuildingIds &&
    !plotDefinition.allowedBuildingIds.includes(buildingId)
  ) {
    return false;
  }

  if (
    !plotDefinition?.allowedBuildingIds &&
    villagePlotDefinitions.some((candidate) =>
      candidate.allowedBuildingIds?.includes(buildingId),
    )
  ) {
    return false;
  }

  if (building.level > 0 || building.upgradingRemaining > 0) {
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
  building.upgradingRemaining = getBuildingBuildSeconds(buildingId, 0);
  pushLocalizedLog(state, "logConstructionStarted", {
    building: getLocalizedBuildingName(definition.id),
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
    building.upgradingRemaining > 0
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
  building.upgradingRemaining = getBuildingBuildSeconds(buildingId, building.level);
  pushLocalizedLog(state, "logUpgradeStarted", {
    building: getLocalizedBuildingName(definition.id),
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
        building: getLocalizedBuildingName(definition.id),
        level: building.level,
      });

      if (definition.id === "palisade") {
        state.survivors.workers += 1;
        state.resources.morale = Math.min(100, state.resources.morale + 2);
        pushLocalizedLog(state, "logSurvivorJoined");
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

  for (const definition of buildingDefinitions) {
    const building = state.buildings[definition.id];

    if (building.level <= 0 || building.upgradingRemaining > 0) {
      continue;
    }

    applyRate(delta, definition.alwaysConsumes, building.level, deltaSeconds, -1);

    if (!productionActive) {
      continue;
    }

    if (definition.id === "generator") {
      delta.energy += getGeneratorEnergyRate(building.level, building.workers) * deltaSeconds;
      continue;
    }

    if (isBuildingInactiveDueToEnergy(state, definition.id)) {
      continue;
    }

    applyRate(delta, definition.produces, building.level, deltaSeconds, 1);
    applyRate(delta, definition.consumes, building.level, deltaSeconds, -1);
  }

  const population = getPopulation(state);
  delta.food = (delta.food ?? 0) - population * 0.012 * deltaSeconds;
  delta.water = (delta.water ?? 0) - population * 0.014 * deltaSeconds;

  const homeless = getHousingStatus(state).homeless;
  delta.morale = (delta.morale ?? 0) -
    homeless * HOMELESS_MORALE_PENALTY_PER_HOUR * deltaSeconds / GAME_HOUR_REAL_SECONDS;

  if (isContinuousNightShiftActive(state)) {
    delta.morale = (delta.morale ?? 0) -
      CONTINUOUS_SHIFT_MORALE_PENALTY_PER_HOUR * deltaSeconds / GAME_HOUR_REAL_SECONDS;
  }

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

export function getDefenseScore(state: GameState): number {
  return buildingDefinitions.reduce((score, definition) => {
    const building = state.buildings[definition.id];
    return score + (definition.defense ?? 0) * building.level;
  }, state.survivors.troops * 6);
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

function getPopulation(state: GameState): number {
  return (
    Object.values(state.survivors).reduce((total, count) => total + count, 0) +
    getAssignedBuildingWorkers(state) +
    state.health.injured
  );
}

function getAssignedBuildingWorkers(state: GameState): number {
  return Object.values(state.buildings).reduce(
    (total, building) => total + building.workers + building.constructionWorkers,
    0,
  );
}

function createEmptyResourceDelta(): Record<ResourceId, number> {
  return Object.fromEntries(resourceIds.map((resourceId) => [resourceId, 0])) as Record<
    ResourceId,
    number
  >;
}

function releaseConstructionWorkers(
  state: GameState,
  building: GameState["buildings"][BuildingId],
): void {
  state.survivors.workers += building.constructionWorkers;
  building.constructionWorkers = 0;
}

function getNextBuildingLevelRequirement(
  buildingId: BuildingId,
  currentLevel: number,
) {
  const definition = buildingById[buildingId];
  const targetLevel = Math.min(definition.maxLevel, Math.max(1, currentLevel + 1));
  return definition.levelRequirements[targetLevel - 1];
}
