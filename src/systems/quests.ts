import { buildingDefinitions } from "../data/buildings";
import {
  decisionQuestById,
  decisionQuestDefinitions,
  type DecisionQuestDefinition,
  type DecisionQuestOptionDefinition,
} from "../data/decisions";
import {
  objectiveQuestById,
  objectiveQuestDefinitions,
  suddenQuestById,
  suddenQuestDefinitions,
  type ObjectiveQuestDefinition,
  type ObjectiveQuestTarget,
  type ObjectiveQuestTrigger,
  type SuddenQuestDefinition,
} from "../data/quests";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import type {
  BuildingId,
  DecisionOptionId,
  DecisionProfileAxisId,
  DecisionQuestId,
  DecisionHistoryEntry,
  GameState,
  ObjectiveQuestId,
  QuestState,
  ResourceBag,
  ResourceId,
  SuddenQuestId,
} from "../game/types";
import { pushLogEntry } from "./log";
import { getPopulation } from "./population";
import { addResources, addRewardResources, canAfford } from "./resources";

const FIRST_DECISION_DELAY_SECONDS = GAME_HOUR_REAL_SECONDS * 4;
const NEXT_DECISION_BASE_SECONDS = GAME_HOUR_REAL_SECONDS * 7;
const NEXT_DECISION_RANGE_SECONDS = GAME_HOUR_REAL_SECONDS * 7;
const RECENT_DECISION_MEMORY = 2;
const RECENT_SUDDEN_MEMORY = 2;
const SUDDEN_QUEST_CHANCE = 0.35;
const DECISION_PROFILE_SCORE_RANGE = 2;
const DECISION_PROFILE_DECISIVE_THRESHOLD = 18;
const SCARCITY_THEFT_RESOURCE_IDS: ResourceId[] = ["food", "water", "material"];
const SCARCITY_THEFT_THRESHOLD = 0.22;
const SCARCITY_THEFT_BASE_CHANCE = 0.18;
const SCARCITY_THEFT_PRESSURE_CHANCE = 0.42;
const OPENING_DECISION_ID: DecisionQuestId = "foundingBriefing";

const objectiveChainStageIndex = createObjectiveChainStageIndex();

type ObjectiveTriggerEvent = ObjectiveQuestTrigger | "tick";

export type DecisionProfileKind =
  | "noData"
  | "balanced"
  | "communalAuthority"
  | "marketAuthority"
  | "communalAutonomy"
  | "marketAutonomy";

export const decisionProfileAxes: {
  id: DecisionProfileAxisId;
  leftKind: DecisionProfileKind;
  leftLabelKey: string;
  rightKind: DecisionProfileKind;
  rightLabelKey: string;
}[] = [
  {
    id: "communityMarket",
    leftKind: "communalAuthority",
    leftLabelKey: "profileCommunity",
    rightKind: "marketAuthority",
    rightLabelKey: "profileMarket",
  },
  {
    id: "authorityAutonomy",
    leftKind: "communalAutonomy",
    leftLabelKey: "profileAutonomy",
    rightKind: "marketAuthority",
    rightLabelKey: "profileAuthority",
  },
];

export function createInitialQuestState(): QuestState {
  return {
    objectives: objectiveQuestDefinitions.map((definition) => ({
      definitionId: definition.id,
      completedAt: null,
      rewardClaimedAt: null,
    })),
    activeDecision: {
      id: "decision-opening-briefing",
      definitionId: OPENING_DECISION_ID,
      startedAt: 0,
      wasPaused: false,
    },
    resolvedDecisionCount: 0,
    resolvedSuddenCount: 0,
    nextDecisionAt: FIRST_DECISION_DELAY_SECONDS,
    resolvedDecisionIds: [],
    decisionHistory: [],
    recentDecisionIds: [],
    recentSuddenIds: [],
    triggerSnapshot: createEmptyTriggerSnapshot(),
  };
}

