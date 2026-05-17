import type { QuestTranslationPack } from "../types";
import { questUiCs } from "../../content/quests/ui/i18n/cs";
import { objectiveLocaleCs as objective_buildStorage_cs } from "../../content/quests/objectives/buildStorage/i18n/cs";
import { objectiveLocaleCs as objective_buildCoalMine_cs } from "../../content/quests/objectives/buildCoalMine/i18n/cs";
import { objectiveLocaleCs as objective_buildWaterStill_cs } from "../../content/quests/objectives/buildWaterStill/i18n/cs";
import { objectiveLocaleCs as objective_buildHydroponics_cs } from "../../content/quests/objectives/buildHydroponics/i18n/cs";
import { objectiveLocaleCs as objective_buildDormitory_cs } from "../../content/quests/objectives/buildDormitory/i18n/cs";
import { objectiveChainLocaleCs as objectiveChain_upgradeStorageChain_cs } from "../../content/quests/objectives/upgradeStorageChain/i18n/cs";
import { objectiveChainLocaleCs as objectiveChain_upgradeCoalMineChain_cs } from "../../content/quests/objectives/upgradeCoalMineChain/i18n/cs";
import { objectiveChainLocaleCs as objectiveChain_upgradeHydroponicsChain_cs } from "../../content/quests/objectives/upgradeHydroponicsChain/i18n/cs";
import { objectiveChainLocaleCs as objectiveChain_reachPopulationChain_cs } from "../../content/quests/objectives/reachPopulationChain/i18n/cs";
import { objectiveChainLocaleCs as objectiveChain_lootSettlementChain_cs } from "../../content/quests/objectives/lootSettlementChain/i18n/cs";
import { decisionLocaleCs as decision_foundingBriefing_cs } from "../../content/quests/decisions/foundingBriefing/i18n/cs";
import { decisionLocaleCs as decision_survivorsAtGate_cs } from "../../content/quests/decisions/survivorsAtGate/i18n/cs";
import { decisionLocaleCs as decision_rationDispute_cs } from "../../content/quests/decisions/rationDispute/i18n/cs";
import { decisionLocaleCs as decision_bittenStranger_cs } from "../../content/quests/decisions/bittenStranger/i18n/cs";
import { decisionLocaleCs as decision_nightScreams_cs } from "../../content/quests/decisions/nightScreams/i18n/cs";
import { decisionLocaleCs as decision_waterTheft_cs } from "../../content/quests/decisions/waterTheft/i18n/cs";
import { decisionLocaleCs as decision_provenTheft_cs } from "../../content/quests/decisions/provenTheft/i18n/cs";
import { decisionLocaleCs as decision_radioCall_cs } from "../../content/quests/decisions/radioCall/i18n/cs";
import { decisionLocaleCs as decision_traderAtDusk_cs } from "../../content/quests/decisions/traderAtDusk/i18n/cs";
import { decisionLocaleCs as decision_coalMineSpareParts_cs } from "../../content/quests/decisions/coalMineSpareParts/i18n/cs";
import { decisionLocaleCs as decision_collapsedUnderpass_cs } from "../../content/quests/decisions/collapsedUnderpass/i18n/cs";
import { decisionLocaleCs as decision_brokenWaterFilter_cs } from "../../content/quests/decisions/brokenWaterFilter/i18n/cs";
import { suddenLocaleCs as sudden_cropSpoilage_cs } from "../../content/quests/sudden/cropSpoilage/i18n/cs";

export const questsCs: QuestTranslationPack = {
  ui: questUiCs,
  objectives: {
    buildStorage: objective_buildStorage_cs,
    buildCoalMine: objective_buildCoalMine_cs,
    buildWaterStill: objective_buildWaterStill_cs,
    buildHydroponics: objective_buildHydroponics_cs,
    buildDormitory: objective_buildDormitory_cs,
    upgradeStorageLevel2: objectiveChain_upgradeStorageChain_cs.upgradeStorageLevel2,
    upgradeStorageLevel3: objectiveChain_upgradeStorageChain_cs.upgradeStorageLevel3,
    upgradeCoalMineLevel2: objectiveChain_upgradeCoalMineChain_cs.upgradeCoalMineLevel2,
    upgradeCoalMineLevel3: objectiveChain_upgradeCoalMineChain_cs.upgradeCoalMineLevel3,
    upgradeHydroponicsLevel2: objectiveChain_upgradeHydroponicsChain_cs.upgradeHydroponicsLevel2,
    upgradeHydroponicsLevel3: objectiveChain_upgradeHydroponicsChain_cs.upgradeHydroponicsLevel3,
    reachPopulationChain06: objectiveChain_reachPopulationChain_cs.reachPopulationChain06,
    reachPopulationChain10: objectiveChain_reachPopulationChain_cs.reachPopulationChain10,
    reachPopulationChain14: objectiveChain_reachPopulationChain_cs.reachPopulationChain14,
    lootSettlementChain01: objectiveChain_lootSettlementChain_cs.lootSettlementChain01,
    lootSettlementChain02: objectiveChain_lootSettlementChain_cs.lootSettlementChain02,
    lootSettlementChain05: objectiveChain_lootSettlementChain_cs.lootSettlementChain05,
  },
  decisions: {
    foundingBriefing: decision_foundingBriefing_cs,
    survivorsAtGate: decision_survivorsAtGate_cs,
    rationDispute: decision_rationDispute_cs,
    bittenStranger: decision_bittenStranger_cs,
    nightScreams: decision_nightScreams_cs,
    waterTheft: decision_waterTheft_cs,
    provenTheft: decision_provenTheft_cs,
    radioCall: decision_radioCall_cs,
    traderAtDusk: decision_traderAtDusk_cs,
    coalMineSpareParts: decision_coalMineSpareParts_cs,
    collapsedUnderpass: decision_collapsedUnderpass_cs,
    brokenWaterFilter: decision_brokenWaterFilter_cs,
  },
  sudden: {
    cropSpoilage: sudden_cropSpoilage_cs,
  },
};
