import { defaultVillageLayout } from "../data/villageLayouts";
import { combatUnitDefinitions, enemyUnitIds } from "../data/combatUnits";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import type {
  EnemyUnitCounts,
  GameState,
  ResourceSiteLoot,
  ResourceSiteState,
  UnitCounts,
} from "../game/types";
import { createBattleState, resolveOpeningEnemyTurn } from "./combat";
import { pushLocalizedLog } from "./log";
import { getUnitCount, removeUnits, unitIds } from "./survivors";

const resourceSiteDefinitions = defaultVillageLayout.resourceSites;
const resourceSiteById = new Map(resourceSiteDefinitions.map((site) => [site.id, site]));
const homeTravelAnchorPlot = defaultVillageLayout.plots.find((plot) => plot.id === "plot-main") ??
  defaultVillageLayout.plots[0] ??
  null;

export function createInitialResourceSites(): ResourceSiteState[] {
  return resourceSiteDefinitions.map((site) => ({
    id: site.id,
    loot: normalizeResourceSiteLoot(site.loot),
    looted: false,
    defenderArmy: normalizeDefenderArmy(site.defenderArmy),
    assault: null,
  }));
}

export function normalizeResourceSites(state: GameState): void {
  const sitesById = new Map((state.resourceSites ?? []).map((site) => [site.id, site]));

  state.resourceSites = resourceSiteDefinitions.map((definition) => {
    const current = sitesById.get(definition.id);
    const defenderArmy = current?.looted
      ? normalizeDefenderArmy(current?.defenderArmy ?? definition.defenderArmy)
      : normalizeDefenderArmy(definition.defenderArmy);
    const assault = current?.assault &&
        current.assault.troops > 0 &&
        current.assault.remainingSeconds > 0
      ? {
          troops: Math.max(1, Math.floor(current.assault.troops)),
          units: normalizeAssaultUnits(current.assault.units, Math.max(1, Math.floor(current.assault.troops))),
          remainingSeconds: Math.max(0, current.assault.remainingSeconds),
          travelTiles: Math.max(1, Math.floor(current.assault.travelTiles)),
        }
      : null;

    return {
      id: definition.id,
      loot: normalizeResourceSiteLoot(definition.loot),
      looted: Boolean(current?.looted),
      defenderArmy,
      assault,
    };
  });
}

export function startResourceSiteAssault(
  state: GameState,
  siteId: string,
  units: UnitCounts,
): boolean {
  const site = getResourceSiteState(state, siteId);
  const definition = resourceSiteById.get(siteId);
  const requestedUnits = normalizeAssaultUnits(units, 0);
  const troops = getUnitCount(requestedUnits);

  if (!site || !definition) {
    return false;
  }

  if (site.looted) {
    pushLocalizedLog(state, "logResourceSiteAlreadyLooted");
    return false;
  }

  if (site.assault || state.activeBattle) {
    pushLocalizedLog(state, "logResourceSiteAssaultAlreadyRunning");
    return false;
  }

  const availableTroops = getUnitCount(state.survivors.units);
  if (troops <= 0 || !hasAvailableUnits(state.survivors.units, requestedUnits)) {
    pushLocalizedLog(state, "logResourceSiteNoTroops", {
      count: troops,
      available: availableTroops,
    });
    return false;
  }

  const travelTiles = getTravelTilesToSite(definition.id);
  const assaultUnits = removeUnits(state, requestedUnits);

  if (!assaultUnits) {
    return false;
  }

  site.assault = {
    troops,
    units: assaultUnits,
    travelTiles,
    remainingSeconds: Math.max(1, travelTiles * GAME_HOUR_REAL_SECONDS),
  };

  pushLocalizedLog(state, "logResourceSiteAssaultStarted", {
    count: troops,
    hours: travelTiles,
  });
  return true;
}

export function tickResourceSites(state: GameState, deltaSeconds: number): void {
  for (const site of state.resourceSites) {
    if (!site.assault) {
      continue;
    }

    site.assault.remainingSeconds = Math.max(0, site.assault.remainingSeconds - deltaSeconds);

    if (site.assault.remainingSeconds <= 0) {
      openResourceSiteBattle(state, site);
    }
  }
}

