import { buildingById } from "../../../data/buildings";
import { GAME_HOUR_REAL_SECONDS } from "../../../game/time";
import type { BuildingId, GameState, ResourceBag, ResourceId } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import {
  getAcademyBuildTimeMultiplier,
  getAcademyExpeditionDeathRiskMultiplier,
  getAcademyProductionBonus,
} from "../../../systems/academy";
import {
  getCoalMineCoalRate,
  getMainBuildingMoraleRate,
  getMainBuildingProductionBonus,
  getSurvivorAttractionOnCompletedLevel,
  getWorkshopMaterialRate,
} from "../../../systems/buildings";
import {
  getClinicFoodPerTreatment,
  getClinicTreatmentRatePerGameHour,
  getClinicWaterPerTreatment,
} from "../../../systems/health";
import {
  getMarketTradeCooldownSeconds,
  getMarketTradeLimit,
  getMarketTradeSlots,
} from "../../../systems/market";
import { getBarracksTrainingRatePerGameHour } from "../../../systems/survivors";
import type { CostLinePart, EffectLine } from "../core/types";
import { formatPercentBonus, formatRate } from "./formatters";

export function getCostLineParts(
  bag: ResourceBag,
  availableResources: GameState["resources"],
  translations: TranslationPack,
): CostLinePart[] {
  return Object.entries(bag)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([resourceId, amount]) => {
      const typedResourceId = resourceId as ResourceId;
      const required = Math.ceil(amount ?? 0);
      const available = availableResources[typedResourceId] ?? required;
      return {
        text: `${required}`,
        iconId: typedResourceId,
        missing: available < required,
        tooltip: `${translations.resources[typedResourceId]}: ${translations.resourceDescriptions[typedResourceId]} (${Math.floor(available)}/${required})`,
      };
    });
}

