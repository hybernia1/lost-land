import {
  applyProduction,
  recalculateCapacities,
  setBuildingWorkers,
  startBuildingConstruction,
  startBuildingUpgrade,
  tickBuildings,
} from "../systems/buildings";
import { tickHealth } from "../systems/health";
import { localizeStaticLogEntries } from "../systems/log";
import { loadGame, saveGame } from "../systems/save";
import { convertTroopToWorker, convertWorkerToTroop } from "../systems/survivors";
import { createInitialState } from "./createInitialState";
import type { BuildingId, GameListener, GameSpeed, GameState } from "./types";

const TICK_SECONDS = 1;
const AUTOSAVE_REAL_SECONDS = 10;

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
      this.tick(TICK_SECONDS);
    }, TICK_SECONDS * 1000);

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

  buildAtPlot(plotId: string, buildingId: BuildingId): void {
    if (startBuildingConstruction(this.state, plotId, buildingId)) {
      this.commit();
    }
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
    applyProduction(this.state, scaledDelta);
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

    if (now - this.lastAutosaveAt < AUTOSAVE_REAL_SECONDS * 1000) {
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
  state.saveVersion = 15;
  state.workMode = state.workMode === "continuous" ? "continuous" : "day";
  state.log = localizeStaticLogEntries(state.log ?? []);

  if (state.speed !== 24) {
    state.speed = 1;
  }

  for (const building of Object.values(state.buildings)) {
    building.workers = Math.max(0, building.workers);
    building.constructionWorkers = Math.max(0, building.constructionWorkers);
  }
}