export function normalizeQuestState(state: GameState): void {
  const source = state.quests;
  const existingObjectives = new Map(
    source?.objectives?.map((quest) => [
      quest.definitionId,
      {
        completedAt: quest.completedAt ?? null,
        rewardClaimedAt: quest.rewardClaimedAt ?? null,
      },
    ]) ?? [],
  );

  state.quests = {
    objectives: objectiveQuestDefinitions.map((definition) => ({
      definitionId: definition.id,
      completedAt: existingObjectives.get(definition.id)?.completedAt ?? null,
      rewardClaimedAt: existingObjectives.get(definition.id)?.rewardClaimedAt ?? null,
    })),
    activeDecision: normalizeActiveDecision(source?.activeDecision ?? null),
    resolvedDecisionCount: Math.max(0, Math.floor(source?.resolvedDecisionCount ?? 0)),
    resolvedSuddenCount: Math.max(0, Math.floor(source?.resolvedSuddenCount ?? 0)),
    nextDecisionAt: Math.max(
      FIRST_DECISION_DELAY_SECONDS,
      source?.nextDecisionAt ?? FIRST_DECISION_DELAY_SECONDS,
    ),
    resolvedDecisionIds: (source?.resolvedDecisionIds ?? [])
      .filter((id): id is DecisionQuestId => id in decisionQuestById),
    decisionHistory: normalizeDecisionHistory(source?.decisionHistory ?? []),
    recentDecisionIds: (source?.recentDecisionIds ?? [])
      .filter((id): id is DecisionQuestId => id in decisionQuestById)
      .slice(0, RECENT_DECISION_MEMORY),
    recentSuddenIds: (source?.recentSuddenIds ?? [])
      .filter((id): id is SuddenQuestId => id in suddenQuestById)
      .slice(0, RECENT_SUDDEN_MEMORY),
    triggerSnapshot: createEmptyTriggerSnapshot(),
  };

  for (const objective of state.quests.objectives) {
    if (objective.completedAt === null) {
      objective.rewardClaimedAt = null;
      continue;
    }

    if (
      objective.rewardClaimedAt !== null &&
      objective.rewardClaimedAt < objective.completedAt
    ) {
      objective.rewardClaimedAt = objective.completedAt;
    }
  }

  syncQuestTriggerSnapshot(state);
}

export function tickQuests(state: GameState): void {
  const objectiveEvents = collectObjectiveTriggerEvents(state);
  resolveObjectiveQuests(state, objectiveEvents);
  maybeStartDecisionQuest(state);
}

export function resolveDecisionQuest(
  state: GameState,
  optionId: DecisionOptionId,
): boolean {
  const activeDecision = state.quests.activeDecision;

  if (!activeDecision) {
    return false;
  }

  const definition = decisionQuestById[activeDecision.definitionId];
  const option = definition.options.find((candidate) => candidate.id === optionId);

  if (!option || !canAffordDecisionOption(state, option)) {
    return false;
  }

  if (option.resources) {
    addRewardResources(state, option.resources);
  }

  if (option.morale) {
    addResources(state.resources, { morale: option.morale }, state.capacities);
  }

  state.survivors.workers += option.workers ?? 0;
  state.health.injured += option.injured ?? 0;
  state.quests.activeDecision = null;
  state.quests.resolvedDecisionCount += 1;
  state.quests.decisionHistory = [
    ...state.quests.decisionHistory,
    {
      definitionId: definition.id,
      optionId: option.id,
      resolvedAt: state.elapsedSeconds,
    },
  ];
  state.quests.resolvedDecisionIds = [
    ...state.quests.resolvedDecisionIds.filter((id) => id !== definition.id),
    definition.id,
  ];
  state.quests.recentDecisionIds = [
    definition.id,
    ...state.quests.recentDecisionIds.filter((id) => id !== definition.id),
  ].slice(0, RECENT_DECISION_MEMORY);

  const objectiveEvents = collectObjectiveTriggerEvents(state);
  resolveObjectiveQuests(state, objectiveEvents);

  scheduleNextDecision(state);
  state.paused = activeDecision.wasPaused;
  pushLogEntry(state, {
    source: "questDecisionResult",
    key: definition.id,
    params: { optionId: option.id },
  });
  return true;
}

export function isObjectiveQuestComplete(
  state: GameState,
  definition: ObjectiveQuestDefinition,
): boolean {
  const progress = getObjectiveQuestProgress(state, definition);
  return progress.current >= progress.required;
}

export function getObjectiveQuestProgress(
  state: GameState,
  definition: ObjectiveQuestDefinition,
): { current: number; required: number } {
  return getObjectiveTargetProgress(state, definition.target);
}

