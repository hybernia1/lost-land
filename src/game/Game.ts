import {
  applyProduction,
  recalculateCapacities,
  setBuildingWorkers,
  startBuildingConstruction,
  startBuildingUpgrade,
  tickBuildings,
} from "../systems/buildings";
import {
  attackBattleUnit,
  createBattleState,
  endPlayerBattleTurn,
  moveSelectedBattleUnit,
  resolveOpeningEnemyTurn,
  selectBattleUnit,
} from "../systems/combat";
import { normalizeEnvironmentState, tickEnvironment } from "../systems/environment";
import { tickHealth } from "../systems/health";
import { normalizeLogEntries } from "../systems/log";
import { normalizeMarketState, tickMarket, tradeAtMarket as executeMarketTrade } from "../systems/market";
import {
  claimObjectiveQuestReward,
  normalizeQuestState,
  resolveDecisionQuest,
  tickQuests,
} from "../systems/quests";
import {
  normalizeResourceSites,
  startResourceSiteAssault as startSiteAssault,
  tickResourceSites,
} from "../systems/resourceSites";
import { transferHeroInventoryToStorage } from "../systems/resources";
import { loadGame, saveGame, SAVE_VERSION } from "../systems/save";
import { startBarracksTraining, tickBarracksTraining, unitIds } from "../systems/survivors";
import { isCombatUnitId, isPlayerUnitId } from "../data/combatUnits";
import { gameConfig } from "./config";
import { createInitialState } from "./createInitialState";
import { GAME_HOUR_REAL_SECONDS, isDaylightHour } from "./time";
import type {
  BarracksTrainingJobState,
  BuildingId,
  DecisionOptionId,
  EnvironmentConditionId,
  GameListener,
  GameSpeed,
  GameState,
  ObjectiveQuestId,
  ResourceId,
  UnitCounts,
  UnitId,
  BattleState,
} from "./types";

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

  startBarracksTraining(unitId: UnitId, count: number): void {
    if (startBarracksTraining(this.state, unitId, count)) {
      this.commit();
    }
  }

  startResourceSiteAssault(siteId: string, units: UnitCounts): boolean {
    const started = startSiteAssault(this.state, siteId, units);
    if (started) {
      this.commit();
      return true;
    }

    this.emit();
    return false;
  }

  selectBattleUnit(unitInstanceId: string): void {
    if (selectBattleUnit(this.state, unitInstanceId)) {
      this.commit();
    }
  }

  moveBattleUnit(q: number, r: number): void {
    if (moveSelectedBattleUnit(this.state, q, r)) {
      this.commit();
    }
  }

  attackBattleUnit(targetInstanceId: string): void {
    if (attackBattleUnit(this.state, targetInstanceId)) {
      this.commit();
    }
  }

  endBattleTurn(): void {
    if (endPlayerBattleTurn(this.state)) {
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

  claimObjectiveReward(objectiveQuestId: ObjectiveQuestId): void {
    if (claimObjectiveQuestReward(this.state, objectiveQuestId)) {
      this.commit();
      return;
    }

    this.emit();
  }

  transferHeroInventory(resourceId: ResourceId, amount: number): void {
    if (transferHeroInventoryToStorage(this.state, resourceId, amount) > 0) {
      this.commit();
    } else {
      this.emit();
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

  devStartDemoBattle(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    this.state.activeBattle = createBattleState(
      "dev-demo-settlement",
      { food: 80, water: 70, material: 45, coal: 55 },
      { footman: 5, archer: 4, bulwark: 2 },
      { rat: 4, spider: 2, snake: 2, wolf: 1, zombie: 1, bandit: 1, berserkerZombie: 1 },
    );
    resolveOpeningEnemyTurn(this.state);
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

    if (this.state.activeBattle) {
      this.emit();
      return;
    }

    const previousElapsedSeconds = this.state.elapsedSeconds;
    const scaledDelta = deltaSeconds * this.state.speed;
    this.state.elapsedSeconds += scaledDelta;
    this.autoDisableContinuousShiftsAtDayStart(previousElapsedSeconds, this.state.elapsedSeconds);
    tickBuildings(this.state, scaledDelta);
    tickMarket(this.state, scaledDelta);
    tickQuests(this.state);
    tickResourceSites(this.state, scaledDelta);
    tickBarracksTraining(this.state, scaledDelta);
    tickEnvironment(this.state, scaledDelta);
    applyProduction(this.state, scaledDelta);
    tickHealth(this.state, scaledDelta);
    this.autosaveIfDue();
    this.emit();
  }

  private autoDisableContinuousShiftsAtDayStart(
    previousElapsedSeconds: number,
    nextElapsedSeconds: number,
  ): void {
    if (this.state.workMode !== "continuous") {
      return;
    }

    const wasDaytime = isDaylightHour(previousElapsedSeconds);
    const isDaytime = isDaylightHour(nextElapsedSeconds);

    if (!wasDaytime && isDaytime) {
      this.state.workMode = "day";
    }
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
  state.heroInventory = normalizeResourceRecord(state.heroInventory);
  normalizeQuestState(state);
  normalizeMarketState(state);
  normalizeEnvironmentState(state);
  normalizeResourceSites(state);
  state.activeBattle = normalizeBattleState(state.activeBattle);

  if (state.speed !== 24) {
    state.speed = 1;
  }

  for (const building of Object.values(state.buildings)) {
    building.workers = Math.max(0, building.workers);
    building.constructionWorkers = Math.max(0, building.constructionWorkers);
  }

  state.survivors.units = normalizeUnitCounts(state.survivors.units);
  state.survivors.barracksTrainingQueue = normalizeBarracksTrainingQueue(
    state.survivors.barracksTrainingQueue,
  );
}

function normalizeBattleState(battle: BattleState | null | undefined): BattleState | null {
  if (!battle || !Array.isArray(battle.units)) {
    return null;
  }

  return {
    id: String(battle.id ?? `battle-${Date.now().toString(36)}`),
    siteId: String(battle.siteId ?? ""),
    loot: normalizeResourceSiteLoot(battle.loot),
    turn: battle.turn === "enemy" ? "enemy" : "player",
    round: Math.max(1, Math.floor(battle.round ?? 1)),
    selectedUnitId: typeof battle.selectedUnitId === "string" ? battle.selectedUnitId : null,
    units: battle.units
      .map((unit): BattleState["units"][number] => {
        const count = Math.max(0, Math.floor(unit.count ?? 1));
        return {
          id: String(unit.id),
          unitId: normalizeCombatUnitId(unit.unitId, unit.side === "enemy" ? "rat" : "footman"),
          side: unit.side === "enemy" ? "enemy" : "player",
          count,
          q: Math.floor(unit.q ?? 0),
          r: Math.floor(unit.r ?? 0),
          hp: Math.max(0, Math.floor(unit.hp ?? 1)),
          maxHp: Math.max(1, Math.floor(unit.maxHp ?? unit.hp ?? 1)),
          moved: Boolean(unit.moved),
          acted: Boolean(unit.acted),
        };
      })
      .filter((unit) =>
        isCombatUnitId(unit.unitId) &&
        unit.hp > 0 &&
        unit.count > 0,
      ),
    log: normalizeBattleLogEntries(battle.log),
  };
}

function normalizeBattleLogEntries(log: BattleState["log"] | string[] | undefined): BattleState["log"] {
  if (!Array.isArray(log)) {
    return [];
  }

  return log.slice(0, 8).map((entry) => {
    if (typeof entry === "string") {
      return { key: "text", text: entry };
    }

    if (entry.key === "initiative") {
      return {
        key: "initiative",
        side: entry.side === "enemy" ? "enemy" : "player",
      };
    }

    if (entry.key === "hit") {
      return {
        key: "hit",
        attackerUnitId: normalizeCombatUnitId(entry.attackerUnitId, "footman"),
        attackerCount: Math.max(1, Math.floor(entry.attackerCount ?? 1)),
        targetUnitId: normalizeCombatUnitId(entry.targetUnitId, "rat"),
        targetCount: Math.max(1, Math.floor(entry.targetCount ?? 1)),
        damage: Math.max(0, Math.floor(entry.damage ?? 0)),
        losses: Math.max(0, Math.floor(entry.losses ?? 0)),
      };
    }

    return { key: "text", text: entry.text ?? "" };
  });
}

function normalizeCombatUnitId(
  unitId: BattleState["units"][number]["unitId"] | undefined,
  fallback: BattleState["units"][number]["unitId"],
): BattleState["units"][number]["unitId"] {
  return isCombatUnitId(unitId) ? unitId : fallback;
}

function normalizeUnitCounts(units: UnitCounts | undefined): UnitCounts {
  return Object.fromEntries(
    unitIds.map((unitId) => [unitId, Math.max(0, Math.floor(units?.[unitId] ?? 0))]),
  ) as UnitCounts;
}

function normalizeResourceRecord(resources: Partial<Record<ResourceId, number>> | undefined): Record<ResourceId, number> {
  return {
    food: Math.max(0, Math.floor(resources?.food ?? 0)),
    water: Math.max(0, Math.floor(resources?.water ?? 0)),
    material: Math.max(0, Math.floor(resources?.material ?? 0)),
    coal: Math.max(0, Math.floor(resources?.coal ?? 0)),
    morale: Math.max(0, Math.floor(resources?.morale ?? 0)),
  };
}

function normalizeResourceSiteLoot(loot: BattleState["loot"] | undefined): BattleState["loot"] {
  const normalized: BattleState["loot"] = {};

  for (const resourceId of ["food", "water", "material", "coal"] as const) {
    const amount = Math.max(0, Math.floor(loot?.[resourceId] ?? 0));
    if (amount > 0) {
      normalized[resourceId] = amount;
    }
  }

  return normalized;
}

function normalizeBarracksTrainingQueue(
  queue: BarracksTrainingJobState[] | undefined,
): BarracksTrainingJobState[] {
  if (!Array.isArray(queue)) {
    return [];
  }

  return queue
    .map((job) => {
      const unitId: UnitId = isPlayerUnitId(job.unitId) ? job.unitId : "footman";
      const durationSeconds = Math.max(
        1,
        Math.floor(job.durationSeconds ?? gameConfig.barracks.troopTraining[unitId].seconds),
      );

      return {
        unitId,
        durationSeconds,
        remainingSeconds: Math.min(
          durationSeconds,
          Math.max(0, Math.floor(job.remainingSeconds ?? durationSeconds)),
        ),
      };
    })
    .filter((job) => job.remainingSeconds > 0);
}
