import type { QuestTranslationPack } from "../types";
import { questUiCs } from "../../content/quests/ui/i18n/cs";
import { objectiveLocaleCs as objective_buildStorage_cs } from "../../content/quests/objectives/buildStorage/i18n/cs";
import { objectiveLocaleCs as objective_buildCoalMine_cs } from "../../content/quests/objectives/buildCoalMine/i18n/cs";
import { objectiveLocaleCs as objective_buildWaterStill_cs } from "../../content/quests/objectives/buildWaterStill/i18n/cs";
import { objectiveLocaleCs as objective_buildHydroponics_cs } from "../../content/quests/objectives/buildHydroponics/i18n/cs";
import { objectiveLocaleCs as objective_buildDormitory_cs } from "../../content/quests/objectives/buildDormitory/i18n/cs";
import { decisionLocaleCs as decision_foundingBriefing_cs } from "../../content/quests/decisions/foundingBriefing/i18n/cs";
import { decisionLocaleCs as decision_survivorsAtGate_cs } from "../../content/quests/decisions/survivorsAtGate/i18n/cs";
import { decisionLocaleCs as decision_rationDispute_cs } from "../../content/quests/decisions/rationDispute/i18n/cs";
import { decisionLocaleCs as decision_radioCall_cs } from "../../content/quests/decisions/radioCall/i18n/cs";
import { decisionLocaleCs as decision_bittenStranger_cs } from "../../content/quests/decisions/bittenStranger/i18n/cs";
import { decisionLocaleCs as decision_traderAtDusk_cs } from "../../content/quests/decisions/traderAtDusk/i18n/cs";
import { decisionLocaleCs as decision_nightScreams_cs } from "../../content/quests/decisions/nightScreams/i18n/cs";
import { decisionLocaleCs as decision_waterTheft_cs } from "../../content/quests/decisions/waterTheft/i18n/cs";
import { decisionLocaleCs as decision_coalMineSpareParts_cs } from "../../content/quests/decisions/coalMineSpareParts/i18n/cs";
import { decisionLocaleCs as decision_provenTheft_cs } from "../../content/quests/decisions/provenTheft/i18n/cs";
import { decisionLocaleCs as decision_collapsedUnderpass_cs } from "../../content/quests/decisions/collapsedUnderpass/i18n/cs";
import { decisionLocaleCs as decision_brokenWaterFilter_cs } from "../../content/quests/decisions/brokenWaterFilter/i18n/cs";
import { suddenLocaleCs as sudden_cropSpoilage_cs } from "../../content/quests/sudden/cropSpoilage/i18n/cs";
import { suddenLocaleCs as sudden_scarcityTheft_cs } from "../../content/quests/sudden/scarcityTheft/i18n/cs";

export const questsCs: QuestTranslationPack = {
  ui: questUiCs,
  objectives: {
    buildStorage: objective_buildStorage_cs,
    buildCoalMine: objective_buildCoalMine_cs,
    buildWaterStill: objective_buildWaterStill_cs,
    buildHydroponics: objective_buildHydroponics_cs,
    buildDormitory: objective_buildDormitory_cs,
  },
  decisions: {
    foundingBriefing: decision_foundingBriefing_cs,
    survivorsAtGate: decision_survivorsAtGate_cs,
    rationDispute: decision_rationDispute_cs,
    radioCall: decision_radioCall_cs,
    bittenStranger: decision_bittenStranger_cs,
    traderAtDusk: decision_traderAtDusk_cs,
    nightScreams: decision_nightScreams_cs,
    waterTheft: decision_waterTheft_cs,
    coalMineSpareParts: decision_coalMineSpareParts_cs,
    provenTheft: decision_provenTheft_cs,
    collapsedUnderpass: decision_collapsedUnderpass_cs,
    brokenWaterFilter: decision_brokenWaterFilter_cs,
  },
  sudden: {
    cropSpoilage: sudden_cropSpoilage_cs,
    scarcityTheft: sudden_scarcityTheft_cs,
  },
};
