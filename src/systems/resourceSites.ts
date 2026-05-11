import { defaultVillageLayout } from "../data/villageLayouts";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import type {
  GameState,
  ResourceId,
  ResourceSiteResourceId,
  ResourceSiteState,
} from "../game/types";
import { pushLocalizedLog } from "./log";
import { getGlobalProductionMultiplier } from "./production";

const resourceSiteDefinitions = defaultVillageLayout.resourceSites;
const resourceSiteById = new Map(resourceSiteDefinitions.map((site) => [site.id, site]));
const palisadePlot = defaultVillageLayout.plots.find((plot) =>
  plot.allowedBuildingIds?.includes("palisade"),
) ?? null;

export function createInitialResourceSites(): ResourceSiteState[] {
  return resourceSiteDefinitions.map((site) => ({
    id: site.id,
    resourceId: site.resourceId,
    captured: false,
    assignedWorkers: 0,
    maxWorkers: site.maxWorkers,
    yieldPerWorker: site.yieldPerWorker,
    captureMinTroops: site.captureMinTroops,
    captureBaseDeathRisk: site.captureBaseDeathRisk,
    assault: null,
  }));
}

export function normalizeResourceSites(state: GameState): void {
  const sitesById = new Map((state.resourceSites ?? []).map((site) => [site.id, site]));

  state.resourceSites = resourceSiteDefinitions.map((definition) => {
    const current = sitesById.get(definition.id);
    const resourceId = current?.resourceId;
    const normalizedResourceId: ResourceSiteResourceId = resourceId === "food" ||
        resourceId === "water" ||
        resourceId === "coal" ||
        resourceId === "material"
      ? resourceId
      : definition.resourceId;
    const maxWorkers = Math.max(1, Math.min(3, Math.floor(current?.maxWorkers ?? definition.maxWorkers)));
    const assignedWorkers = Math.max(0, Math.min(maxWorkers, Math.floor(current?.assignedWorkers ?? 0)));
    const captureMinTroops = Math.max(1, Math.floor(current?.captureMinTroops ?? definition.captureMinTroops));
    const captureBaseDeathRisk = Math.max(
      0.05,
      Math.min(0.95, current?.captureBaseDeathRisk ?? definition.captureBaseDeathRisk),
    );
    const assault = current?.assault &&
        current.assault.troops > 0 &&
        current.assault.remainingSeconds > 0
      ? {
          troops: Math.max(1, Math.floor(current.assault.troops)),
          remainingSeconds: Math.max(0, current.assault.remainingSeconds),
          travelTiles: Math.max(1, Math.floor(current.assault.travelTiles)),
        }
      : null;

    return {
      id: definition.id,
      resourceId: normalizedResourceId,
      captured: Boolean(current?.captured),
      assignedWorkers: Boolean(current?.captured) ? assignedWorkers : 0,
      maxWorkers,
      yieldPerWorker: Math.max(0.001, current?.yieldPerWorker ?? definition.yieldPerWorker),
      captureMinTroops,
      captureBaseDeathRisk,
      assault,
    };
  });
}

export function startResourceSiteAssault(
  state: GameState,
  siteId: string,
  troopCount: number,
): boolean {
  const site = getResourceSiteState(state, siteId);
  const definition = resourceSiteById.get(siteId);
  const troops = Math.max(0, Math.floor(troopCount));

  if (!site || !definition) {
    return false;
  }

  if (site.captured) {
    pushLocalizedLog(state, "logResourceSiteAlreadyCaptured", {
      resourceId: site.resourceId,
    });
    return false;
  }

  if (site.assault) {
    pushLocalizedLog(state, "logResourceSiteAssaultAlreadyRunning", {
      resourceId: site.resourceId,
    });
    return false;
  }

  if (troops <= 0 || state.survivors.troops < troops) {
    pushLocalizedLog(state, "logResourceSiteNoTroops", {
      resourceId: site.resourceId,
      count: troops,
      available: state.survivors.troops,
    });
    return false;
  }

  const travelTiles = getTravelTilesToSite(definition.id);
  const travelHours = travelTiles;

  state.survivors.troops -= troops;
  site.assault = {
    troops,
    travelTiles,
    remainingSeconds: Math.max(1, travelHours * GAME_HOUR_REAL_SECONDS),
  };

  pushLocalizedLog(state, "logResourceSiteAssaultStarted", {
    count: troops,
    resourceId: site.resourceId,
    hours: travelHours,
  });
  return true;
}

export function tickResourceSites(state: GameState, deltaSeconds: number): void {
  if (state.resourceSites.length === 0) {
    return;
  }

  for (const site of state.resourceSites) {
    if (!site.assault) {
      continue;
    }

    site.assault.remainingSeconds = Math.max(0, site.assault.remainingSeconds - deltaSeconds);

    if (site.assault.remainingSeconds > 0) {
      continue;
    }

    resolveResourceSiteAssault(state, site);
  }
}

