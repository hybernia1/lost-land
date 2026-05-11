import {
  applyProduction,
  recalculateCapacities,
  setBuildingWorkers,
  startBuildingConstruction,
  startBuildingUpgrade,
  tickBuildings,
} from "../systems/buildings";
import { normalizeEnvironmentState, tickEnvironment } from "../systems/environment";
import { tickHealth } from "../systems/health";
import { normalizeLogEntries } from "../systems/log";
import { normalizeMarketState, tickMarket, tradeAtMarket as executeMarketTrade } from "../systems/market";
import { normalizeQuestState, resolveDecisionQuest, tickQuests } from "../systems/quests";
import {
  getResourceSiteProductionDelta,
  normalizeResourceSites,
  setResourceSiteWorkers as setWorkersAtResourceSite,
  startResourceSiteAssault as startSiteAssault,
  tickResourceSites,
} from "../systems/resourceSites";
import { addResources } from "../systems/resources";
import { loadGame, saveGame, SAVE_VERSION } from "../systems/save";
import { convertTroopToWorker, convertWorkerToTroop } from "../systems/survivors";
import { gameConfig } from "./config";
import { createInitialState } from "./createInitialState";
import { GAME_HOUR_REAL_SECONDS } from "./time";
import type { BuildingId, DecisionOptionId, EnvironmentConditionId, GameListener, GameSpeed, GameState, ResourceId } from "./types";

export class Game {
  private state: GameState;
  private listeners = new Set<GameListener>();
  private intervalId: number | null = null;
  private lastAutosaveAt = 0;

  constructor() {
    this.state = loadGame() ?? createInitialState();
    normalizeGameState(this.state);
    recalculateCapacities(this.state);
  }

  start(): void {
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = window.setInterval(() => {
      this.tick(gameConfig.simulation.tickSeconds);
    }, gameConfig.simulation.tickSeconds * 1000);

    this.emit();
  }

  stop(): void {
    if (this.intervalId === null) {
      return;
    }

    window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  subscribe(listener: GameListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): GameState {
    return this.state;
  }

  selectVillagePlot(plotId: string): void {
    this.state.village.selectedPlotId = plotId;
    this.commit();
  }

  buildAtPlot(plotId: string, buildingId: BuildingId): boolean {
    if (startBuildingConstruction(this.state, plotId, buildingId)) {
      this.commit();
      return true;
    }

    return false;
  }

  upgradeBuilding(buildingId: BuildingId): void {
    if (startBuildingUpgrade(this.state, buildingId)) {
      this.commit();
    }
  }

  setBuildingWorkers(buildingId: BuildingId, targetWorkers: number): void {
    if (setBuildingWorkers(this.state, buildingId, targetWorkers)) {
      this.commit();
    }
  }

  convertWorkerToTroop(): void {
    if (convertWorkerToTroop(this.state)) {
      this.commit();
    }
  }

  convertTroopToWorker(): void {
    if (convertTroopToWorker(this.state)) {
      this.commit();
    }
  }

  startResourceSiteAssault(siteId: string, troopCount: number): boolean {
    const started = startSiteAssault(this.state, siteId, troopCount);
    if (started) {
      this.commit();
      return true;
    }

    this.emit();
    return false;
  }

  setResourceSiteWorkers(siteId: string, targetWorkers: number): void {
    if (setWorkersAtResourceSite(this.state, siteId, targetWorkers)) {
      this.commit();
    }
  }

  tradeAtMarket(fromResourceId: ResourceId, toResourceId: ResourceId, amount: number): void {
    if (executeMarketTrade(this.state, fromResourceId, toResourceId, amount)) {
      this.commit();
    }
  }

  resolveQuestDecision(optionId: DecisionOptionId): void {
    if (resolveDecisionQuest(this.state, optionId)) {
      this.commit();
    }
  }

  setPaused(paused: boolean): void {
    this.state.paused = paused;
    this.commit();
  }

  setSpeed(speed: GameSpeed): void {
    this.state.speed = speed;
    this.commit();
  }

  setContinuousShifts(enabled: boolean): void {
    this.state.workMode = enabled ? "continuous" : "day";
    this.commit();
  }

  devAddResources(amount: number): void {
    if (!import.meta.env.DEV) {
      return;
    }

    for (const resourceId of ["food", "water", "material", "coal"] as const) {
      this.state.resources[resourceId] = Math.min(
        this.state.capacities[resourceId],
        this.state.resources[resourceId] + amount,
      );
    }
    this.state.resources.morale = Math.min(100, this.state.resources.morale + Math.max(0, amount / 10));
    this.commit();
  }

  devAddWorkers(count: number): void {
    if (!import.meta.env.DEV) {
      return;
    }

    this.state.survivors.workers += Math.max(1, Math.floor(count));
    this.commit();
  }

  devSetEnvironment(condition: EnvironmentConditionId, intensity = 1): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const clampedIntensity = Math.max(
      gameConfig.environment.minIntensity,
      Math.min(gameConfig.environment.maxIntensity, Math.floor(intensity)),
    );
    const durationSeconds = condition === "stable"
      ? 0
      : gameConfig.environment.devConditionDurationHours * GAME_HOUR_REAL_SECONDS;
    this.state.environment = {
      condition,
      intensity: clampedIntensity,
      startedAt: this.state.elapsedSeconds,
      endsAt: this.state.elapsedSeconds + durationSeconds,
      nextConditionAt: condition === "stable"
        ? this.state.elapsedSeconds + gameConfig.environment.devConditionDurationHours * GAME_HOUR_REAL_SECONDS
        : this.state.elapsedSeconds + durationSeconds,
      activeCrisis: null,
    };
    tickEnvironment(this.state, 0);
    this.commit();
  }

