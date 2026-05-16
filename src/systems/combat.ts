import { combatUnitDefinitions, enemyUnitIds, isPlayerUnitId } from "../data/combatUnits";
import { isSettlementBattleHexBlocked, settlementBattleMap } from "../data/settlementBattleMap";
import { gameConfig } from "../game/config";
import type {
  BattleLogEntry,
  BattleState,
  BattleUnitState,
  CombatSide,
  CombatUnitId,
  EnemyUnitCounts,
  GameState,
  ResourceId,
  ResourceSiteLoot,
  UnitCounts,
} from "../game/types";
import { pushLocalizedLog } from "./log";
import { addRewardResources } from "./resources";
import { addUnits, createEmptyUnitCounts, unitIds } from "./survivors";

const BATTLE_STACK_SIZE = gameConfig.combat.stackSize;

export function createBattleState(
  siteId: string,
  loot: ResourceSiteLoot,
  playerArmy: UnitCounts,
  defenderArmy: EnemyUnitCounts,
): BattleState {
  const units: BattleUnitState[] = [];
  let playerSpawnIndex = 0;
  let enemySpawnIndex = 0;

  for (const unitId of unitIds) {
    const count = Math.max(0, Math.floor(playerArmy[unitId] ?? 0));
    const stackCount = Math.ceil(count / BATTLE_STACK_SIZE);
    for (let index = 0; index < stackCount; index += 1) {
      const stackSize = Math.min(BATTLE_STACK_SIZE, count - index * BATTLE_STACK_SIZE);
      units.push(createBattleUnit(
        `p-${unitId}-${index}`,
        unitId,
        "player",
        stackSize,
        settlementBattleMap.playerSpawnQ,
        getSpawnRow(playerSpawnIndex),
      ));
      playerSpawnIndex += 1;
    }
  }

  for (const unitId of enemyUnitIds) {
    const count = Math.max(0, Math.floor(defenderArmy[unitId] ?? 0));
    const stackCount = Math.ceil(count / BATTLE_STACK_SIZE);
    for (let index = 0; index < stackCount; index += 1) {
      const stackSize = Math.min(BATTLE_STACK_SIZE, count - index * BATTLE_STACK_SIZE);
      units.push(createBattleUnit(
        `e-${unitId}-${index}`,
        unitId,
        "enemy",
        stackSize,
        settlementBattleMap.enemySpawnQ,
        getSpawnRow(enemySpawnIndex),
      ));
      enemySpawnIndex += 1;
    }
  }

  const battle: BattleState = {
    id: `${siteId}-${Date.now().toString(36)}`,
    siteId,
    loot: normalizeResourceSiteLoot(loot),
    turn: Math.random() < 0.5 ? "player" : "enemy",
    round: 1,
    selectedUnitId: null,
    units,
    log: [],
  };
  recordInitiative(battle, battle.turn);
  return battle;
}

export function resolveOpeningEnemyTurn(state: GameState): boolean {
  const battle = state.activeBattle;
  if (!battle || battle.turn !== "enemy") {
    return false;
  }

  const openingRound = battle.round;
  runEnemyTurn(state);
  if (state.activeBattle?.id === battle.id) {
    state.activeBattle.round = openingRound;
  }
  return true;
}

export function selectBattleUnit(state: GameState, unitInstanceId: string): boolean {
  const battle = state.activeBattle;
  if (!battle) {
    return false;
  }

  const unit = getLivingUnit(battle, unitInstanceId);
  if (!unit || unit.side !== "player" || battle.turn !== "player") {
    return false;
  }

  battle.selectedUnitId = unit.id;
  return true;
}

export function moveSelectedBattleUnit(state: GameState, q: number, r: number): boolean {
  const battle = state.activeBattle;
  if (!battle || battle.turn !== "player" || !battle.selectedUnitId) {
    return false;
  }

  const unit = getLivingUnit(battle, battle.selectedUnitId);
  if (!unit || unit.side !== "player" || unit.moved) {
    return false;
  }

  if (!isHexPassable(q, r) || getUnitAt(battle, q, r)) {
    return false;
  }

  const reachableHexes = getBattleReachableHexes(battle, unit);
  if (!reachableHexes.some((hex) => hex.q === q && hex.r === r)) {
    return false;
  }

  unit.q = q;
  unit.r = r;
  unit.moved = true;
  return true;
}