export function setResourceSiteWorkers(
  state: GameState,
  siteId: string,
  targetWorkers: number,
): boolean {
  const site = getResourceSiteState(state, siteId);

  if (!site || !site.captured || site.assault) {
    return false;
  }

  const nextWorkers = Math.max(0, Math.min(site.maxWorkers, Math.floor(targetWorkers)));
  const difference = nextWorkers - site.assignedWorkers;

  if (difference === 0) {
    return false;
  }

  if (difference > 0 && state.survivors.workers < difference) {
    return false;
  }

  site.assignedWorkers = nextWorkers;
  state.survivors.workers -= difference;
  return true;
}

export function getAssignedResourceSiteWorkerCount(state: GameState): number {
  return state.resourceSites.reduce((total, site) => total + site.assignedWorkers, 0);
}

export function getResourceSiteAssaultTroopCount(state: GameState): number {
  return state.resourceSites.reduce(
    (total, site) => total + (site.assault?.troops ?? 0),
    0,
  );
}

export function removeOneResourceSiteWorker(state: GameState): boolean {
  const site = state.resourceSites.find((candidate) => candidate.assignedWorkers > 0);

  if (!site) {
    return false;
  }

  site.assignedWorkers -= 1;
  return true;
}

export function getResourceSiteProductionRates(state: GameState): Record<ResourceId, number> {
  return getResourceSiteProductionDelta(state, 1);
}

export function getResourceSiteProductionDelta(
  state: GameState,
  deltaSeconds: number,
): Record<ResourceId, number> {
  const multiplier = getResourceSiteProductionMultiplier(state);
  const delta: Record<ResourceId, number> = {
    food: 0,
    water: 0,
    material: 0,
    coal: 0,
    morale: 0,
  };

  for (const site of state.resourceSites) {
    if (!site.captured || site.assignedWorkers <= 0) {
      continue;
    }

    delta[site.resourceId] += site.yieldPerWorker * site.assignedWorkers * multiplier * deltaSeconds;
  }

  return delta;
}

export function getTravelTilesToSite(siteId: string): number {
  if (!palisadePlot) {
    return 1;
  }

  const site = resourceSiteById.get(siteId);

  if (!site) {
    return 1;
  }

  const palisadeCenterX = palisadePlot.x + palisadePlot.width / 2;
  const palisadeCenterY = palisadePlot.y + palisadePlot.height / 2;
  const siteCenterX = site.x + site.width / 2;
  const siteCenterY = site.y + site.height / 2;
  const tileSize = Math.max(1, defaultVillageLayout.tileSize);
  const distanceTiles = (Math.abs(siteCenterX - palisadeCenterX) + Math.abs(siteCenterY - palisadeCenterY)) /
    tileSize;

  return Math.max(1, Math.ceil(distanceTiles));
}

function getResourceSiteState(state: GameState, siteId: string): ResourceSiteState | undefined {
  return state.resourceSites.find((site) => site.id === siteId);
}

function resolveResourceSiteAssault(
  state: GameState,
  site: ResourceSiteState,
): void {
  const assault = site.assault;

  if (!assault) {
    return;
  }

  site.assault = null;

  if (assault.troops < site.captureMinTroops) {
    pushLocalizedLog(state, "logResourceSiteAssaultOverrun", {
      resourceId: site.resourceId,
      required: site.captureMinTroops,
      sent: assault.troops,
    });
    return;
  }

  const deaths = rollDeaths(assault.troops, site.captureBaseDeathRisk, site.captureMinTroops);
  const returningTroops = assault.troops - deaths;

  if (returningTroops <= 0) {
    pushLocalizedLog(state, "logResourceSiteAssaultFailed", {
      resourceId: site.resourceId,
      deaths,
    });
    return;
  }

  site.captured = true;
  state.survivors.troops += returningTroops;

  pushLocalizedLog(state, "logResourceSiteCaptured", {
    resourceId: site.resourceId,
    count: returningTroops,
    deaths,
  });
}

function rollDeaths(
  troops: number,
  baseDeathRisk: number,
  captureMinTroops: number,
): number {
  const riskScale = captureMinTroops / Math.max(captureMinTroops, troops);
  const perTroopRisk = Math.max(
    0.08,
    Math.min(0.92, baseDeathRisk * riskScale * randomBetween(0.85, 1.25)),
  );
  let deaths = 0;

  for (let index = 0; index < troops; index += 1) {
    if (Math.random() < perTroopRisk) {
      deaths += 1;
    }
  }

  return deaths;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function getResourceSiteProductionMultiplier(state: GameState): number {
  return getGlobalProductionMultiplier(state);
}
