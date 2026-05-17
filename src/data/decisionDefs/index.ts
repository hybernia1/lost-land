import type { DecisionQuestId } from "../../game/types";
import { communityDecisionQuestDefinitions } from "./community";
import { infrastructureDecisionQuestDefinitions } from "./infrastructure";
import { openingDecisionQuestDefinitions } from "./opening";
import type {
  DecisionQuestDefinition,
  DecisionQuestOptionDefinition,
} from "./types";

function assertUniqueDecisionIds(definitions: readonly DecisionQuestDefinition[]): void {
  const seenDecisionIds = new Set<string>();

  for (const definition of definitions) {
    if (seenDecisionIds.has(definition.id)) {
      throw new Error(`Duplicate decision quest id: "${definition.id}"`);
    }

    seenDecisionIds.add(definition.id);
    const seenOptionIds = new Set<string>();

    for (const option of definition.options) {
      if (seenOptionIds.has(option.id)) {
        throw new Error(
          `Duplicate option id "${option.id}" in decision "${definition.id}"`,
        );
      }

      seenOptionIds.add(option.id);
    }
  }
}

export const decisionQuestDefinitions: DecisionQuestDefinition[] = [
  ...openingDecisionQuestDefinitions,
  ...communityDecisionQuestDefinitions,
  ...infrastructureDecisionQuestDefinitions,
];

assertUniqueDecisionIds(decisionQuestDefinitions);

export const decisionQuestById = Object.fromEntries(
  decisionQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<DecisionQuestId, DecisionQuestDefinition>;

export type { DecisionQuestDefinition, DecisionQuestOptionDefinition };