  devFinishActiveBuilds(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    for (const building of Object.values(this.state.buildings)) {
      if (building.upgradingRemaining > 0) {
        building.upgradingRemaining = 1;
      }
    }
    tickBuildings(this.state, 1);
    this.commit();
  }

  load(saveId?: string): boolean {
    const loadedState = loadGame(saveId);

    if (!loadedState) {
      this.emit();
      return false;
    }

    this.state = loadedState;
    normalizeGameState(this.state);
    recalculateCapacities(this.state);
    this.emit();
    return true;
  }

  newGame(communityName: string): void {
    this.state = createInitialState(communityName);
    normalizeGameState(this.state);
    recalculateCapacities(this.state);
    this.commit();
  }

  private tick(deltaSeconds: number): void {
    if (this.state.paused) {
      return;
    }

    const scaledDelta = deltaSeconds * this.state.speed;
    this.state.elapsedSeconds += scaledDelta;
    tickBuildings(this.state, scaledDelta);
    tickMarket(this.state, scaledDelta);
    tickQuests(this.state);
    tickResourceSites(this.state, scaledDelta);
    tickEnvironment(this.state, scaledDelta);
    applyProduction(this.state, scaledDelta);
    addResources(
      this.state.resources,
      getResourceSiteProductionDelta(this.state, scaledDelta),
      this.state.capacities,
    );
    tickHealth(this.state, scaledDelta);
    this.autosaveIfDue();
    this.emit();
  }

  private commit(): void {
    this.autosave();
    this.emit();
  }

  private autosaveIfDue(): void {
    const now = Date.now();

    if (now - this.lastAutosaveAt < gameConfig.simulation.autosaveRealSeconds * 1000) {
      return;
    }

    this.autosave(now);
  }

  private autosave(savedAt = Date.now()): void {
    saveGame(this.state);
    this.lastAutosaveAt = savedAt;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function normalizeGameState(state: GameState): void {
  state.communityName = state.communityName?.trim() || "Lost Land";
  state.saveId = state.saveId?.trim() || `community-${Date.now().toString(36)}`;
  state.saveVersion = SAVE_VERSION;
  state.workMode = state.workMode === "continuous" ? "continuous" : "day";
  state.log = normalizeLogEntries(state.log ?? []);
  normalizeQuestState(state);
  normalizeMarketState(state);
  normalizeEnvironmentState(state);
  normalizeResourceSites(state);

  if (state.speed !== 24) {
    state.speed = 1;
  }

  for (const building of Object.values(state.buildings)) {
    building.workers = Math.max(0, building.workers);
    building.constructionWorkers = Math.max(0, building.constructionWorkers);
  }
}