export function getActiveObjectiveQuests(state: GameState) {
  return state.quests.objectives.filter((quest) => {
    if (quest.completedAt !== null && quest.rewardClaimedAt !== null) {
      return false;
    }

    const definition = objectiveQuestById[quest.definitionId];
    return isObjectiveUnlocked(state, definition);
  });
}

export function canAffordDecisionOption(
  state: GameState,
  option: DecisionQuestOptionDefinition,
): boolean {
  return canAfford(state.resources, getDecisionOptionCost(option)) &&
    state.survivors.workers >= Math.abs(Math.min(0, option.workers ?? 0));
}

export function getDecisionProfileScores(state: GameState): Record<DecisionProfileAxisId, number> {
  const scores = createEmptyDecisionProfileScores();

  for (const entry of state.quests.decisionHistory) {
    const option = getDecisionHistoryOption(entry);

    if (!option) {
      continue;
    }

    for (const axis of decisionProfileAxes) {
      scores[axis.id] += option.profileScores?.[axis.id] ?? 0;
    }
  }

  return scores;
}

export function getDecisionProfileAxisValue(
  state: GameState,
  axisId: DecisionProfileAxisId,
): number {
  const score = getDecisionProfileScores(state)[axisId];
  const maxMagnitude = Math.max(
    DECISION_PROFILE_SCORE_RANGE,
    state.quests.decisionHistory.length * DECISION_PROFILE_SCORE_RANGE,
  );

  return Math.max(-100, Math.min(100, (score / maxMagnitude) * 100));
}

export function getDecisionProfileKind(state: GameState): DecisionProfileKind {
  if (state.quests.decisionHistory.length === 0) {
    return "noData";
  }

  const marketValue = getDecisionProfileAxisValue(state, "communityMarket");
  const authorityValue = getDecisionProfileAxisValue(state, "authorityAutonomy");
  const profileMagnitude = Math.hypot(marketValue, authorityValue);

  if (profileMagnitude < DECISION_PROFILE_DECISIVE_THRESHOLD) {
    return "balanced";
  }

  if (marketValue < 0 && authorityValue >= 0) {
    return "communalAuthority";
  }

  if (marketValue >= 0 && authorityValue >= 0) {
    return "marketAuthority";
  }

  if (marketValue < 0 && authorityValue < 0) {
    return "communalAutonomy";
  }

  return "marketAutonomy";
}

export function getDecisionOptionCost(option: DecisionQuestOptionDefinition): ResourceBag {
  const cost: ResourceBag = {};

  for (const [resourceId, value] of Object.entries(option.resources ?? {})) {
    if ((value ?? 0) < 0) {
      cost[resourceId as ResourceId] = Math.abs(value ?? 0);
    }
  }

  return cost;
}

export function canClaimObjectiveReward(
  state: GameState,
  objectiveQuestId: ObjectiveQuestId,
): boolean {
  const objectiveState = getObjectiveState(state, objectiveQuestId);

  if (!objectiveState) {
    return false;
  }

  return objectiveState.completedAt !== null && objectiveState.rewardClaimedAt === null;
}

export function claimObjectiveQuestReward(
  state: GameState,
  objectiveQuestId: ObjectiveQuestId,
): boolean {
  const objectiveState = getObjectiveState(state, objectiveQuestId);
  const definition = objectiveQuestById[objectiveQuestId];

  if (!objectiveState || !definition || !canClaimObjectiveReward(state, objectiveQuestId)) {
    return false;
  }

  addRewardResources(state, definition.reward);
  objectiveState.rewardClaimedAt = state.elapsedSeconds;
  pushLogEntry(state, {
    source: "questUi",
    key: "logObjectiveRewardClaimed",
    params: { questId: objectiveQuestId },
    severity: "positive",
  });
  return true;
}

function getObjectiveTargetProgress(
  state: GameState,
  target: ObjectiveQuestTarget,
): { current: number; required: number } {
  if (target.type === "buildingLevel") {
    const currentLevel = state.buildings[target.buildingId]?.level ?? 0;
    return {
      current: Math.min(target.requiredLevel, currentLevel),
      required: target.requiredLevel,
    };
  }

  if (target.type === "populationAtLeast") {
    const population = getPopulation(state);
    return {
      current: Math.min(target.requiredPopulation, population),
      required: target.requiredPopulation,
    };
  }

  if (target.type === "resourceSitesLootedAtLeast") {
    const lootedCount = getLootedResourceSiteCount(state);
    return {
      current: Math.min(target.requiredCount, lootedCount),
      required: target.requiredCount,
    };
  }

  if (target.type === "resolvedDecisionsAtLeast") {
    return {
      current: Math.min(target.requiredCount, state.quests.resolvedDecisionCount),
      required: target.requiredCount,
    };
  }

  return {
    current: Math.min(target.requiredCount, state.quests.resolvedSuddenCount),
    required: target.requiredCount,
  };
}