export function attackBattleUnit(state: GameState, targetInstanceId: string): boolean {
  const battle = state.activeBattle;
  if (!battle || battle.turn !== "player" || !battle.selectedUnitId) {
    return false;
  }

  const attacker = getLivingUnit(battle, battle.selectedUnitId);
  const target = getLivingUnit(battle, targetInstanceId);
  if (!attacker || !target || attacker.side !== "player" || target.side !== "enemy" || attacker.acted) {
    return false;
  }

  if (!isInAttackRange(attacker, target)) {
    return false;
  }

  damageUnit(battle, attacker, target);
  attacker.acted = true;
  cleanupDeadUnits(battle);
  return resolveBattleOutcome(state);
}

export function endPlayerBattleTurn(state: GameState): boolean {
  const battle = state.activeBattle;
  if (!battle || battle.turn !== "player") {
    return false;
  }

  battle.turn = "enemy";
  runEnemyTurn(state);
  return true;
}

export function getHexDistance(leftQ: number, leftR: number, rightQ: number, rightR: number): number {
  const left = offsetToCube(leftQ, leftR);
  const right = offsetToCube(rightQ, rightR);

  return Math.max(
    Math.abs(left.x - right.x),
    Math.abs(left.y - right.y),
    Math.abs(left.z - right.z),
  );
}

export function isHexInBounds(q: number, r: number): boolean {
  return q >= 0 && q < settlementBattleMap.width && r >= 0 && r < settlementBattleMap.height;
}

export function isHexPassable(q: number, r: number): boolean {
  return isHexInBounds(q, r) && !isSettlementBattleHexBlocked(q, r);
}

export function isInAttackRange(attacker: BattleUnitState, target: BattleUnitState): boolean {
  return getHexDistance(attacker.q, attacker.r, target.q, target.r) <= combatUnitDefinitions[attacker.unitId].range &&
    hasLineOfSight(attacker.q, attacker.r, target.q, target.r);
}

export function getBattleReachableHexes(battle: BattleState, unit: BattleUnitState): Array<{ q: number; r: number }> {
  const definition = combatUnitDefinitions[unit.unitId];
  const visited = new Set<string>([getHexKey(unit.q, unit.r)]);
  const queue: Array<{ q: number; r: number; distance: number }> = [{ q: unit.q, r: unit.r, distance: 0 }];
  const reachable: Array<{ q: number; r: number }> = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.distance >= definition.move) {
      continue;
    }

    for (const neighbor of getHexNeighbors(current.q, current.r)) {
      const key = getHexKey(neighbor.q, neighbor.r);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      if (!isHexPassable(neighbor.q, neighbor.r) || getUnitAt(battle, neighbor.q, neighbor.r)) {
        continue;
      }

      reachable.push(neighbor);
      queue.push({ ...neighbor, distance: current.distance + 1 });
    }
  }

  return reachable;
}

export function getBattleUnitAttackDamage(unit: BattleUnitState): number {
  const baseDamage = combatUnitDefinitions[unit.unitId].damage;
  const scaling = Math.max(0, gameConfig.combat.stackDamageScaling);
  return Math.max(1, Math.ceil(baseDamage * (1 + (Math.max(1, unit.count) - 1) * scaling)));
}

function runEnemyTurn(state: GameState): void {
  const battle = state.activeBattle;
  if (!battle) {
    return;
  }

  const enemies = battle.units
    .filter((unit) => unit.side === "enemy" && unit.hp > 0)
    .sort((left, right) =>
      combatUnitDefinitions[right.unitId].initiative - combatUnitDefinitions[left.unitId].initiative,
    );

  for (const enemy of enemies) {
    const target = getNearestEnemy(battle, enemy);
    if (!target) {
      break;
    }

    if (!isInAttackRange(enemy, target)) {
      moveTowardTarget(battle, enemy, target);
    }

    const nextTarget = getNearestEnemy(battle, enemy);
    if (nextTarget && isInAttackRange(enemy, nextTarget)) {
      damageUnit(battle, enemy, nextTarget);
    }

    cleanupDeadUnits(battle);
    if (resolveBattleOutcome(state)) {
      return;
    }
  }

  battle.round += 1;
  battle.turn = "player";
  battle.selectedUnitId = null;
  for (const unit of battle.units) {
    unit.moved = false;
    unit.acted = false;
  }
}

