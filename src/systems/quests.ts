import {
  decisionQuestById,
  decisionQuestDefinitions,
  objectiveQuestById,
  objectiveQuestDefinitions,
  suddenQuestById,
  suddenQuestDefinitions,
  type DecisionQuestOptionDefinition,
  type ObjectiveQuestDefinition,
  type SuddenQuestDefinition,
} from "../data/quests";
import { GAME_HOUR_REAL_SECONDS } from "../game/time";
import type {
  DecisionOptionId,
  DecisionQuestId,
  GameState,
  ResourceBag,
  ResourceId,
  QuestState,
  SuddenQuestId,
} from "../game/types";
import { pushLogEntry } from "./log";
import { addResources, canAfford } from "./resources";

const FIRST_DECISION_DELAY_SECONDS = GAME_HOUR_REAL_SECONDS * 4;
const NEXT_DECISION_BASE_SECONDS = GAME_HOUR_REAL_SECONDS * 7;
const NEXT_DECISION_RANGE_SECONDS = GAME_HOUR_REAL_SECONDS * 7;
const RECENT_DECISION_MEMORY = 2;
const RECENT_SUDDEN_MEMORY = 2;
const SUDDEN_QUEST_CHANCE = 0.35;

export function createInitialQuestState(): QuestState {
  return {
    objectives: objectiveQuestDefinitions.map((definition) => ({
      definitionId: definition.id,
      completedAt: null,
    })),
    activeDecision: null,
    resolvedDecisionCount: 0,
    resolvedSuddenCount: 0,
    nextDecisionAt: FIRST_DECISION_DELAY_SECONDS,
    recentDecisionIds: [],
    recentSuddenIds: [],
  };
}

export function normalizeQuestState(state: GameState): void {
  const existingObjectives = new Map(
    state.quests?.objectives?.map((quest) => [quest.definitionId, quest.completedAt]) ?? [],
  );

  state.quests = {
    objectives: objectiveQuestDefinitions.map((definition) => ({
      definitionId: definition.id,
      completedAt: existingObjectives.get(definition.id) ?? null,
    })),
    activeDecision: normalizeActiveDecision(state.quests?.activeDecision ?? null),
    resolvedDecisionCount: Math.max(0, Math.floor(state.quests?.resolvedDecisionCount ?? 0)),
    resolvedSuddenCount: Math.max(0, Math.floor(state.quests?.resolvedSuddenCount ?? 0)),
    nextDecisionAt: Math.max(
      FIRST_DECISION_DELAY_SECONDS,
      state.quests?.nextDecisionAt ?? FIRST_DECISION_DELAY_SECONDS,
    ),
    recentDecisionIds: (state.quests?.recentDecisionIds ?? [])
      .filter((id): id is DecisionQuestId => id in decisionQuestById)
      .slice(0, RECENT_DECISION_MEMORY),
    recentSuddenIds: (state.quests?.recentSuddenIds ?? [])
      .filter((id): id is SuddenQuestId => id in suddenQuestById)
      .slice(0, RECENT_SUDDEN_MEMORY),
  };
}

export function tickQuests(state: GameState): void {
  completeObjectiveQuests(state);
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

  if (!option) {
    return false;
  }

  if (!canAffordDecisionOption(state, option)) {
    return false;
  }

  if (option.resources) {
    addResources(state.resources, option.resources, state.capacities);
  }

  if (option.morale) {
    addResources(state.resources, { morale: option.morale }, state.capacities);
  }

  state.survivors.workers += option.workers ?? 0;
  state.health.injured += option.injured ?? 0;
  state.quests.activeDecision = null;
  state.quests.resolvedDecisionCount += 1;
  state.quests.recentDecisionIds = [
    definition.id,
    ...state.quests.recentDecisionIds.filter((id) => id !== definition.id),
  ].slice(0, RECENT_DECISION_MEMORY);
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
  return state.buildings[definition.buildingId].level >= definition.requiredLevel;
}

export function getObjectiveQuestProgress(
  state: GameState,
  definition: ObjectiveQuestDefinition,
): { current: number; required: number } {
  return {
    current: Math.min(
      definition.requiredLevel,
      state.buildings[definition.buildingId].level,
    ),
    required: definition.requiredLevel,
  };
}

export function getActiveObjectiveQuests(state: GameState) {
  return state.quests.objectives.filter((quest) => {
    if (quest.completedAt !== null) {
      return false;
    }

    return areObjectivePrerequisitesComplete(
      state,
      objectiveQuestById[quest.definitionId],
    );
  });
}

export function canAffordDecisionOption(
  state: GameState,
  option: DecisionQuestOptionDefinition,
): boolean {
  return canAfford(state.resources, getDecisionOptionCost(option));
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

function completeObjectiveQuests(state: GameState): void {
  for (const quest of state.quests.objectives) {
    if (quest.completedAt !== null) {
      continue;
    }

    const definition = objectiveQuestById[quest.definitionId];

    if (
      !areObjectivePrerequisitesComplete(state, definition) ||
      !isObjectiveQuestComplete(state, definition)
    ) {
      continue;
    }

    quest.completedAt = state.elapsedSeconds;
    addResources(state.resources, definition.reward, state.capacities);
    pushLogEntry(state, {
      source: "questUi",
      key: "logObjectiveCompleted",
      params: { questId: definition.id },
    });
  }
}

function areObjectivePrerequisitesComplete(
  state: GameState,
  definition: ObjectiveQuestDefinition,
): boolean {
  return (definition.prerequisiteIds ?? []).every((prerequisiteId) =>
    state.quests.objectives.some(
      (quest) => quest.definitionId === prerequisiteId && quest.completedAt !== null,
    ),
  );
}

function maybeStartDecisionQuest(state: GameState): void {
  if (state.quests.activeDecision || state.elapsedSeconds < state.quests.nextDecisionAt) {
    return;
  }

  if (Math.random() < SUDDEN_QUEST_CHANCE) {
    applySuddenQuest(state, pickSuddenQuest(state));
    return;
  }

  const definition = pickDecisionQuest(state);

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
  scheduleNextDecision(state);
  pushLogEntry(state, {
    source: "questSuddenResult",
    key: definition.id,
  });
}

function pickDecisionQuest(state: GameState) {
  const candidates = decisionQuestDefinitions.filter(
    (definition) =>
      state.elapsedSeconds >= definition.minElapsedSeconds &&
      !state.quests.recentDecisionIds.includes(definition.id),
  );
  const pool = candidates.length > 0 ? candidates : decisionQuestDefinitions;
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

function pickSuddenQuest(state: GameState) {
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