export function getResourceSiteAssaultTroopCount(state: GameState): number {
  return state.resourceSites.reduce(
    (total, site) => total + (site.assault?.troops ?? 0),
    0,
  );
}

export function getTravelTilesToSite(siteId: string): number {
  if (!homeTravelAnchorPlot) {
    return 1;
  }

  const site = resourceSiteById.get(siteId);

  if (!site) {
    return 1;
  }

  const homeCenterX = homeTravelAnchorPlot.x + homeTravelAnchorPlot.width / 2;
  const homeCenterY = homeTravelAnchorPlot.y + homeTravelAnchorPlot.height / 2;
  const siteCenterX = site.x + site.width / 2;
  const siteCenterY = site.y + site.height / 2;
  const tileSize = Math.max(1, defaultVillageLayout.tileSize);
  const distanceTiles = (Math.abs(siteCenterX - homeCenterX) + Math.abs(siteCenterY - homeCenterY)) /
    tileSize;

  return Math.max(1, Math.ceil(distanceTiles * 0.5));
}

export function getResourceSiteDifficultyRating(site: Pick<ResourceSiteState, "defenderArmy" | "looted">): number {
  if (site.looted) {
    return 0;
  }

  const power = enemyUnitIds.reduce((total, unitId) => {
    const count = Math.max(0, Math.floor(site.defenderArmy[unitId] ?? 0));
    const definition = combatUnitDefinitions[unitId];
    const unitPower = definition.maxHp +
      definition.damage * 5 +
      definition.range * 4 +
      definition.move * 2 +
      definition.initiative * 0.5;

    return total + count * unitPower;
  }, 0);

  if (power <= 0) {
    return 0;
  }

  if (power <= 90) {
    return 1;
  }

  if (power <= 170) {
    return 2;
  }

  if (power <= 280) {
    return 3;
  }

  if (power <= 410) {
    return 4;
  }

  return 5;
}

function getResourceSiteState(state: GameState, siteId: string): ResourceSiteState | undefined {
  return state.resourceSites.find((site) => site.id === siteId);
}

function openResourceSiteBattle(state: GameState, site: ResourceSiteState): void {
  const assault = site.assault;

  if (!assault) {
    return;
  }

  site.assault = null;
  state.activeBattle = createBattleState(
    site.id,
    site.loot,
    assault.units,
    site.defenderArmy,
  );
  resolveOpeningEnemyTurn(state);
  pushLocalizedLog(state, "logResourceSiteBattleStarted");
}

function normalizeAssaultUnits(units: UnitCounts | undefined, fallbackTroops: number): UnitCounts {
  if (!units) {
    const fallback = createEmptyUnitCounts();
    fallback.footman = fallbackTroops;
    return fallback;
  }

  return Object.fromEntries(
    unitIds.map((unitId) => [unitId, Math.max(0, Math.floor(units[unitId] ?? 0))]),
  ) as UnitCounts;
}

function normalizeDefenderArmy(army: Partial<EnemyUnitCounts>): EnemyUnitCounts {
  return Object.fromEntries(
    enemyUnitIds.map((unitId) => [unitId, Math.max(0, Math.floor(army[unitId] ?? 0))]),
  ) as EnemyUnitCounts;
}

function normalizeResourceSiteLoot(loot: Partial<ResourceSiteLoot> | undefined): ResourceSiteLoot {
  const normalized: ResourceSiteLoot = {};

  for (const resourceId of ["food", "water", "material", "coal"] as const) {
    const amount = Math.max(0, Math.floor(loot?.[resourceId] ?? 0));
    if (amount > 0) {
      normalized[resourceId] = amount;
    }
  }

  return normalized;
}

function hasAvailableUnits(available: UnitCounts, requested: UnitCounts): boolean {
  return unitIds.every((unitId) => Math.max(0, Math.floor(available[unitId] ?? 0)) >= requested[unitId]);
}

function createEmptyUnitCounts(): UnitCounts {
  return Object.fromEntries(unitIds.map((unitId) => [unitId, 0])) as UnitCounts;
}
