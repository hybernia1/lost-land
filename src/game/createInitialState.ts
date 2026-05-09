import { buildingDefinitions } from "../data/buildings";
import { ENVIRONMENT_INITIAL_DELAY_SECONDS } from "../data/environment";
import { emptyResourceRecord } from "../data/resources";
import { villagePlotDefinitions } from "../data/villagePlots";
import { recalculateCapacities } from "../systems/buildings";
import { getLocalizedInitialLogEntries } from "../systems/log";
import { createInitialQuestState } from "../systems/quests";
import { SAVE_VERSION } from "../systems/save";
import { gameConfig } from "./config";
import type { BuildingId, BuildingState, GameState, ResourceId } from "./types";

const startingStockResources: ResourceId[] = ["food", "water", "material", "coal"];

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
    saveVersion: SAVE_VERSION,
    saveId,
    communityName,
    startedAt: new Date().toISOString(),
    elapsedSeconds: 0,
    paused: false,
    speed: 1,
    workMode: "day",
    resources: {
      ...emptyResourceRecord(),
      morale: 100,
    },
    capacities: emptyResourceRecord(),
    survivors: {
      workers: 3,
      troops: 0,
    },
    quests: createInitialQuestState(),
    scouting: {
      missions: [],
    },
    market: {
      cooldownRemainingSeconds: 0,
      tradesUsed: 0,
    },
    health: {
      injured: 0,
      treatmentProgress: 0,
      nextIncidentAt: 600,
      starvationProgress: 0,
      dehydrationProgress: 0,
    },
    environment: {
      condition: "stable",
      intensity: 1,
      startedAt: 0,
      endsAt: 0,
      nextConditionAt: ENVIRONMENT_INITIAL_DELAY_SECONDS,
      activeCrisis: null,
    },
    buildings,
    village: {
      selectedPlotId: "plot-main",
      plots: villagePlotDefinitions.map((plot) => ({
        id: plot.id,
        buildingId: plot.id === "plot-main" ? "mainBuilding" : null,
      })),
    },
    log: getLocalizedInitialLogEntries(),
  };

  recalculateCapacities(state);
  fillStartingStocks(state);
  return state;
}

function fillStartingStocks(state: GameState): void {
  for (const resourceId of startingStockResources) {
    state.resources[resourceId] = Math.floor(
      state.capacities[resourceId] * gameConfig.simulation.startingStockRatio,
    );
  }
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