function resolveBattleOutcome(state: GameState): boolean {
  const battle = state.activeBattle;
  if (!battle) {
    return false;
  }

  const playerUnits = battle.units.filter((unit) => unit.side === "player" && unit.hp > 0 && unit.count > 0);
  const enemyUnits = battle.units.filter((unit) => unit.side === "enemy" && unit.hp > 0 && unit.count > 0);
  const playerCount = playerUnits.reduce((total, unit) => total + unit.count, 0);

  if (enemyUnits.length <= 0) {
    const site = state.resourceSites.find((candidate) => candidate.id === battle.siteId);
    if (site) {
      site.looted = true;
      site.defenderArmy = Object.fromEntries(enemyUnitIds.map((unitId) => [unitId, 0])) as EnemyUnitCounts;
    }
    const loot = normalizeResourceSiteLoot(battle.loot);
    addRewardResources(state, loot);
    addUnits(state.survivors.units, getSurvivingPlayerArmy(battle));
    pushLocalizedLog(state, "logResourceSiteLooted", {
      count: playerCount,
      deaths: 0,
      loot: getLootSummary(loot),
    });
    state.activeBattle = null;
    return true;
  }

  if (playerUnits.length <= 0) {
    pushLocalizedLog(state, "logResourceSiteAssaultFailed", {
      deaths: 0,
    });
    state.activeBattle = null;
    return true;
  }

  return false;
}

function createBattleUnit(
  id: string,
  unitId: CombatUnitId,
  side: CombatSide,
  count: number,
  q: number,
  r: number,
): BattleUnitState {
  const definition = combatUnitDefinitions[unitId];

  return {
    id,
    unitId,
    side,
    count: Math.max(1, Math.floor(count)),
    q,
    r,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    moved: false,
    acted: false,
  };
}

function getSpawnRow(index: number): number {
  const center = Math.floor(settlementBattleMap.height / 2);
  const offset = Math.ceil(index / 2) * (index % 2 === 0 ? 1 : -1);

  return Math.max(0, Math.min(settlementBattleMap.height - 1, center + offset));
}

function getLivingUnit(battle: BattleState, unitId: string): BattleUnitState | null {
  return battle.units.find((unit) => unit.id === unitId && unit.hp > 0 && unit.count > 0) ?? null;
}

function getUnitAt(battle: BattleState, q: number, r: number): BattleUnitState | null {
  return battle.units.find((unit) => unit.hp > 0 && unit.count > 0 && unit.q === q && unit.r === r) ?? null;
}

function damageUnit(battle: BattleState, attacker: BattleUnitState, target: BattleUnitState): void {
  const damage = getBattleUnitAttackDamage(attacker);
  const beforeCount = target.count;
  const totalHp = getStackTotalHp(target);
  const remainingHp = Math.max(0, totalHp - damage);

  applyStackTotalHp(target, remainingHp);
  const losses = Math.max(0, beforeCount - target.count);
  pushBattleLog(battle, {
    key: "hit",
    attackerUnitId: attacker.unitId,
    attackerCount: attacker.count,
    targetUnitId: target.unitId,
    targetCount: beforeCount,
    damage,
    losses,
  });
}

function cleanupDeadUnits(battle: BattleState): void {
  battle.units = battle.units.filter((unit) => unit.hp > 0 && unit.count > 0);
  if (battle.selectedUnitId && !battle.units.some((unit) => unit.id === battle.selectedUnitId)) {
    battle.selectedUnitId = null;
  }
}

function getNearestEnemy(battle: BattleState, unit: BattleUnitState): BattleUnitState | null {
  const enemies = battle.units.filter((candidate) => candidate.side !== unit.side && candidate.hp > 0 && candidate.count > 0);
  enemies.sort((left, right) =>
    getHexDistance(unit.q, unit.r, left.q, left.r) - getHexDistance(unit.q, unit.r, right.q, right.r),
  );

  return enemies[0] ?? null;
}

function moveTowardTarget(battle: BattleState, unit: BattleUnitState, target: BattleUnitState): void {
  let bestHex = { q: unit.q, r: unit.r };
  let bestDistance = getHexDistance(unit.q, unit.r, target.q, target.r);

  for (const neighbor of getBattleReachableHexes(battle, unit)) {
    const distance = getHexDistance(neighbor.q, neighbor.r, target.q, target.r);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestHex = neighbor;
    }
  }

  unit.q = bestHex.q;
  unit.r = bestHex.r;
}