function completeObjectiveQuest(
  state: GameState,
  objectiveQuestId: ObjectiveQuestId,
): void {
  const objectiveState = getObjectiveState(state, objectiveQuestId);
  const definition = objectiveQuestById[objectiveQuestId];

  if (!objectiveState || !definition || objectiveState.completedAt !== null) {
    return;
  }

  objectiveState.completedAt = state.elapsedSeconds;
  objectiveState.rewardClaimedAt = null;
  pushLogEntry(state, {
    source: "questUi",
    key: "logObjectiveCompleted",
    params: { questId: definition.id },
  });
}

function resolveObjectiveQuests(
  state: GameState,
  triggerEvents: ReadonlySet<ObjectiveTriggerEvent>,
): void {
  for (const quest of state.quests.objectives) {
    if (quest.completedAt !== null) {
      continue;
    }

    const definition = objectiveQuestById[quest.definitionId];

    if (
      !triggerEvents.has(definition.trigger) ||
      !isObjectiveUnlocked(state, definition) ||
      !isObjectiveQuestComplete(state, definition)
    ) {
      continue;
    }

    completeObjectiveQuest(state, quest.definitionId);
  }
}

function isObjectiveUnlocked(
  state: GameState,
  definition: ObjectiveQuestDefinition,
): boolean {
  return areObjectiveRequirementsComplete(state, definition) &&
    isChainStageUnlocked(state, definition);
}

function areObjectiveRequirementsComplete(
  state: GameState,
  definition: ObjectiveQuestDefinition,
): boolean {
  return (definition.requires ?? []).every((requiredId) =>
    state.quests.objectives.some(
      (quest) => quest.definitionId === requiredId && quest.completedAt !== null,
    ),
  );
}

function isChainStageUnlocked(
  state: GameState,
  definition: ObjectiveQuestDefinition,
): boolean {
  if (definition.kind !== "chain") {
    return true;
  }

  if (definition.chain.stage <= 1) {
    return true;
  }

  const previousStageDefinition = objectiveChainStageIndex
    .get(definition.chain.id)
    ?.get(definition.chain.stage - 1);

  if (!previousStageDefinition) {
    return false;
  }

  return state.quests.objectives.some(
    (quest) =>
      quest.definitionId === previousStageDefinition.id &&
      quest.completedAt !== null,
  );
}

function maybeStartDecisionQuest(state: GameState): void {
  if (state.quests.activeDecision || state.elapsedSeconds < state.quests.nextDecisionAt) {
    return;
  }

  const theftResourceId = pickScarcityTheftResource(state);

  if (theftResourceId && Math.random() < getScarcityTheftChance(state, theftResourceId)) {
    applyScarcityTheft(state, theftResourceId);
    return;
  }

  if (Math.random() < SUDDEN_QUEST_CHANCE) {
    applySuddenQuest(state, pickSuddenQuest(state));
    return;
  }

  const definition = pickDecisionQuest(state);

  if (!definition) {
    scheduleNextDecision(state);
    return;
  }

  state.quests.activeDecision = {
    id: `decision-${Math.floor(state.elapsedSeconds)}-${state.quests.resolvedDecisionCount}`,
    definitionId: definition.id,
    startedAt: state.elapsedSeconds,
    wasPaused: state.paused,
  };
  state.paused = true;
  pushLogEntry(state, {
    source: "questUi",
    key: "logDecisionAppeared",
  });
}

