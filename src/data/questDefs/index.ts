import type { ObjectiveQuestId, SuddenQuestId } from "../../game/types";
import { tutorialObjectiveQuestDefinitions } from "./objectives/tutorialChain";
import { resourcePressureSuddenQuestDefinitions } from "./sudden/resourcePressure";
import type {
  ObjectiveQuestDefinition,
  ObjectiveQuestTarget,
  ObjectiveQuestTrigger,
  SuddenQuestDefinition,
} from "./types";

function assertUniqueIds<T extends { id: string }>(
  definitions: readonly T[],
  scope: string,
): void {
  const seen = new Set<string>();

  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      throw new Error(`Duplicate ${scope} id: "${definition.id}"`);
    }

    seen.add(definition.id);
  }
}

export const objectiveQuestDefinitions: ObjectiveQuestDefinition[] = [
  ...tutorialObjectiveQuestDefinitions,
];

export const suddenQuestDefinitions: SuddenQuestDefinition[] = [
  ...resourcePressureSuddenQuestDefinitions,
];

assertUniqueIds(objectiveQuestDefinitions, "objective quest");
assertUniqueIds(suddenQuestDefinitions, "sudden quest");

export const objectiveQuestById = Object.fromEntries(
  objectiveQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<ObjectiveQuestId, ObjectiveQuestDefinition>;

export const suddenQuestById = Object.fromEntries(
  suddenQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<SuddenQuestId, SuddenQuestDefinition>;

export type {
  ObjectiveQuestDefinition,
  ObjectiveQuestTarget,
  ObjectiveQuestTrigger,
  SuddenQuestDefinition,
};