export function getNextLevelEffects(
  buildingId: BuildingId,
  currentLevel: number,
  translations: TranslationPack,
): EffectLine[] {
  const definition = buildingById[buildingId];

  if (!definition || currentLevel >= definition.maxLevel) {
    return [];
  }

  const effects: EffectLine[] = [];

  if (buildingId === "mainBuilding") {
    const nextBonus = getMainBuildingProductionBonus(currentLevel + 1);
    if (nextBonus > 0) {
      effects.push({
        iconId: "build",
        value: formatPercentBonus(nextBonus),
        tooltip: `${translations.ui.production}: ${formatPercentBonus(nextBonus)}`,
      });
    }

    const currentMoralePerHour = getMainBuildingMoraleRate(currentLevel) * GAME_HOUR_REAL_SECONDS;
    const nextMoralePerHour = getMainBuildingMoraleRate(currentLevel + 1) * GAME_HOUR_REAL_SECONDS;
    const moraleDelta = nextMoralePerHour - currentMoralePerHour;

    if (moraleDelta > 0) {
      effects.push({
        iconId: "morale",
        value: `+${formatRate(moraleDelta)}/h`,
        tooltip: `${translations.resources.morale} +${formatRate(moraleDelta)}/h`,
      });
    }
  }

  const attractedSurvivors = getSurvivorAttractionOnCompletedLevel(buildingId, currentLevel + 1);
  if (attractedSurvivors > 0) {
    effects.push({
      iconId: "people",
      value: `+${attractedSurvivors}`,
      tooltip: `${translations.ui.population} +${attractedSurvivors}`,
    });
  }

  if (buildingId === "clinic") {
    const treatmentPerHour = getClinicTreatmentRatePerGameHour(currentLevel + 1);
    const foodPerHour = treatmentPerHour * getClinicFoodPerTreatment(currentLevel + 1);
    const waterPerHour = treatmentPerHour * getClinicWaterPerTreatment(currentLevel + 1);
    effects.push({
      iconId: "people",
      value: `+${formatRate(treatmentPerHour)}/h`,
      tooltip: `${translations.ui.treatment} +${formatRate(treatmentPerHour)}/h (${translations.resources.food} -${formatRate(foodPerHour)}/h, ${translations.resources.water} -${formatRate(waterPerHour)}/h)`,
    });
  }

  if (buildingId === "dormitory") {
    const housing = definition.housing ?? 0;
    effects.push({
      iconId: "home",
      value: `+${housing}`,
      tooltip: `${translations.ui.housingCapacity} +${housing}`,
    });
  }

  if (buildingId === "barracks") {
    const currentRate = getBarracksTrainingRatePerGameHour(currentLevel);
    const nextRate = getBarracksTrainingRatePerGameHour(currentLevel + 1);
    const rateDelta = nextRate - currentRate;

    if (rateDelta > 0) {
      effects.push({
        iconId: "scout",
        value: `+${formatRate(rateDelta)}/h`,
        tooltip: `${translations.ui.troopTraining ?? "Troop training"} +${formatRate(rateDelta)}/h`,
      });
    }
  }

  if (buildingId === "academy") {
    const currentBonus = getAcademyProductionBonus(currentLevel);
    const nextBonus = getAcademyProductionBonus(currentLevel + 1);
    if (nextBonus > currentBonus) {
      effects.push({
        iconId: "build",
        value: formatPercentBonus(nextBonus - currentBonus),
        tooltip: `${translations.ui.production}: ${formatPercentBonus(nextBonus - currentBonus)}`,
      });
    }

    const currentRiskMultiplier = getAcademyExpeditionDeathRiskMultiplier(currentLevel);
    const nextRiskMultiplier = getAcademyExpeditionDeathRiskMultiplier(currentLevel + 1);
    if (nextRiskMultiplier < currentRiskMultiplier) {
      effects.push({
        iconId: "shield",
        value: `-${formatRate((currentRiskMultiplier - nextRiskMultiplier) * 100)}%`,
        tooltip: `${translations.ui.resourceSiteSendTroops ?? "Expeditions"}: -${formatRate((currentRiskMultiplier - nextRiskMultiplier) * 100)}% risk`,
      });
    }

    const currentBuildMultiplier = getAcademyBuildTimeMultiplier(currentLevel);
    const nextBuildMultiplier = getAcademyBuildTimeMultiplier(currentLevel + 1);
    if (nextBuildMultiplier < currentBuildMultiplier) {
      effects.push({
        iconId: "clock",
        value: `-${formatRate((currentBuildMultiplier - nextBuildMultiplier) * 100)}%`,
        tooltip: `${translations.ui.buildTime ?? "Build time"}: -${formatRate((currentBuildMultiplier - nextBuildMultiplier) * 100)}%`,
      });
    }
  }

  if (buildingId === "generator") {
    const currentLimit = currentLevel <= 0 ? 0 : Math.min(4, currentLevel + 1);
    const nextLimit = Math.min(4, currentLevel + 2);
    const currentMaxRate = getCoalMineCoalRate(currentLevel, currentLimit) * GAME_HOUR_REAL_SECONDS;
    const nextMaxRate = getCoalMineCoalRate(currentLevel + 1, nextLimit) * GAME_HOUR_REAL_SECONDS;
    if (nextLimit > currentLimit) {
      effects.push({
        iconId: "people",
        value: `+${nextLimit - currentLimit}`,
        tooltip: `${translations.ui.workers} max +${nextLimit - currentLimit}`,
      });
    }
    effects.push({
      iconId: "coal",
      value: `+${formatRate(nextMaxRate - currentMaxRate)}/h`,
      tooltip: `${translations.resources.coal} max +${formatRate(nextMaxRate - currentMaxRate)}/h`,
    });
  }

  if (buildingId === "workshop") {
    const currentLimit = currentLevel <= 0 ? 0 : Math.min(4, currentLevel + 1);
    const nextLimit = Math.min(4, currentLevel + 2);
    const currentMaxRate = getWorkshopMaterialRate(currentLevel, currentLimit) * GAME_HOUR_REAL_SECONDS;
    const nextMaxRate = getWorkshopMaterialRate(currentLevel + 1, nextLimit) * GAME_HOUR_REAL_SECONDS;
    if (nextLimit > currentLimit) {
      effects.push({
        iconId: "people",
        value: `+${nextLimit - currentLimit}`,
        tooltip: `${translations.ui.workers} max +${nextLimit - currentLimit}`,
      });
    }
    effects.push({
      iconId: "material",
      value: `+${formatRate(nextMaxRate - currentMaxRate)}/h`,
      tooltip: `${translations.resources.material} max +${formatRate(nextMaxRate - currentMaxRate)}/h`,
    });
  }

  if (buildingId === "market") {
    const currentTradeLimit = getMarketTradeLimit(currentLevel);
    const nextTradeLimit = getMarketTradeLimit(currentLevel + 1);
    const currentTradeSlots = getMarketTradeSlots(currentLevel);
    const nextTradeSlots = getMarketTradeSlots(currentLevel + 1);
    const currentCooldownHours = getMarketTradeCooldownSeconds(currentLevel) / GAME_HOUR_REAL_SECONDS;
    const nextCooldownHours = getMarketTradeCooldownSeconds(currentLevel + 1) / GAME_HOUR_REAL_SECONDS;

    if (nextTradeLimit > currentTradeLimit) {
      effects.push({
        iconId: "material",
        value: `+${nextTradeLimit - currentTradeLimit}`,
        tooltip: `${translations.ui.marketTradeLimit ?? "Trade limit"} +${nextTradeLimit - currentTradeLimit}`,
      });
    }

    if (nextTradeSlots > currentTradeSlots) {
      effects.push({
        iconId: "build",
        value: `+${nextTradeSlots - currentTradeSlots}`,
        tooltip: `${translations.ui.marketTrades ?? "Trades"} +${nextTradeSlots - currentTradeSlots}`,
      });
    }

    if (nextCooldownHours < currentCooldownHours) {
      effects.push({
        iconId: "clock",
        value: `-${formatRate(currentCooldownHours - nextCooldownHours)}h`,
        tooltip: `${translations.ui.marketCooldown ?? "Cooldown"} -${formatRate(currentCooldownHours - nextCooldownHours)}h`,
      });
    }
  }

  if (definition.defense) {
    effects.push({
      iconId: "shield",
      value: `+${definition.defense}`,
      tooltip: `${translations.ui.defense} +${definition.defense}`,
    });
  }

  for (const [resourceId, amount] of Object.entries(definition.produces ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    effects.push({
      iconId: typedResourceId,
      value: `+${formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
      tooltip: `${translations.resources[typedResourceId]} +${formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
    });
  }

  for (const [resourceId, amount] of Object.entries(definition.consumes ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    effects.push({
      iconId: typedResourceId,
      value: `-${formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
      tooltip: `${translations.resources[typedResourceId]} -${formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
      negative: true,
    });
  }

  for (const [resourceId, amount] of Object.entries(definition.alwaysConsumes ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    effects.push({
      iconId: typedResourceId,
      value: `-${formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
      tooltip: `${translations.resources[typedResourceId]} -${formatRate((amount ?? 0) * GAME_HOUR_REAL_SECONDS)}/h`,
      negative: true,
    });
  }

  for (const [resourceId, amount] of Object.entries(definition.storageBonus ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    effects.push({
      iconId: typedResourceId,
      value: `+${Math.round(amount ?? 0)}`,
      tooltip: `${translations.resources[typedResourceId]} cap +${Math.round(amount ?? 0)}`,
    });
  }

  return effects;
}

export function getCurrentBuildingEffects(
  buildingId: BuildingId,
  level: number,
  translations: TranslationPack,
): EffectLine[] {
  const definition = buildingById[buildingId];

  if (!definition || level <= 0) {
    return [];
  }

  const effects: EffectLine[] = [];

  if (buildingId === "mainBuilding") {
    const bonus = getMainBuildingProductionBonus(level);
    if (bonus > 0) {
      effects.push({
        iconId: "build",
        value: formatPercentBonus(bonus),
        tooltip: `${translations.ui.production}: ${formatPercentBonus(bonus)}`,
      });
    }

    const moralePerHour = getMainBuildingMoraleRate(level) * GAME_HOUR_REAL_SECONDS;
    if (moralePerHour > 0) {
      effects.push({
        iconId: "morale",
        value: `+${formatRate(moralePerHour)}/h`,
        tooltip: `${translations.resources.morale} +${formatRate(moralePerHour)}/h`,
      });
    }
  }

  if (buildingId === "clinic") {
    const treatmentPerHour = getClinicTreatmentRatePerGameHour(level);
    const foodPerHour = treatmentPerHour * getClinicFoodPerTreatment(level);
    const waterPerHour = treatmentPerHour * getClinicWaterPerTreatment(level);
    effects.push({
      iconId: "people",
      value: `+${formatRate(treatmentPerHour)}/h`,
      tooltip: `${translations.ui.treatment} +${formatRate(treatmentPerHour)}/h (${translations.resources.food} -${formatRate(foodPerHour)}/h, ${translations.resources.water} -${formatRate(waterPerHour)}/h)`,
    });
  }

  if (buildingId === "dormitory" && definition.housing) {
    effects.push({
      iconId: "home",
      value: `+${definition.housing * level}`,
      tooltip: `${translations.ui.housingCapacity} +${definition.housing * level}`,
    });
  }

  if (buildingId === "barracks") {
    const trainingRate = getBarracksTrainingRatePerGameHour(level);
    effects.push({
      iconId: "scout",
      value: `+${formatRate(trainingRate)}/h`,
      tooltip: `${translations.ui.troopTraining ?? "Troop training"} +${formatRate(trainingRate)}/h`,
    });
  }

  if (buildingId === "academy") {
    const productionBonus = getAcademyProductionBonus(level);
    if (productionBonus > 0) {
      effects.push({
        iconId: "build",
        value: formatPercentBonus(productionBonus),
        tooltip: `${translations.ui.production}: ${formatPercentBonus(productionBonus)}`,
      });
    }

    const expeditionRiskReduction = (1 - getAcademyExpeditionDeathRiskMultiplier(level)) * 100;
    if (expeditionRiskReduction > 0) {
      effects.push({
        iconId: "shield",
        value: `-${formatRate(expeditionRiskReduction)}%`,
        tooltip: `${translations.ui.resourceSiteSendTroops ?? "Expeditions"}: -${formatRate(expeditionRiskReduction)}% risk`,
      });
    }

    const buildTimeReduction = (1 - getAcademyBuildTimeMultiplier(level)) * 100;
    if (buildTimeReduction > 0) {
      effects.push({
        iconId: "clock",
        value: `-${formatRate(buildTimeReduction)}%`,
        tooltip: `${translations.ui.buildTime ?? "Build time"}: -${formatRate(buildTimeReduction)}%`,
      });
    }
  }

  if (buildingId === "market") {
    effects.push({
      iconId: "material",
      value: `${getMarketTradeLimit(level)}`,
      tooltip: `${translations.ui.marketTradeLimit ?? "Trade limit"} ${getMarketTradeLimit(level)}`,
    });

    effects.push({
      iconId: "clock",
      value: `${formatRate(getMarketTradeCooldownSeconds(level) / GAME_HOUR_REAL_SECONDS)}h`,
      tooltip: `${translations.ui.marketCooldown ?? "Cooldown"} ${formatRate(getMarketTradeCooldownSeconds(level) / GAME_HOUR_REAL_SECONDS)}h`,
    });

    if (getMarketTradeSlots(level) > 1) {
      effects.push({
        iconId: "build",
        value: `${getMarketTradeSlots(level)}x`,
        tooltip: `${translations.ui.marketTrades ?? "Trades"} ${getMarketTradeSlots(level)}`,
      });
    }
  }

  if (definition.defense) {
    effects.push({
      iconId: "shield",
      value: `+${definition.defense * level}`,
      tooltip: `${translations.ui.defense} +${definition.defense * level}`,
    });
  }

  for (const [resourceId, amount] of Object.entries(definition.produces ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    effects.push({
      iconId: typedResourceId,
      value: `+${formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
      tooltip: `${translations.resources[typedResourceId]} +${formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
    });
  }

  for (const [resourceId, amount] of Object.entries(definition.consumes ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    effects.push({
      iconId: typedResourceId,
      value: `-${formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
      tooltip: `${translations.resources[typedResourceId]} -${formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
      negative: true,
    });
  }

  for (const [resourceId, amount] of Object.entries(definition.alwaysConsumes ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    effects.push({
      iconId: typedResourceId,
      value: `-${formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
      tooltip: `${translations.resources[typedResourceId]} -${formatRate((amount ?? 0) * level * GAME_HOUR_REAL_SECONDS)}/h`,
      negative: true,
    });
  }

  for (const [resourceId, amount] of Object.entries(definition.storageBonus ?? {})) {
    const typedResourceId = resourceId as ResourceId;
    effects.push({
      iconId: typedResourceId,
      value: `+${Math.round((amount ?? 0) * level)}`,
      tooltip: `${translations.resources[typedResourceId]} cap +${Math.round((amount ?? 0) * level)}`,
    });
  }

  return effects;
}
