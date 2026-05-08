import { buildingDefinitions } from "../data/buildings";
import { emptyResourceRecord } from "../data/resources";
import { villagePlotDefinitions } from "../data/villagePlots";
import { recalculateCapacities } from "../systems/buildings";
import { getLocalizedInitialLogEntries } from "../systems/log";
import { createInitialMap } from "../systems/map";
import type { BuildingId, BuildingState, GameState } from "./types";

export function createInitialState(
  communityName = "Lost Land",
  saveId = createSaveId(communityName),
): GameState {
  const buildings = Object.fromEntries(
    buildingDefinitions.map((definition) => [
      definition.id,
      {
        id: definition.id,
        level: getStartingLevel(definition.id),
        upgradingRemaining: 0,
        workers: 0,
        constructionWorkers: 0,
      },
    ]),
  ) as Record<BuildingId, BuildingState>;

  const state: GameState = {
    saveVersion: 15,
    saveId,
    communityName,
    startedAt: new Date().toISOString(),
    elapsedSeconds: 0,
    paused: false,
    speed: 1,
    workMode: "day",
    resources: {
      ...emptyResourceRecord(),
      food: 105,
      water: 112,
      material: 150,
      energy: 42,
      morale: 72,
    },
    capacities: emptyResourceRecord(),
    survivors: {
      workers: 3,
      troops: 0,
    },
    health: {
      injured: 0,
      treatmentProgress: 0,
      nextIncidentAt: 600,
      starvationProgress: 0,
      dehydrationProgress: 0,
    },
    buildings,
    village: {
      selectedPlotId: "plot-main",
      plots: villagePlotDefinitions.map((plot) => ({
        id: plot.id,
        buildingId: plot.id === "plot-main" ? "mainBuilding" : null,
      })),
    },
    map: createInitialMap(),
    log: getLocalizedInitialLogEntries(),
  };

  recalculateCapacities(state);
  return state;
}

function getStartingLevel(buildingId: BuildingId): number {
  return buildingId === "mainBuilding" ? 1 : 0;
}

function createSaveId(communityName: string): string {
  const slug = communityName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `${slug || "community"}-${Date.now().toString(36)}`;
}
