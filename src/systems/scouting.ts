import { gameConfig } from "../game/config";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import type { GameState, ResourceBag, ScoutingMode, ScoutingMission } from "../game/types";
import { pushLocalizedLog } from "./log";
import { addResources } from "./resources";

export const SCOUTING_DURATION_SECONDS = GAME_HOUR_REAL_SECONDS * gameConfig.scouting.durationHours;
export const SCOUTING_CARRY_PER_TROOP = gameConfig.scouting.carryPerTroop;

const SCOUTING_MODE_DEATH_RISK: Record<ScoutingMode, number> = {
  safe: 0.1,
  risky: 0.5,
};

export function startScoutingMission(
  state: GameState,
  mode: ScoutingMode,
  troopCount: number,
): boolean {
  const troops = Math.max(0, Math.floor(troopCount));

  if (
    state.buildings.barracks.level <= 0 ||
    troops <= 0 ||
    state.survivors.troops < troops
  ) {
    return false;
  }

  state.survivors.troops -= troops;
  state.scouting.missions.push({
    id: `scout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    troops,
    remainingSeconds: SCOUTING_DURATION_SECONDS,
  });

  pushLocalizedLog(state, "logScoutingStarted", {
    count: troops,
    modeKey: getLocalizedModeKey(mode),
  });
  return true;
}

export function tickScouting(state: GameState, deltaSeconds: number): void {
  if (state.scouting.missions.length === 0) {
    return;
  }

  const activeMissions: ScoutingMission[] = [];

  for (const mission of state.scouting.missions) {
    const nextMission = {
      ...mission,
      remainingSeconds: Math.max(0, mission.remainingSeconds - deltaSeconds),
    };

    if (nextMission.remainingSeconds > 0) {
      activeMissions.push(nextMission);
      continue;
    }

    resolveScoutingMission(state, nextMission);
  }

  state.scouting.missions = activeMissions;
}

export function getScoutingTroopCount(state: GameState): number {
  return state.scouting.missions.reduce((total, mission) => total + mission.troops, 0);
}

function resolveScoutingMission(state: GameState, mission: ScoutingMission): void {
  const deaths = rollDeaths(mission.troops, mission.mode);
  const returningTroops = mission.troops - deaths;
  const workersBeforeReturn = state.survivors.workers;

  state.survivors.troops += returningTroops;

  const found = returningTroops > 0 ? rollLoot(returningTroops, mission.mode) : {};
  const accepted = addLoot(state, found);
  state.survivors.workers = workersBeforeReturn;

  pushLocalizedLog(state, "logScoutingReturned", {
    count: returningTroops,
    deaths,
    food: Math.floor(accepted.food ?? 0),
    water: Math.floor(accepted.water ?? 0),
  });
}

function rollDeaths(troops: number, mode: ScoutingMode): number {
  const baseRisk = SCOUTING_MODE_DEATH_RISK[mode];
  const perTroopRisk = Math.min(0.9, baseRisk * randomBetween(0.55, 1.25));
  let deaths = 0;

  for (let index = 0; index < troops; index += 1) {
    if (Math.random() < perTroopRisk) {
      deaths += 1;
    }
  }

  return deaths;
}

function rollLoot(troops: number, mode: ScoutingMode): ResourceBag {
  const capacity = troops * SCOUTING_CARRY_PER_TROOP;
  const loadFactor = mode === "safe"
    ? randomBetween(0.35, 0.65)
    : randomBetween(0.6, 1);
  const totalLoot = Math.round(capacity * loadFactor);
  const foodShare = randomBetween(0.42, 0.58);
  const food = Math.round(totalLoot * foodShare);

  return {
    food,
    water: Math.max(0, totalLoot - food),
  };
}

function addLoot(state: GameState, loot: ResourceBag): ResourceBag {
  const beforeFood = state.resources.food;
  const beforeWater = state.resources.water;

  addResources(state.resources, loot, state.capacities);

  return {
    food: state.resources.food - beforeFood,
    water: state.resources.water - beforeWater,
  };
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function getLocalizedModeKey(mode: ScoutingMode): string {
  return mode === "safe" ? "safeScoutingLog" : "riskyScoutingLog";
}
