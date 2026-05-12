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
  | "generator"
  | "market"
  | "watchtower"
  | "barracks"
  | "academy"
  | "clinic";

export type BuildingCategory =
  | "resource"
  | "housing"
  | "defense"
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
  defense?: number;
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

export type SurvivorRoles = {
  workers: number;
  troops: number;
  barracksTrainingProgress: number;
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
  | "snowFront"
  | "radiation";

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

export type ResourceSiteResourceId = "food" | "water" | "coal" | "material";

export type ResourceSiteAssaultState = {
  troops: number;
  remainingSeconds: number;
  travelTiles: number;
};

export type ResourceSiteState = {
  id: string;
  resourceId: ResourceSiteResourceId;
  captured: boolean;
  assignedWorkers: number;
  maxWorkers: number;
  yieldPerWorker: number;
  captureMinTroops: number;
  captureBaseDeathRisk: number;
  assault: ResourceSiteAssaultState | null;
};

export type ObjectiveQuestId =
  | "buildStorage"
  | "buildGenerator"
  | "buildDormitory"
  | "buildWaterStill"
  | "buildHydroponics";

export type DecisionQuestId =
  | "survivorsAtGate"
  | "rationDispute"
  | "radioCall"
  | "bittenStranger"
  | "traderAtDusk"
  | "nightScreams"
  | "waterTheft"
  | "generatorSpareParts"
  | "provenTheft"
  | "collapsedUnderpass"
  | "brokenWaterFilter";

export type SuddenQuestId =
  | "cropSpoilage";

export type DecisionProfileAxisId =
  | "philanthropyPrinciple"
  | "mercySecurity"
  | "opennessCaution";

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
  survivors: SurvivorRoles;
  quests: QuestState;
  resourceSites: ResourceSiteState[];
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