function applySuddenQuest(state: GameState, definition: SuddenQuestDefinition): void {
  const losses: ResourceBag = {};

  for (const [resourceId, percent] of Object.entries(definition.resourceLossPercent ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    const loss = Math.ceil((state.resources[typedResourceId] ?? 0) * (percent ?? 0));

    if (loss > 0) {
      losses[typedResourceId] = -loss;
    }
  }

  addResources(state.resources, losses, state.capacities);
  state.quests.resolvedSuddenCount += 1;
  state.quests.recentSuddenIds = [
    definition.id,
    ...state.quests.recentSuddenIds.filter((id) => id !== definition.id),
  ].slice(0, RECENT_SUDDEN_MEMORY);

  const objectiveEvents = collectObjectiveTriggerEvents(state);
  resolveObjectiveQuests(state, objectiveEvents);

  scheduleNextDecision(state);
  pushLogEntry(state, {
    source: "questSuddenResult",
    key: definition.id,
  });
}

function applyScarcityTheft(state: GameState, resourceId: ResourceId): void {
  const stock = state.resources[resourceId];
  const capacity = Math.max(1, state.capacities[resourceId]);
  const loss = Math.max(1, Math.min(
    Math.floor(stock),
    Math.ceil(capacity * 0.06),
  ));

  if (loss <= 0) {
    scheduleNextDecision(state);
    return;
  }

  addResources(state.resources, { [resourceId]: -loss }, state.capacities);
  state.quests.resolvedSuddenCount += 1;

  const objectiveEvents = collectObjectiveTriggerEvents(state);
  resolveObjectiveQuests(state, objectiveEvents);

  scheduleNextDecision(state);
  pushLogEntry(state, {
    source: "questSuddenResult",
    key: "scarcityTheft",
    params: { resourceId, amount: loss },
  });
}

function pickDecisionQuest(state: GameState): DecisionQuestDefinition | null {
  const candidates = decisionQuestDefinitions.filter(
    (definition) =>
      state.elapsedSeconds >= definition.minElapsedSeconds &&
      !state.quests.resolvedDecisionIds.includes(definition.id),
  );

  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce((total, definition) => total + definition.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const definition of candidates) {
    roll -= definition.weight;

    if (roll <= 0) {
      return definition;
    }
  }

  return candidates[candidates.length - 1];
}

function pickScarcityTheftResource(state: GameState): ResourceId | null {
  const candidates = SCARCITY_THEFT_RESOURCE_IDS
    .map((resourceId) => {
      const capacity = Math.max(1, state.capacities[resourceId]);
      const ratio = state.resources[resourceId] / capacity;
      return { resourceId, ratio };
    })
    .filter((candidate) => candidate.ratio > 0 && candidate.ratio < SCARCITY_THEFT_THRESHOLD)
    .sort((left, right) => left.ratio - right.ratio);

  return candidates[0]?.resourceId ?? null;
}

function getScarcityTheftChance(state: GameState, resourceId: ResourceId): number {
  const capacity = Math.max(1, state.capacities[resourceId]);
  const ratio = Math.max(0, Math.min(SCARCITY_THEFT_THRESHOLD, state.resources[resourceId] / capacity));
  const pressure = 1 - ratio / SCARCITY_THEFT_THRESHOLD;

  return SCARCITY_THEFT_BASE_CHANCE + pressure * SCARCITY_THEFT_PRESSURE_CHANCE;
}

function pickSuddenQuest(state: GameState): SuddenQuestDefinition {
  const candidates = suddenQuestDefinitions.filter(
    (definition) =>
      state.elapsedSeconds >= definition.minElapsedSeconds &&
      !state.quests.recentSuddenIds.includes(definition.id),
  );
  const pool = candidates.length > 0 ? candidates : suddenQuestDefinitions;
  const totalWeight = pool.reduce((total, definition) => total + definition.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const definition of pool) {
    roll -= definition.weight;

    if (roll <= 0) {
      return definition;
    }
  }

  return pool[pool.length - 1];
}

function scheduleNextDecision(state: GameState): void {
  state.quests.nextDecisionAt =
    state.elapsedSeconds +
    NEXT_DECISION_BASE_SECONDS +
    Math.random() * NEXT_DECISION_RANGE_SECONDS;
}

function normalizeActiveDecision(
  activeDecision: QuestState["activeDecision"],
): QuestState["activeDecision"] {
  if (!activeDecision || !(activeDecision.definitionId in decisionQuestById)) {
    return null;
  }

  return {
    id: activeDecision.id || `decision-${Date.now().toString(36)}`,
    definitionId: activeDecision.definitionId,
    startedAt: Math.max(0, activeDecision.startedAt),
    wasPaused: Boolean(activeDecision.wasPaused),
  };
}

function normalizeDecisionHistory(history: DecisionHistoryEntry[]): DecisionHistoryEntry[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((entry): entry is DecisionHistoryEntry => {
      if (!entry || !(entry.definitionId in decisionQuestById)) {
        return false;
      }

      const definition = decisionQuestById[entry.definitionId];
      return definition.options.some((option) => option.id === entry.optionId);
    })
    .map((entry) => ({
      definitionId: entry.definitionId,
      optionId: entry.optionId,
      resolvedAt: Math.max(0, Math.floor(entry.resolvedAt ?? 0)),
    }));
}

function createEmptyDecisionProfileScores(): Record<DecisionProfileAxisId, number> {
  return {
    communityMarket: 0,
    authorityAutonomy: 0,
  };
}

function getDecisionHistoryOption(entry: DecisionHistoryEntry): DecisionQuestOptionDefinition | null {
  return decisionQuestById[entry.definitionId]?.options.find(
    (option) => option.id === entry.optionId,
  ) ?? null;
}

function createObjectiveChainStageIndex(): Map<string, Map<number, ObjectiveQuestDefinition>> {
  const chainMap = new Map<string, Map<number, ObjectiveQuestDefinition>>();

  for (const definition of objectiveQuestDefinitions) {
    if (definition.kind !== "chain") {
      continue;
    }

    if (!chainMap.has(definition.chain.id)) {
      chainMap.set(definition.chain.id, new Map());
    }

    chainMap.get(definition.chain.id)?.set(definition.chain.stage, definition);
  }

  return chainMap;
}

function createEmptyTriggerSnapshot(): QuestState["triggerSnapshot"] {
  return {
    buildingLevels: Object.fromEntries(
      buildingDefinitions.map((definition) => [definition.id, 0]),
    ) as Record<BuildingId, number>,
    population: 0,
    lootedSiteCount: 0,
    resolvedDecisionCount: 0,
    resolvedSuddenCount: 0,
  };
}

function createQuestTriggerSnapshot(state: GameState): QuestState["triggerSnapshot"] {
  return {
    buildingLevels: Object.fromEntries(
      buildingDefinitions.map((definition) => [definition.id, Math.max(0, state.buildings[definition.id]?.level ?? 0)]),
    ) as Record<BuildingId, number>,
    population: getPopulation(state),
    lootedSiteCount: getLootedResourceSiteCount(state),
    resolvedDecisionCount: state.quests.resolvedDecisionCount,
    resolvedSuddenCount: state.quests.resolvedSuddenCount,
  };
}

function syncQuestTriggerSnapshot(state: GameState): void {
  state.quests.triggerSnapshot = createQuestTriggerSnapshot(state);
}

function collectObjectiveTriggerEvents(
  state: GameState,
): Set<ObjectiveTriggerEvent> {
  const events = new Set<ObjectiveTriggerEvent>(["tick"]);
  const previous = state.quests.triggerSnapshot;
  const next = createQuestTriggerSnapshot(state);

  const buildingLevelChanged = Object.keys(next.buildingLevels).some((buildingId) =>
    next.buildingLevels[buildingId as BuildingId] !==
      previous.buildingLevels[buildingId as BuildingId],
  );

  if (buildingLevelChanged) {
    events.add("buildingLevelChanged");
  }

  if (next.population !== previous.population) {
    events.add("populationChanged");
  }

  if (next.lootedSiteCount !== previous.lootedSiteCount) {
    events.add("resourceSitesLootedChanged");
  }

  if (next.resolvedDecisionCount !== previous.resolvedDecisionCount) {
    events.add("decisionResolved");
  }

  if (next.resolvedSuddenCount !== previous.resolvedSuddenCount) {
    events.add("randomEventResolved");
  }

  state.quests.triggerSnapshot = next;
  return events;
}

function getLootedResourceSiteCount(state: GameState): number {
  return state.resourceSites.reduce((total, site) => total + (site.looted ? 1 : 0), 0);
}

function getObjectiveState(
  state: GameState,
  objectiveQuestId: ObjectiveQuestId,
): QuestState["objectives"][number] | null {
  return state.quests.objectives.find((quest) => quest.definitionId === objectiveQuestId) ?? null;
}
