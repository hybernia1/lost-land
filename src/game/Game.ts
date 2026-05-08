import {
  applyProduction,
  recalculateCapacities,
  setBuildingWorkers,
  startBuildingConstruction,
  startBuildingUpgrade,
  tickBuildings,
} from "../systems/buildings";
import { startExpedition, tickExpeditions } from "../systems/expeditions";
import { tickHealth } from "../systems/health";
import { tickThreat } from "../systems/map";
import { clearSave, loadGame, saveGame } from "../systems/save";
import { convertTroopToWorker, convertWorkerToTroop } from "../systems/survivors";
import { createInitialState } from "./createInitialState";
import type { BuildingId, GameListener, GameSpeed, GameState } from "./types";

const TICK_SECONDS = 1;

export class Game {
  private state: GameState;
  private listeners = new Set<GameListener>();
  private intervalId: number | null = null;

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

  selectSector(sectorId: string): void {
    this.state.map.selectedSectorId = sectorId;
    this.emit();
  }

  selectVillagePlot(plotId: string): void {
    this.state.village.selectedPlotId = plotId;
    this.emit();
  }

  buildAtPlot(plotId: string, buildingId: BuildingId): void {
    if (startBuildingConstruction(this.state, plotId, buildingId)) {
      this.emit();
    }
  }

  upgradeBuilding(buildingId: BuildingId): void {
    if (startBuildingUpgrade(this.state, buildingId)) {
      this.emit();
    }
  }

  setBuildingWorkers(buildingId: BuildingId, targetWorkers: number): void {
    if (setBuildingWorkers(this.state, buildingId, targetWorkers)) {
      this.emit();
    }
  }

  convertWorkerToTroop(): void {
    if (convertWorkerToTroop(this.state)) {
      this.emit();
    }
  }

  convertTroopToWorker(): void {
    if (convertTroopToWorker(this.state)) {
      this.emit();
    }
  }

  sendExpedition(sectorId: string): void {
    if (startExpedition(this.state, sectorId)) {
      this.emit();
    }
  }

  setPaused(paused: boolean): void {
    this.state.paused = paused;
    this.emit();
  }

  setSpeed(speed: GameSpeed): void {
    this.state.speed = speed;
    this.emit();
  }

  save(): void {
    this.pushLog("Game saved.");
    saveGame(this.state);
    this.emit();
  }

  load(saveId?: string): boolean {
    const loadedState = loadGame(saveId);

    if (!loadedState) {
      this.pushLog("No compatible save found.");
      this.emit();
      return false;
    }

    this.state = loadedState;
    normalizeGameState(this.state);
    recalculateCapacities(this.state);
    this.pushLog("Save loaded.");
    this.emit();
    return true;
  }

  newGame(communityName: string): void {
    this.state = createInitialState(communityName);
    normalizeGameState(this.state);
    recalculateCapacities(this.state);
    saveGame(this.state);
    this.emit();
  }

  reset(): void {
    const communityName = this.state.communityName;
    const saveId = this.state.saveId;
    clearSave(saveId);
    this.state = createInitialState(communityName, saveId);
    this.emit();
  }

  private tick(deltaSeconds: number): void {
    if (this.state.paused) {
      return;
    }

    const scaledDelta = deltaSeconds * this.state.speed;
    this.state.elapsedSeconds += scaledDelta;
    tickBuildings(this.state, scaledDelta);
    applyProduction(this.state, scaledDelta);
    tickExpeditions(this.state, scaledDelta);
    tickHealth(this.state, scaledDelta);
    tickThreat(this.state, scaledDelta);
    this.emit();
  }

  private pushLog(message: string): void {
    this.state.log.unshift(message);
    this.state.log = this.state.log.slice(0, 16);
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
  state.saveVersion = 12;

  if (state.speed !== 8) {
    state.speed = 1;
  }

  state.health ??= {
    injured: 0,
    treatmentProgress: 0,
    nextIncidentAt: state.elapsedSeconds + 600,
  };

  const legacySurvivors = state.survivors as unknown as {
    workers?: number;
    troops?: number;
    idle?: number;
    guards?: number;
  };

  state.survivors = {
    workers: legacySurvivors.workers ?? legacySurvivors.idle ?? 0,
    troops: legacySurvivors.troops ?? legacySurvivors.guards ?? 0,
  };

  for (const building of Object.values(state.buildings)) {
    building.workers ??= 0;
    building.constructionWorkers ??= 0;
  }
}
