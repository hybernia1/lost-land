import type { CombatSide, CombatUnitId, EnemyUnitId, UnitId } from "../game/types";

export type CombatUnitDefinition = {
  id: CombatUnitId;
  side: CombatSide;
  nameKey: string;
  maxHp: number;
  damage: number;
  range: number;
  move: number;
  initiative: number;
};

export const playerUnitIds: UnitId[] = ["footman", "archer", "bulwark"];

export const enemyUnitIds: EnemyUnitId[] = [
  "rat",
  "spider",
  "snake",
  "wolf",
  "zombie",
  "bandit",
  "berserkerZombie",
];

export const combatUnitIds: CombatUnitId[] = [...playerUnitIds, ...enemyUnitIds];

export const combatUnitDefinitions: Record<CombatUnitId, CombatUnitDefinition> = {
  footman: {
    id: "footman",
    side: "player",
    nameKey: "footman",
    maxHp: 14,
    damage: 4,
    range: 1,
    move: 3,
    initiative: 8,
  },
  archer: {
    id: "archer",
    side: "player",
    nameKey: "archer",
    maxHp: 10,
    damage: 3,
    range: 4,
    move: 2,
    initiative: 10,
  },
  bulwark: {
    id: "bulwark",
    side: "player",
    nameKey: "bulwark",
    maxHp: 28,
    damage: 3,
    range: 1,
    move: 2,
    initiative: 5,
  },
  rat: {
    id: "rat",
    side: "enemy",
    nameKey: "rat",
    maxHp: 6,
    damage: 2,
    range: 1,
    move: 4,
    initiative: 12,
  },
  spider: {
    id: "spider",
    side: "enemy",
    nameKey: "spider",
    maxHp: 12,
    damage: 3,
    range: 1,
    move: 3,
    initiative: 9,
  },
  snake: {
    id: "snake",
    side: "enemy",
    nameKey: "snake",
    maxHp: 14,
    damage: 4,
    range: 1,
    move: 4,
    initiative: 13,
  },
  wolf: {
    id: "wolf",
    side: "enemy",
    nameKey: "wolf",
    maxHp: 18,
    damage: 5,
    range: 1,
    move: 4,
    initiative: 11,
  },
  zombie: {
    id: "zombie",
    side: "enemy",
    nameKey: "zombie",
    maxHp: 24,
    damage: 5,
    range: 1,
    move: 2,
    initiative: 4,
  },
  bandit: {
    id: "bandit",
    side: "enemy",
    nameKey: "bandit",
    maxHp: 22,
    damage: 6,
    range: 3,
    move: 3,
    initiative: 8,
  },
  berserkerZombie: {
    id: "berserkerZombie",
    side: "enemy",
    nameKey: "berserkerZombie",
    maxHp: 42,
    damage: 8,
    range: 1,
    move: 3,
    initiative: 6,
  },
};

export function isCombatUnitId(value: string | undefined): value is CombatUnitId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(combatUnitDefinitions, value);
}

export function isPlayerUnitId(value: string | undefined): value is UnitId {
  return typeof value === "string" && playerUnitIds.includes(value as UnitId);
}
