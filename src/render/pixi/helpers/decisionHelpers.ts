import { decisionQuestById, type DecisionQuestOptionDefinition } from "../../../data/decisions";
import type { DecisionHistoryEntry, GameState, ResourceId } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getDecisionProfileKind } from "../../../systems/quests";
import { decisionProfileLabelKeyByKind } from "../core/constants";
import type { EffectLine } from "../core/types";

export function formatSignedInteger(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function getDecisionImpactLines(
  option: DecisionQuestOptionDefinition,
  translations: TranslationPack,
): EffectLine[] {
  const impacts: EffectLine[] = [];

  for (const [resourceId, amount] of Object.entries(option.resources ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    const value = amount ?? 0;

    if (value === 0) {
      continue;
    }

    impacts.push({
      iconId: typedResourceId,
      value: formatSignedInteger(value),
      tooltip: `${translations.resources[typedResourceId]} ${formatSignedInteger(value)}`,
      negative: value < 0,
    });
  }

  if (option.workers) {
    impacts.push({
      iconId: "people",
      value: formatSignedInteger(option.workers),
      tooltip: `${translations.ui.workers} ${formatSignedInteger(option.workers)}`,
      negative: option.workers < 0,
    });
  }

  if (option.injured) {
    impacts.push({
      iconId: "crisis-injured",
      value: formatSignedInteger(option.injured),
      tooltip: `${translations.roles.injured} ${formatSignedInteger(option.injured)}`,
      negative: option.injured > 0,
    });
  }

  if (option.morale) {
    impacts.push({
      iconId: "morale",
      value: formatSignedInteger(option.morale),
      tooltip: `${translations.resources.morale} ${formatSignedInteger(option.morale)}`,
      negative: option.morale < 0,
    });
  }

  return impacts;
}

export function getDecisionHistoryOption(entry: DecisionHistoryEntry): DecisionQuestOptionDefinition | null {
  return decisionQuestById[entry.definitionId]?.options.find(
    (option) => option.id === entry.optionId,
  ) ?? null;
}

export function getDecisionProfileOverallLabel(state: GameState, translations: TranslationPack): string {
  const key = decisionProfileLabelKeyByKind[getDecisionProfileKind(state)];
  return translations.ui[key] ?? key;
}
