export type ResourceId =
  | "food"
  | "water"
  | "material"
  | "coal"
  | "morale";

export type BuildingId =
  | "mainBuilding"
  | "storage"
  | "dormitory"
  | "hydroponics"
  | "waterStill"
  | "workshop"
  | "coalMine"
  | "market"
  | "watchtower"
  | "barracks"
  | "academy"
  | "clinic";

export type BuildingCategory =
  | "resource"
  | "housing"
  | "support";

export type ResourceBag = Partial<Record<ResourceId, number>>;

export type BuildingLevelRequirement = {
  level: number;
  cost: ResourceBag;
  buildSeconds: number;
  constructionWorkers: number;
};

export type BuildingDefinition = {
  id: BuildingId;
  category: BuildingCategory;
  name: string;
  description: string;
  maxLevel: number;
  buildSeconds: number;
  baseConstructionWorkers: number;
  baseCost: ResourceBag;
  levelRequirements: BuildingLevelRequirement[];
  produces?: ResourceBag;
  consumes?: ResourceBag;
  alwaysConsumes?: ResourceBag;
  storageBonus?: ResourceBag;
  housing?: number;
  requiredMainBuildingLevel?: number;
  requiredMainBuildingLevelByUpgradeLevel?: number[];
};

export type BuildingState = {
  id: BuildingId;
  level: number;
  upgradingRemaining: number;
  workers: number;
  constructionWorkers: number;
};

export type VillagePlotState = {
  id: string;
  buildingId: BuildingId | null;
};

export type ResourceDefinition = {
  id: ResourceId;
  name: string;
  softCap?: number;
};

export type UnitId = "footman" | "archer" | "bulwark";
export type EnemyUnitId =
  | "rat"
  | "spider"
  | "snake"
  | "wolf"
  | "zombie"
  | "bandit"
  | "berserkerZombie";
export type CombatUnitId = UnitId | EnemyUnitId;
export type CombatSide = "player" | "enemy";

export type UnitCounts = Record<UnitId, number>;
export type EnemyUnitCounts = Record<EnemyUnitId, number>;

export type SurvivorRoles = {
  workers: number;
  units: UnitCounts;
  barracksTrainingQueue: BarracksTrainingJobState[];
};

export type BarracksTrainingJobState = {
  unitId: UnitId;
  remainingSeconds: number;
  durationSeconds: number;
};

export type MarketResourceId = Exclude<ResourceId, "morale">;

export type MarketState = {
  cooldownRemainingSeconds: number;
  tradesUsed: number;
};

export type HealthState = {
  injured: number;
  treatmentProgress: number;
  nextIncidentAt: number;
  starvationProgress: number;
  dehydrationProgress: number;
};

export type GameSpeed = 1 | 24;

export type WorkMode = "day" | "continuous";

export type EnvironmentConditionId =
  | "stable"
  | "rain"
  | "snowFront";

export type EnvironmentCrisisState = {
  kind: "shelter";
  startedAt: number;
  deadlineAt: number;
  initialHomeless: number;
  lastWarningAt: number;
};

export type EnvironmentState = {
  condition: EnvironmentConditionId;
  intensity: number;
  startedAt: number;
  endsAt: number;
  nextConditionAt: number;
  activeCrisis: EnvironmentCrisisState | null;
};

export type ResourceSiteLoot = Partial<Record<MarketResourceId, number>>;

export type ResourceSiteAssaultState = {
  troops: number;
  units: UnitCounts;
  remainingSeconds: number;
  travelTiles: number;
};

export type ResourceSiteState = {
  id: string;
  loot: ResourceSiteLoot;
  looted: boolean;
  defenderArmy: EnemyUnitCounts;
  assault: ResourceSiteAssaultState | null;
};

export type BattleUnitState = {
  id: string;
  unitId: CombatUnitId;
  side: CombatSide;
  count: number;
  q: number;
  r: number;
  hp: number;
  maxHp: number;
  moved: boolean;
  acted: boolean;
};

export type BattleLogEntry = {
  key: "initiative" | "hit" | "text";
  text?: string;
  side?: CombatSide;
  attackerUnitId?: CombatUnitId;
  attackerCount?: number;
  targetUnitId?: CombatUnitId;
  targetCount?: number;
  damage?: number;
  losses?: number;
};

export type BattleState = {
  id: string;
  siteId: string;
  loot: ResourceSiteLoot;
  turn: CombatSide;
  round: number;
  selectedUnitId: string | null;
  units: BattleUnitState[];
  log: BattleLogEntry[];
};

export type ObjectiveQuestId =
  | "buildStorage"
  | "buildCoalMine"
  | "buildDormitory"
  | "buildWaterStill"
  | "buildHydroponics";

export type DecisionQuestId =
  | "foundingBriefing"
  | "survivorsAtGate"
  | "rationDispute"
  | "radioCall"
  | "bittenStranger"
  | "traderAtDusk"
  | "nightScreams"
  | "waterTheft"
  | "coalMineSpareParts"
  | "provenTheft"
  | "collapsedUnderpass"
  | "brokenWaterFilter";

export type SuddenQuestId =
  | "cropSpoilage";

export type DecisionProfileAxisId =
  | "communityMarket"
  | "authorityAutonomy";

export type DecisionOptionId = string;

export type ObjectiveQuestState = {
  definitionId: ObjectiveQuestId;
  completedAt: number | null;
  rewardClaimedAt: number | null;
};

export type ActiveDecisionQuestState = {
  id: string;
  definitionId: DecisionQuestId;
  startedAt: number;
  wasPaused: boolean;
};

export type DecisionHistoryEntry = {
  definitionId: DecisionQuestId;
  optionId: DecisionOptionId;
  resolvedAt: number;
};

export type QuestState = {
  objectives: ObjectiveQuestState[];
  activeDecision: ActiveDecisionQuestState | null;
  resolvedDecisionCount: number;
  resolvedSuddenCount: number;
  nextDecisionAt: number;
  resolvedDecisionIds: DecisionQuestId[];
  decisionHistory: DecisionHistoryEntry[];
  recentDecisionIds: DecisionQuestId[];
  recentSuddenIds: SuddenQuestId[];
};

export type LogEntrySource = "ui" | "questUi" | "questDecisionResult" | "questSuddenResult";
export type LogEntrySeverity = "neutral" | "positive" | "warning" | "critical";

export type LogEntry = {
  source: LogEntrySource;
  key: string;
  params?: Record<string, string | number>;
  severity?: LogEntrySeverity;
};

export type GameState = {
  saveVersion: number;
  saveId: string;
  communityName: string;
  startedAt: string;
  elapsedSeconds: number;
  paused: boolean;
  speed: GameSpeed;
  workMode: WorkMode;
  resources: Record<ResourceId, number>;
  capacities: Record<ResourceId, number>;
  heroInventory: Record<ResourceId, number>;
  survivors: SurvivorRoles;
  quests: QuestState;
  resourceSites: ResourceSiteState[];
  activeBattle: BattleState | null;
  market: MarketState;
  health: HealthState;
  environment: EnvironmentState;
  buildings: Record<BuildingId, BuildingState>;
  village: {
    selectedPlotId: string;
    plots: VillagePlotState[];
  };
  log: LogEntry[];
};

export type GameListener = (state: GameState) => void;