function offsetToCube(q: number, r: number): { x: number; y: number; z: number } {
  if (settlementBattleMap.staggerAxis === "y") {
    const oddOffset = settlementBattleMap.staggerIndex === "odd" ? 1 : 0;
    const x = q - Math.floor((r + oddOffset) / 2);
    const z = r;
    return { x, y: -x - z, z };
  }

  const oddOffset = settlementBattleMap.staggerIndex === "odd" ? 1 : 0;
  const x = q;
  const z = r - Math.floor((q + oddOffset) / 2);
  return { x, y: -x - z, z };
}

function cubeToOffset(cube: { x: number; y: number; z: number }): { q: number; r: number } {
  if (settlementBattleMap.staggerAxis === "y") {
    const oddOffset = settlementBattleMap.staggerIndex === "odd" ? 1 : 0;
    const r = cube.z;
    const q = cube.x + Math.floor((r + oddOffset) / 2);
    return { q, r };
  }

  const oddOffset = settlementBattleMap.staggerIndex === "odd" ? 1 : 0;
  const q = cube.x;
  const r = cube.z + Math.floor((q + oddOffset) / 2);
  return { q, r };
}

function getHexNeighbors(q: number, r: number): Array<{ q: number; r: number }> {
  const cube = offsetToCube(q, r);
  const directions = [
    { x: 1, y: -1, z: 0 },
    { x: 1, y: 0, z: -1 },
    { x: 0, y: 1, z: -1 },
    { x: -1, y: 1, z: 0 },
    { x: -1, y: 0, z: 1 },
    { x: 0, y: -1, z: 1 },
  ];

  return directions
    .map((direction) => cubeToOffset({
      x: cube.x + direction.x,
      y: cube.y + direction.y,
      z: cube.z + direction.z,
    }))
    .filter((hex) => isHexInBounds(hex.q, hex.r));
}

function hasLineOfSight(fromQ: number, fromR: number, toQ: number, toR: number): boolean {
  const distance = getHexDistance(fromQ, fromR, toQ, toR);
  if (distance <= 1) {
    return true;
  }

  const from = offsetToCube(fromQ, fromR);
  const to = offsetToCube(toQ, toR);
  for (let step = 1; step < distance; step += 1) {
    const t = step / distance;
    const hex = cubeToOffset(roundCube({
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      z: lerp(from.z, to.z, t),
    }));

    if (isSettlementBattleHexBlocked(hex.q, hex.r)) {
      return false;
    }
  }

  return true;
}

function roundCube(cube: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  let x = Math.round(cube.x);
  let y = Math.round(cube.y);
  let z = Math.round(cube.z);
  const xDiff = Math.abs(x - cube.x);
  const yDiff = Math.abs(y - cube.y);
  const zDiff = Math.abs(z - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    x = -y - z;
  } else if (yDiff > zDiff) {
    y = -x - z;
  } else {
    z = -x - y;
  }

  return { x, y, z };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function getHexKey(q: number, r: number): string {
  return `${q}:${r}`;
}

function recordInitiative(battle: BattleState, side: CombatSide): void {
  pushBattleLog(battle, {
    key: "initiative",
    side,
  });
}

function pushBattleLog(battle: BattleState, entry: BattleLogEntry): void {
  battle.log.unshift(entry);
  battle.log = battle.log.slice(0, 8);
}

function getSurvivingPlayerArmy(battle: BattleState): UnitCounts {
  const units = createEmptyUnitCounts();

  for (const unit of battle.units) {
    if (unit.side !== "player" || unit.hp <= 0 || unit.count <= 0 || !isPlayerUnitId(unit.unitId)) {
      continue;
    }

    units[unit.unitId] += unit.count;
  }

  return units;
}

function getStackTotalHp(unit: BattleUnitState): number {
  return Math.max(0, (Math.max(1, unit.count) - 1) * unit.maxHp + unit.hp);
}

function applyStackTotalHp(unit: BattleUnitState, totalHp: number): void {
  if (totalHp <= 0) {
    unit.count = 0;
    unit.hp = 0;
    return;
  }

  unit.count = Math.max(1, Math.ceil(totalHp / unit.maxHp));
  const frontHp = totalHp % unit.maxHp;
  unit.hp = frontHp === 0 ? unit.maxHp : frontHp;
}

function getLootSummary(loot: Partial<Record<ResourceId, number>>): string {
  return Object.entries(loot)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([resourceId, amount]) => `${resourceId}:${amount}`)
    .join(",");
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
