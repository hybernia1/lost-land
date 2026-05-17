import type { QuestTranslationPack } from "../types";
import { questUiEn } from "../../content/quests/ui/i18n/en";
import { objectiveLocaleEn as objective_buildStorage_en } from "../../content/quests/objectives/buildStorage/i18n/en";
import { objectiveLocaleEn as objective_buildCoalMine_en } from "../../content/quests/objectives/buildCoalMine/i18n/en";
import { objectiveLocaleEn as objective_buildWaterStill_en } from "../../content/quests/objectives/buildWaterStill/i18n/en";
import { objectiveLocaleEn as objective_buildHydroponics_en } from "../../content/quests/objectives/buildHydroponics/i18n/en";
import { objectiveLocaleEn as objective_buildDormitory_en } from "../../content/quests/objectives/buildDormitory/i18n/en";
import { decisionLocaleEn as decision_foundingBriefing_en } from "../../content/quests/decisions/foundingBriefing/i18n/en";
import { decisionLocaleEn as decision_survivorsAtGate_en } from "../../content/quests/decisions/survivorsAtGate/i18n/en";
import { decisionLocaleEn as decision_rationDispute_en } from "../../content/quests/decisions/rationDispute/i18n/en";
import { decisionLocaleEn as decision_radioCall_en } from "../../content/quests/decisions/radioCall/i18n/en";
import { decisionLocaleEn as decision_bittenStranger_en } from "../../content/quests/decisions/bittenStranger/i18n/en";
import { decisionLocaleEn as decision_traderAtDusk_en } from "../../content/quests/decisions/traderAtDusk/i18n/en";
import { decisionLocaleEn as decision_nightScreams_en } from "../../content/quests/decisions/nightScreams/i18n/en";
import { decisionLocaleEn as decision_waterTheft_en } from "../../content/quests/decisions/waterTheft/i18n/en";
import { decisionLocaleEn as decision_coalMineSpareParts_en } from "../../content/quests/decisions/coalMineSpareParts/i18n/en";
import { decisionLocaleEn as decision_provenTheft_en } from "../../content/quests/decisions/provenTheft/i18n/en";
import { decisionLocaleEn as decision_collapsedUnderpass_en } from "../../content/quests/decisions/collapsedUnderpass/i18n/en";
import { decisionLocaleEn as decision_brokenWaterFilter_en } from "../../content/quests/decisions/brokenWaterFilter/i18n/en";
import { suddenLocaleEn as sudden_cropSpoilage_en } from "../../content/quests/sudden/cropSpoilage/i18n/en";
import { suddenLocaleEn as sudden_scarcityTheft_en } from "../../content/quests/sudden/scarcityTheft/i18n/en";

export const questsEn: QuestTranslationPack = {
  ui: questUiEn,
  objectives: {
    buildStorage: objective_buildStorage_en,
    buildCoalMine: objective_buildCoalMine_en,
    buildWaterStill: objective_buildWaterStill_en,
    buildHydroponics: objective_buildHydroponics_en,
    buildDormitory: objective_buildDormitory_en,
  },
  decisions: {
    foundingBriefing: decision_foundingBriefing_en,
    survivorsAtGate: decision_survivorsAtGate_en,
    rationDispute: decision_rationDispute_en,
    radioCall: decision_radioCall_en,
    bittenStranger: decision_bittenStranger_en,
    traderAtDusk: decision_traderAtDusk_en,
    nightScreams: decision_nightScreams_en,
    waterTheft: decision_waterTheft_en,
    coalMineSpareParts: decision_coalMineSpareParts_en,
    provenTheft: decision_provenTheft_en,
    collapsedUnderpass: decision_collapsedUnderpass_en,
    brokenWaterFilter: decision_brokenWaterFilter_en,
  },
  sudden: {
    cropSpoilage: sudden_cropSpoilage_en,
    scarcityTheft: sudden_scarcityTheft_en,
  },
};
