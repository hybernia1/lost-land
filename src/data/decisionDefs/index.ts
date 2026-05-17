import type { DecisionQuestId } from "../../game/types";
import { communityDecisionQuestDefinitions } from "./community";
import { infrastructureDecisionQuestDefinitions } from "./infrastructure";
import { openingDecisionQuestDefinitions } from "./opening";
import type {
  DecisionQuestDraftDefinition,
  DecisionQuestDefinition,
  DecisionQuestOptionDefinition,
} from "./types";

function assertUniqueDecisionIds(definitions: readonly DecisionQuestDraftDefinition[]): void {
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

const decisionQuestDraftDefinitions: DecisionQuestDraftDefinition[] = [
  ...openingDecisionQuestDefinitions,
  ...communityDecisionQuestDefinitions,
  ...infrastructureDecisionQuestDefinitions,
];

assertUniqueDecisionIds(decisionQuestDraftDefinitions);

export const decisionQuestDefinitions: DecisionQuestDefinition[] = decisionQuestDraftDefinitions.map(
  (definition) => ({
    ...definition,
    kind: "decision",
  }),
);

export const decisionQuestById = Object.fromEntries(
  decisionQuestDefinitions.map((quest) => [quest.id, quest]),
) as Record<DecisionQuestId, DecisionQuestDefinition>;

export type { DecisionQuestDefinition, DecisionQuestOptionDefinition };
