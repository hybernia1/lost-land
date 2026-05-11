import { Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { buildingById } from "../../../data/buildings";
import { GAME_HOUR_REAL_SECONDS } from "../../../game/time";
import type { BuildingCategory, BuildingId, GameState, MarketResourceId, ResourceBag, ResourceId } from "../../../game/types";
import type { TranslationPack } from "../../../i18n/types";
import { getAcademyProductionBonus } from "../../../systems/academy";
import {
  getBuildingBuildSeconds,
  getBuildingWorkerLimit,
  getCoalMineCoalRate,
  getConstructionWorkerRequirement,
  getGlobalProductionMultiplier,
  getMainBuildingLevelRequirement,
  getMainBuildingProductionBonus,
  getUpgradeCost,
  getWorkshopCoalRate,
  getWorkshopMaterialRate,
  hasAvailableBuildingSlot,
  isMainBuildingRequirementMet,
} from "../../../systems/buildings";
import {
  canTradeAtMarket,
  getAvailableMarketTrades,
  getMarketTradeCapacity,
  getMarketTradeLimit,
  getMarketTradeSlots,
  isMarketResourceId,
  marketResourceIds,
} from "../../../systems/market";
import { canAfford } from "../../../systems/resources";
import { getBarracksTrainingRatePerGameHour } from "../../../systems/survivors";
import { buildCategoryOrder, BUILDING_PREVIEW_RENDER_SCALE } from "../core/constants";
import type {
  Bounds,
  BuildingMetric,
  DrawCenteredTextFn,
  DrawIconFn,
  DrawPanelFn,
  DrawTextFn,
  EffectLine,
  PixiActionDetail,
  RectButtonOptions,
  TabItem,
  TabOptions,
} from "../core/types";
import { getCostLineParts, getCurrentBuildingEffects, getNextLevelEffects } from "../helpers/buildingEffects";
import { formatPercentBonus, formatRate, formatScoutingRemaining, formatTemplate, getHourlyRateLabel, getRateColor } from "../helpers/formatters";

type BuildingModalsHost = {
  requestRender: () => void;
  playTabSwitchSound: () => void;
  drawText: DrawTextFn;
  drawCenteredText: DrawCenteredTextFn;
  drawIcon: DrawIconFn;
  drawPanel: DrawPanelFn;
  drawTabs: <T extends string>(parent: Container, tabs: Array<TabItem<T>>, options: TabOptions<T>) => void;
  bindTooltip: (target: Container, text: string) => void;
  createRectButton: (parent: Container, options: RectButtonOptions) => Container;
  createModalButton: (
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    detail: PixiActionDetail,
    disabled?: boolean,
    tooltip?: string,
  ) => Container;
  createLocalModalButton: (
    parent: Container,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    onTap: () => void,
    disabled?: boolean,
  ) => Container;
  createBuildingSprite: (buildingId: BuildingId, level: number, built: boolean) => Sprite;
  fitSprite: (sprite: Sprite, maxWidth: number, maxHeight: number) => void;

  getBuildChoicesScrollPlotId: () => string | null;
  setBuildChoicesScrollPlotId: (value: string | null) => void;
  getBuildChoicesScrollY: () => number;
  setBuildChoicesScrollY: (value: number) => void;
  setBuildChoicesScrollMax: (value: number) => void;
  setBuildChoicesScrollArea: (value: Bounds | null) => void;
  getActiveBuildCategory: () => BuildingCategory;
  setActiveBuildCategory: (value: BuildingCategory) => void;

  getMarketFromResource: () => MarketResourceId;
  setMarketFromResource: (value: MarketResourceId) => void;
  getMarketToResource: () => MarketResourceId;
  setMarketToResource: (value: MarketResourceId) => void;
  getMarketAmount: () => number;
  setMarketAmount: (value: number) => void;
  getBarracksTroopCount: () => number;
  setBarracksTroopCount: (value: number) => void;
};

export function drawBuildChoices(
  host: BuildingModalsHost,
  parent: Container,
  plotId: string,
  buildableBuildings: BuildingId[],
  state: GameState,
  translations: TranslationPack,
  modalWidth: number,
  modalHeight: number,
): void {
  if (buildableBuildings.length === 0) {
    host.drawText(parent, translations.ui.alreadyBuilt, 24, 96, { fill: 0xaeb4b8, fontSize: 13 });
    return;
  }

  if (host.getBuildChoicesScrollPlotId() !== plotId) {
    host.setBuildChoicesScrollPlotId(plotId);
    host.setBuildChoicesScrollY(0);
  }

  const availableCategories = buildCategoryOrder.filter((category) =>
    buildableBuildings.some((buildingId) => buildingById[buildingId].category === category),
  );
  const activeCategory = (availableCategories.includes(host.getActiveBuildCategory())
    ? host.getActiveBuildCategory()
    : availableCategories[0]) ?? "resource";
  host.setActiveBuildCategory(activeCategory);

  const filteredBuildings = buildableBuildings.filter(
    (buildingId) => buildingById[buildingId].category === activeCategory,
  );
  const gap = 8;
  const listX = 24;
  const tabY = 88;
  const listY = tabY + 48;
  const availableHeight = modalHeight - listY - 24;
  const rowHeight = modalHeight < 620 ? 96 : 104;
  const contentHeight = filteredBuildings.length * rowHeight + gap * Math.max(0, filteredBuildings.length - 1);
  const maxScroll = Math.max(0, contentHeight - availableHeight);
  const needsScroll = maxScroll > 1;
  const scrollbarGutter = needsScroll ? 22 : 0;
  const rowWidth = modalWidth - 48 - scrollbarGutter;
  const scrollY = Math.max(0, Math.min(maxScroll, host.getBuildChoicesScrollY()));

  drawBuildCategoryTabs(
    host,
    parent,
    availableCategories,
    activeCategory,
    translations,
    listX,
    tabY,
    modalWidth - 48,
  );

  host.setBuildChoicesScrollY(scrollY);
  host.setBuildChoicesScrollMax(maxScroll);
  host.setBuildChoicesScrollArea({
    x: parent.x + listX,
    y: parent.y + listY,
    width: rowWidth + scrollbarGutter,
    height: availableHeight,
  });

  const listContent = new Container();
  listContent.x = listX;
  listContent.y = listY - scrollY;
  parent.addChild(listContent);

  const listMask = new Graphics();
  listMask.eventMode = "none";
  listMask.rect(listX, listY, rowWidth, availableHeight).fill({ color: 0xffffff, alpha: 1 });
  parent.addChild(listMask);
  listContent.mask = listMask;

  filteredBuildings.forEach((buildingId, index) => {
    const translated = translations.buildings[buildingId];
    const cost = getUpgradeCost(buildingId, 0);
    const affordable = canAfford(state.resources, cost);
    const queueAvailable = hasAvailableBuildingSlot(state);
    const requiredWorkers = getConstructionWorkerRequirement(buildingId, 0);
    const workersAvailable = state.survivors.workers >= requiredWorkers;
    const mainBuildingUnlocked = isMainBuildingRequirementMet(state, buildingId, 1);
    const requiredMainBuildingLevel = getMainBuildingLevelRequirement(buildingId, 1);
    const disabled = !mainBuildingUnlocked || !affordable || !queueAvailable || !workersAvailable;
    const disabledTooltip = disabled
      ? getBuildActionDisabledTooltip(
        translations,
        cost,
        state.resources,
        requiredWorkers,
        state.survivors.workers,
        queueAvailable,
        mainBuildingUnlocked,
        requiredMainBuildingLevel,
      )
      : undefined;

    drawBuildRow(host, listContent, {
      x: 0,
      y: index * (rowHeight + gap),
      width: rowWidth,
      height: rowHeight,
      buildingId,
      level: 1,
      built: true,
      title: translated.name,
      description: translated.description,
      cost,
      requiredWorkers,
      buttonLabel: translations.ui.buildHere,
      disabled,
      disabledTooltip,
      action: { action: "build", building: buildingId, plot: plotId },
      state,
      translations,
      effects: getNextLevelEffects(buildingId, 0, translations),
    });
  });

  if (needsScroll) {
    drawBuildChoicesScrollbar(
      parent,
      listX + rowWidth + 9,
      listY,
      10,
      availableHeight,
      scrollY,
      maxScroll,
      contentHeight,
    );
  }
}

function drawBuildCategoryTabs(
  host: BuildingModalsHost,
  parent: Container,
  categories: BuildingCategory[],
  activeCategory: BuildingCategory,
  translations: TranslationPack,
  x: number,
  y: number,
  maxWidth: number,
): void {
  host.drawTabs(
    parent,
    categories.map((category) => ({
      id: category,
      label: getBuildCategoryLabel(category, translations),
    })),
    {
      activeId: activeCategory,
      x,
      y,
      height: 34,
      minWidth: 96,
      maxTabWidth: 148,
      maxWidth,
      onSelect: (category) => {
        host.setActiveBuildCategory(category);
        host.setBuildChoicesScrollY(0);
        host.requestRender();
      },
    },
  );
}

function getBuildCategoryLabel(category: BuildingCategory, translations: TranslationPack): string {
  if (category === "resource") {
    return translations.ui.buildingCategoryResource;
  }
  if (category === "housing") {
    return translations.ui.buildingCategoryHousing;
  }
  if (category === "defense") {
    return translations.ui.buildingCategoryDefense;
  }
  return translations.ui.buildingCategorySupport;
}

function drawBuildChoicesScrollbar(
  parent: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  scrollY: number,
  maxScroll: number,
  contentHeight: number,
): void {
  const track = new Graphics();
  track.rect(x, y, width, height)
    .fill({ color: 0x070807, alpha: 0.52 });
  parent.addChild(track);

  const thumbHeight = Math.max(46, (height / contentHeight) * height);
  const thumbTravel = Math.max(0, height - thumbHeight - 4);
  const thumbY = y + 2 + (maxScroll > 0 ? (scrollY / maxScroll) * thumbTravel : 0);
  const thumb = new Graphics();
  thumb.rect(x + 2, thumbY, width - 4, thumbHeight)
    .fill({ color: 0xe0c46f, alpha: 0.86 });
  parent.addChild(thumb);
}

function drawBuildRow(
  host: BuildingModalsHost,
  parent: Container,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    buildingId: BuildingId;
    level: number;
    built: boolean;
    title: string;
    description: string;
    cost: ResourceBag;
    requiredWorkers: number;
    buttonLabel: string;
    disabled: boolean;
    disabledTooltip?: string;
    action: PixiActionDetail;
    state: GameState;
    translations: TranslationPack;
    effects: EffectLine[];
  },
): void {
  const row = new Container();
  row.x = options.x;
  row.y = options.y;
  parent.addChild(row);
  host.drawPanel(row, 0, 0, options.width, options.height);

  const asset = host.createBuildingSprite(options.buildingId, options.level, options.built);
  asset.anchor.set(0.5);
  asset.x = 72;
  asset.y = options.height / 2;
  host.fitSprite(
    asset,
    Math.min(104 * BUILDING_PREVIEW_RENDER_SCALE, options.height * 1.42),
    Math.min(78 * BUILDING_PREVIEW_RENDER_SCALE, options.height * 0.96),
  );
  row.addChild(asset);

  const textX = 150;
  const buttonWidth = 124;
  const buttonHeight = 34;
  const buttonX = options.width - buttonWidth - 28;
  const textWidth = Math.max(220, buttonX - textX - 24);
  const compact = options.height < 66;
  const sectionLabelY = options.height - 46;
  const tokenY = options.height - 26;
  const costSectionWidth = Math.max(150, Math.min(220, Math.floor(textWidth * 0.46)));
  const effectsX = textX + costSectionWidth + 22;
  const effectsWidth = Math.max(110, buttonX - effectsX - 18);

  host.drawText(row, options.title, textX, compact ? 8 : 11, {
    fill: 0xf5efdf,
    fontSize: compact ? 14 : 16,
    fontWeight: "900",
  });
  host.drawText(row, options.description, textX, compact ? 30 : 36, {
    fill: 0xc8cabb,
    fontSize: compact ? 10 : 12,
    fontWeight: "600",
    wordWrap: true,
    wordWrapWidth: textWidth,
  });

  host.drawText(row, options.translations.ui.buildCosts ?? "Costs", textX, sectionLabelY, {
    fill: 0xaeb4b8,
    fontSize: 10,
    fontWeight: "800",
  });
  host.drawText(row, options.translations.ui.buildBenefits ?? "Benefits", effectsX, sectionLabelY, {
    fill: 0xaeb4b8,
    fontSize: 10,
    fontWeight: "800",
  });

  const costWidth = drawCostLine(host, row, options.cost, options.state.resources, options.translations, textX, tokenY);
  drawEffects(host, row, options.effects, effectsX, tokenY, effectsWidth);

  if (options.requiredWorkers > 0) {
    drawWorkerRequirement(
      host,
      row,
      options.requiredWorkers,
      options.state.survivors.workers,
      options.translations,
      Math.max(textX, Math.min(textX + costWidth + 8, textX + costSectionWidth - 54)),
      tokenY,
    );
  }
  host.createModalButton(
    row,
    options.buttonLabel,
    buttonX,
    (options.height - buttonHeight) / 2,
    buttonWidth,
    buttonHeight,
    options.action,
    options.disabled,
    options.disabledTooltip,
  );
}

export function drawBuildingDetail(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  level: number,
  upgradingRemaining: number,
  maxLevel: number,
  state: GameState,
  translations: TranslationPack,
  modalWidth: number,
  modalHeight: number,
): void {
  const translated = translations.buildings[buildingId];
  const building = state.buildings[buildingId];
  const definition = buildingById[buildingId];
  const cost = getUpgradeCost(buildingId, level);
  const locked = level >= maxLevel;
  const upgrading = upgradingRemaining > 0;
  const affordable = canAfford(state.resources, cost);
  const queueAvailable = hasAvailableBuildingSlot(state);
  const requiredWorkers = getConstructionWorkerRequirement(buildingId, level);
  const workersAvailable = state.survivors.workers >= requiredWorkers;
  const requiredMainBuildingLevel = getMainBuildingLevelRequirement(buildingId, level + 1);
  const mainBuildingUnlocked = locked || isMainBuildingRequirementMet(state, buildingId, level + 1);
  const disabled = locked || upgrading || !mainBuildingUnlocked || !affordable || !queueAvailable || !workersAvailable;

  const content = new Container();
  parent.addChild(content);

  const sideMargin = 28;
  const contentTop = 34;
  const previewWidth = 136;
  const titleX = sideMargin + previewWidth + 22;
  const titleWidth = modalWidth - titleX - sideMargin;
  const bodyWidth = modalWidth - sideMargin * 2;

  const asset = host.createBuildingSprite(buildingId, Math.max(1, level), level > 0);
  asset.anchor.set(0.5);
  asset.x = sideMargin + 54;
  asset.y = contentTop + 50;
  host.fitSprite(asset, 96 * BUILDING_PREVIEW_RENDER_SCALE, 72 * BUILDING_PREVIEW_RENDER_SCALE);
  content.addChild(asset);

  host.drawText(content, translated.name, titleX, contentTop + 6, { fill: 0xf5efdf, fontSize: 30, fontWeight: "900" });
  host.drawText(content, translated.description, titleX, contentTop + 48, {
    fill: 0xc8cabb,
    fontSize: 13,
    fontWeight: "700",
    wordWrap: true,
    wordWrapWidth: titleWidth,
  });

  const metricGap = 10;
  const metricWidth = (titleWidth - metricGap * 3) / 4;
  const metricY = contentTop + 86;
  getBuildingDetailMetrics(buildingId, building, level, maxLevel, state, translations).forEach((metric, index) => {
    drawMetricCard(host, content, metric, titleX + index * (metricWidth + metricGap), metricY, metricWidth, 58);
  });

  const operationsY = contentTop + 166;
  if (buildingId === "generator" || buildingId === "workshop") {
    drawStaffedProductionControls(host, content, buildingId, state, translations, sideMargin, operationsY, bodyWidth);
  } else if (buildingId === "market") {
    drawMarketControls(host, content, state, translations, sideMargin, operationsY, bodyWidth);
  } else if (buildingId === "barracks") {
    drawBarracksControls(host, content, state, translations, sideMargin, operationsY, bodyWidth);
  } else {
    drawBuildingOperations(host, content, buildingId, level, translations, sideMargin, operationsY, bodyWidth);
  }

  const footerY = modalHeight - 134;
  host.drawPanel(content, sideMargin, footerY, modalWidth - sideMargin * 2, 110);
  host.drawText(content, locked ? translations.ui.maxLevelReached : translations.ui.nextLevel, sideMargin + 28, footerY + 26, {
    fill: 0xf1df9a,
    fontSize: 13,
    fontWeight: "900",
  });

  drawCostLine(host, content, cost, state.resources, translations, sideMargin + 28, footerY + 62);
  drawWorkerRequirement(host, content, requiredWorkers, state.survivors.workers, translations, sideMargin + 208, footerY + 62);
  drawEffects(host, content, getNextLevelEffects(buildingId, level, translations), sideMargin + 290, footerY + 62, Math.max(120, modalWidth - 580));

  const warnings: string[] = [];
  if (!queueAvailable && !upgrading) {
    warnings.push(translations.ui.queueFull);
  }
  if (!workersAvailable && !upgrading) {
    warnings.push(translations.ui.notEnoughWorkers);
  }
  if (!mainBuildingUnlocked && !upgrading) {
    warnings.push(getMainBuildingRequirementTooltip(translations, requiredMainBuildingLevel));
  }
  warnings.forEach((warning, index) => {
    host.drawText(content, warning, sideMargin + 28, footerY + 86 + index * 16, { fill: 0xff9aa2, fontSize: 11, fontWeight: "800" });
  });

  const buttonLabel = upgrading
    ? `${Math.ceil(upgradingRemaining)}s`
    : locked
      ? `${level}/${maxLevel}`
      : !mainBuildingUnlocked
        ? getMainBuildingRequirementLabel(translations, requiredMainBuildingLevel)
        : queueAvailable
          ? translations.ui.upgrade
          : translations.ui.queueFull;
  host.createModalButton(
    content,
    buttonLabel,
    modalWidth - 258,
    footerY + 24,
    210,
    44,
    { action: "upgrade", building: buildingId },
    disabled,
    !mainBuildingUnlocked
      ? getMainBuildingRequirementTooltip(translations, requiredMainBuildingLevel)
      : undefined,
  );
  host.drawIcon(content, "clock", modalWidth - 172, footerY + 88, 14);
  host.drawText(content, `${Math.ceil(getBuildingBuildSeconds(state, buildingId, level))}s`, modalWidth - 154, footerY + 80, {
    fill: 0xaeb4b8,
    fontSize: 11,
    fontWeight: "700",
  });
}

function getBuildingDetailMetrics(
  buildingId: BuildingId,
  building: GameState["buildings"][BuildingId],
  level: number,
  maxLevel: number,
  state: GameState,
  translations: TranslationPack,
): BuildingMetric[] {
  const definition = buildingById[buildingId];
  const defense = (definition.defense ?? 0) * level;

  return [
    {
      iconId: "build",
      label: translations.ui.level,
      value: `${level}/${maxLevel}`,
      fill: 0xf1df9a,
      tooltip: `${translations.ui.level} ${level}/${maxLevel}`,
    },
    {
      iconId: "shield",
      label: translations.ui.defense,
      value: `${Math.round(defense)}`,
      fill: defense > 0 ? 0xf5efdf : 0xd7ddd8,
      tooltip: `${translations.ui.defense}: ${Math.round(defense)}`,
    },
    getBuildingProductionMetric(buildingId, building, level, state, translations),
    getBuildingCoalMetric(buildingId, building, level, state, translations),
  ];
}

function getBuildingProductionMetric(
  buildingId: BuildingId,
  building: GameState["buildings"][BuildingId],
  level: number,
  state: GameState,
  translations: TranslationPack,
): BuildingMetric {
  const definition = buildingById[buildingId];
  const productionMultiplier = getGlobalProductionMultiplier(state);

  if (buildingId === "mainBuilding") {
    const bonus = getMainBuildingProductionBonus(level);
    return {
      iconId: "build",
      label: translations.ui.production,
      value: formatPercentBonus(bonus),
      fill: bonus > 0 ? 0xf1df9a : 0xd7ddd8,
      tooltip: `${translations.ui.production}: ${formatPercentBonus(bonus)}`,
    };
  }
  if (buildingId === "generator") {
    const rate = getCoalMineCoalRate(level, building.workers) * productionMultiplier;
    return {
      iconId: "coal",
      label: translations.ui.production,
      value: getHourlyRateLabel(rate),
      fill: getRateColor(rate),
      tooltip: `${translations.resources.coal}: ${getHourlyRateLabel(rate)}`,
    };
  }
  if (buildingId === "workshop") {
    const rate = getWorkshopMaterialRate(level, building.workers) * productionMultiplier;
    return {
      iconId: "material",
      label: translations.ui.production,
      value: getHourlyRateLabel(rate),
      fill: getRateColor(rate),
      tooltip: `${translations.resources.material}: ${getHourlyRateLabel(rate)}`,
    };
  }
  if (buildingId === "market") {
    const tradeLimit = getMarketTradeLimit(level);
    return {
      iconId: "material",
      label: translations.ui.marketTradeLimit ?? translations.ui.stock,
      value: `${tradeLimit}`,
      fill: tradeLimit > 0 ? 0xf1df9a : 0xd7ddd8,
      tooltip: `${translations.ui.marketTradeLimit ?? "Trade limit"}: ${tradeLimit}`,
    };
  }
  if (buildingId === "barracks") {
    const trainingRate = getBarracksTrainingRatePerGameHour(level);
    return {
      iconId: "scout",
      label: translations.ui.troopTraining ?? translations.roles.troops,
      value: `+${formatRate(trainingRate)}/h`,
      fill: getRateColor(trainingRate / GAME_HOUR_REAL_SECONDS),
      tooltip: `${translations.ui.troopTraining ?? "Troop training"}: +${formatRate(trainingRate)}/h`,
    };
  }
  if (buildingId === "academy") {
    const productionBonus = getAcademyProductionBonus(level);
    return {
      iconId: "build",
      label: translations.ui.production,
      value: formatPercentBonus(productionBonus),
      fill: productionBonus > 0 ? 0xf1df9a : 0xd7ddd8,
      tooltip: `${translations.ui.production}: ${formatPercentBonus(productionBonus)}`,
    };
  }

  const produced = Object.entries(definition.produces ?? {}).find(([, amount]) => (amount ?? 0) > 0);
  if (produced) {
    const [resourceId, amount] = produced;
    const typedResourceId = resourceId as ResourceId;
    const rate = (amount ?? 0) * level * (typedResourceId === "morale" ? 1 : productionMultiplier);
    return {
      iconId: typedResourceId,
      label: translations.ui.production,
      value: getHourlyRateLabel(rate),
      fill: getRateColor(rate),
      tooltip: `${translations.resources[typedResourceId]}: ${getHourlyRateLabel(rate)}`,
    };
  }

  if (definition.housing) {
    const capacity = definition.housing * level;
    return {
      iconId: "home",
      label: translations.ui.housingCapacity,
      value: `+${capacity}`,
      fill: capacity > 0 ? 0xf1df9a : 0xd7ddd8,
      tooltip: `${translations.ui.housingCapacity}: ${capacity}`,
    };
  }

  const storage = Object.entries(definition.storageBonus ?? {}).find(([, amount]) => (amount ?? 0) > 0);
  if (storage) {
    const [resourceId, amount] = storage;
    const typedResourceId = resourceId as ResourceId;
    const capacity = Math.round((amount ?? 0) * level);
    return {
      iconId: typedResourceId,
      label: translations.ui.stock,
      value: `+${capacity}`,
      fill: capacity > 0 ? 0xf1df9a : 0xd7ddd8,
      tooltip: `${translations.resources[typedResourceId]} ${translations.ui.stock}: +${capacity}`,
    };
  }

  return {
    iconId: "build",
    label: translations.ui.production,
    value: "0",
    fill: 0xd7ddd8,
    tooltip: translations.ui.production,
  };
}

function getBuildingCoalMetric(
  buildingId: BuildingId,
  building: GameState["buildings"][BuildingId],
  level: number,
  state: GameState,
  translations: TranslationPack,
): BuildingMetric {
  const definition = buildingById[buildingId];
  const consumption = ((definition.consumes?.coal ?? 0) + (definition.alwaysConsumes?.coal ?? 0)) * level;
  const production = buildingId === "generator"
    ? getCoalMineCoalRate(level, building.workers) * getGlobalProductionMultiplier(state)
    : 0;
  const staffedConsumption = buildingId === "workshop" ? getWorkshopCoalRate(level, building.workers) : consumption;
  const netRate = production - staffedConsumption;

  return {
    iconId: "coal",
    label: translations.resources.coal,
    value: getHourlyRateLabel(netRate),
    fill: getRateColor(netRate),
    tooltip: `${translations.resources.coal}: ${getHourlyRateLabel(netRate)}`,
  };
}

function drawMetricCard(
  host: BuildingModalsHost,
  parent: Container,
  metric: BuildingMetric,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const card = new Container();
  card.x = x;
  card.y = y;
  parent.addChild(card);

  const box = new Graphics();
  box.rect(0, 0, width, height).fill({ color: 0x10120e, alpha: 0.78 });
  card.addChild(box);

  host.drawIcon(card, metric.iconId, 22, height / 2, 22);
  host.drawText(card, metric.label, 48, 12, {
    fill: 0xaeb4b8,
    fontSize: 11,
    fontWeight: "800",
    wordWrap: true,
    wordWrapWidth: width - 58,
  });
  host.drawText(card, metric.value, 48, 32, {
    fill: metric.fill ?? 0xf5efdf,
    fontSize: 17,
    fontWeight: "900",
    wordWrap: true,
    wordWrapWidth: width - 58,
  });

  if (metric.tooltip) {
    host.bindTooltip(card, metric.tooltip);
  }
}

function drawSectionTitle(host: BuildingModalsHost, parent: Container, label: string, x: number, y: number): void {
  host.drawText(parent, label, x, y, { fill: 0xf1df9a, fontSize: 13, fontWeight: "900" });
}

function drawBuildingOperations(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  level: number,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): number {
  const effects = getCurrentBuildingEffects(buildingId, level, translations);
  const height = 112;

  host.drawPanel(parent, x, y, width, height);
  drawSectionTitle(host, parent, translations.ui.operations ?? "Operations", x + 20, y + 18);

  if (effects.length === 0) {
    host.drawText(parent, translations.ui.resourceNoActiveEffects ?? "-", x + 20, y + 54, {
      fill: 0xaeb4b8,
      fontSize: 12,
      fontWeight: "800",
    });
    return y + height + 14;
  }

  drawEffects(host, parent, effects, x + 20, y + 56, width - 40);
  return y + height + 14;
}

function drawStaffedProductionControls(
  host: BuildingModalsHost,
  parent: Container,
  buildingId: BuildingId,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): number {
  const building = state.buildings[buildingId];
  const workerLimit = getBuildingWorkerLimit(state, buildingId);
  if (workerLimit <= 0) {
    return y;
  }

  const productionResourceId: ResourceId = buildingId === "workshop" ? "material" : "coal";
  const productionPerHour = (
    buildingId === "workshop"
      ? getWorkshopMaterialRate(building.level, building.workers)
      : getCoalMineCoalRate(building.level, building.workers)
  ) * GAME_HOUR_REAL_SECONDS;
  const coalUsePerHour = buildingId === "workshop"
    ? getWorkshopCoalRate(building.level, building.workers) * GAME_HOUR_REAL_SECONDS
    : 0;

  host.drawPanel(parent, x, y, width, 104);
  drawSectionTitle(host, parent, translations.ui.operations ?? "Operations", x + 20, y + 18);
  host.drawText(parent, `${translations.ui.workers}: ${building.workers}/${workerLimit}`, x + 20, y + 50, { fill: 0xf5efdf, fontSize: 13, fontWeight: "800" });
  drawInfoToken(host, parent, {
    iconId: productionResourceId,
    text: `+${formatRate(productionPerHour)}/h`,
    tooltip: `${translations.resources[productionResourceId]}: +${formatRate(productionPerHour)}/h`,
    x: x + 20,
    y: y + 74,
  });
  if (coalUsePerHour > 0) {
    drawInfoToken(host, parent, {
      iconId: "coal",
      text: `-${formatRate(coalUsePerHour)}/h`,
      tooltip: `${translations.resources.coal}: -${formatRate(coalUsePerHour)}/h`,
      missing: true,
      x: x + 118,
      y: y + 74,
    });
  }
  host.createModalButton(parent, "-", x + width - 96, y + 42, 36, 32, { action: "building-workers", building: buildingId, delta: -1 }, building.workers <= 0);
  host.createModalButton(parent, "+", x + width - 48, y + 42, 36, 32, { action: "building-workers", building: buildingId, delta: 1 }, building.workers >= workerLimit || state.survivors.workers <= 0);
  return y + 118;
}

function drawMarketControls(
  host: BuildingModalsHost,
  parent: Container,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): number {
  const marketLevel = state.buildings.market.level;
  if (marketLevel <= 0) {
    return y;
  }

  normalizeMarketSelection(host);
  const tradeLimit = getMarketTradeLimit(marketLevel);
  const tradeSlots = getMarketTradeSlots(marketLevel);
  const availableTrades = getAvailableMarketTrades(state);
  const fromResource = host.getMarketFromResource();
  const toResource = host.getMarketToResource();
  const tradeCapacity = getMarketTradeCapacity(state, fromResource, toResource);
  const maxAmount = Math.max(1, tradeCapacity);
  host.setMarketAmount(Math.max(1, Math.min(host.getMarketAmount(), maxAmount)));

  const cooldownRemaining = state.market.cooldownRemainingSeconds;
  const statusText = cooldownRemaining > 0
    ? `${translations.ui.marketCooldown ?? "Cooldown"}: ${formatScoutingRemaining(cooldownRemaining)}`
    : `${translations.ui.marketTrades ?? "Trades"}: ${availableTrades}/${tradeSlots}`;
  const amount = host.getMarketAmount();
  const disabled = !canTradeAtMarket(state, fromResource, toResource, amount);
  const disabledTooltip = getMarketTradeDisabledTooltip(host, state, translations, tradeCapacity);

  host.drawPanel(parent, x, y, width, 170);
  drawSectionTitle(host, parent, translations.ui.marketExchange ?? "Exchange", x + 20, y + 18);
  host.drawText(parent, `${translations.ui.marketTradeLimit ?? "Limit"}: ${tradeLimit} / ${statusText}`, x + 20, y + 42, { fill: 0xaeb4b8, fontSize: 12, fontWeight: "800" });

  drawMarketResourceButtons(
    host,
    parent,
    translations.ui.marketGive ?? "Give",
    fromResource,
    x + 20,
    y + 72,
    (resourceId) => {
      host.setMarketFromResource(resourceId);
      if (host.getMarketToResource() === resourceId) {
        host.setMarketToResource(getNextMarketResource(resourceId));
      }
      host.requestRender();
    },
    translations,
  );
  drawMarketResourceButtons(
    host,
    parent,
    translations.ui.marketReceive ?? "Receive",
    toResource,
    x + 20,
    y + 116,
    (resourceId) => {
      host.setMarketToResource(resourceId);
      if (host.getMarketFromResource() === resourceId) {
        host.setMarketFromResource(getNextMarketResource(resourceId));
      }
      host.requestRender();
    },
    translations,
  );

  drawMarketAmountStepper(host, parent, translations, x + width - 238, y + 72, 196, tradeCapacity);
  host.createModalButton(
    parent,
    translations.ui.marketTrade ?? "Trade",
    x + width - 238,
    y + 126,
    196,
    34,
    {
      action: "market-trade",
      marketFromResource: host.getMarketFromResource(),
      marketToResource: host.getMarketToResource(),
      marketAmount: host.getMarketAmount(),
    },
    disabled,
    disabledTooltip,
  );

  return y + 184;
}

function drawMarketResourceButtons(
  host: BuildingModalsHost,
  parent: Container,
  label: string,
  activeResourceId: MarketResourceId,
  x: number,
  y: number,
  onSelect: (resourceId: MarketResourceId) => void,
  translations: TranslationPack,
): void {
  host.drawText(parent, label, x, y, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "900" });
  let offsetX = 74;
  for (const resourceId of marketResourceIds) {
    host.createRectButton(parent, {
      label: translations.resources[resourceId],
      x: x + offsetX,
      y: y - 8,
      width: 66,
      height: 30,
      onTap: () => {
        host.playTabSwitchSound();
        onSelect(resourceId);
      },
      active: resourceId === activeResourceId,
      tone: "secondary",
      fontSize: 11,
      fontWeight: "900",
    });
    offsetX += 72;
  }
}

function drawMarketAmountStepper(
  host: BuildingModalsHost,
  parent: Container,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  tradeCapacity: number,
): void {
  const stepper = new Container();
  stepper.x = x;
  stepper.y = y;
  parent.addChild(stepper);

  const box = new Graphics();
  box.rect(0, 0, width, 44).fill({ color: 0x0c0f0d, alpha: 0.58 });
  stepper.addChild(box);

  host.drawText(stepper, translations.ui.marketAmount ?? "Amount", 12, 7, {
    fill: 0xaeb4b8,
    fontSize: 11,
    fontWeight: "800",
  });
  host.createLocalModalButton(stepper, "-10", width - 126, 8, 38, 28, () => {
    host.setMarketAmount(Math.max(1, host.getMarketAmount() - 10));
    host.requestRender();
  }, host.getMarketAmount() <= 1);
  host.drawCenteredText(stepper, `${host.getMarketAmount()}`, width - 64, 22, {
    fill: tradeCapacity > 0 ? 0xf1df9a : 0xff9aa2,
    fontSize: 17,
    fontWeight: "900",
  });
  host.createLocalModalButton(stepper, "+10", width - 42, 8, 38, 28, () => {
    host.setMarketAmount(Math.min(Math.max(1, tradeCapacity), host.getMarketAmount() + 10));
    host.requestRender();
  }, tradeCapacity <= 0 || host.getMarketAmount() >= tradeCapacity);
}

function normalizeMarketSelection(host: BuildingModalsHost): void {
  if (!isMarketResourceId(host.getMarketFromResource())) {
    host.setMarketFromResource("material");
  }
  if (!isMarketResourceId(host.getMarketToResource())) {
    host.setMarketToResource("food");
  }
  if (host.getMarketFromResource() === host.getMarketToResource()) {
    host.setMarketToResource(getNextMarketResource(host.getMarketFromResource()));
  }
}

function getNextMarketResource(resourceId: MarketResourceId): MarketResourceId {
  return marketResourceIds.find((candidate) => candidate !== resourceId) ?? "food";
}

function getMarketTradeDisabledTooltip(
  host: BuildingModalsHost,
  state: GameState,
  translations: TranslationPack,
  tradeCapacity: number,
): string | undefined {
  if (state.market.cooldownRemainingSeconds > 0) {
    return `${translations.ui.marketCooldown ?? "Cooldown"}: ${formatScoutingRemaining(state.market.cooldownRemainingSeconds)}`;
  }
  if (getAvailableMarketTrades(state) <= 0) {
    return translations.ui.marketNoTrades ?? "No trade slot available.";
  }
  if (host.getMarketFromResource() === host.getMarketToResource()) {
    return translations.ui.marketSameResource ?? "Choose two different resources.";
  }
  if (tradeCapacity <= 0) {
    return translations.ui.marketNoCapacity ?? "Not enough stock or storage capacity.";
  }
  return undefined;
}

function drawBarracksControls(
  host: BuildingModalsHost,
  parent: Container,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
): number {
  if (state.buildings.barracks.level <= 0) {
    return y;
  }

  const panelHeight = 132;
  const contentY = y + 18;
  const selectedTroops = Math.max(1, Math.floor(host.getBarracksTroopCount()));
  const maxSelectableTroops = Math.max(1, Math.max(state.survivors.workers, state.survivors.troops));
  host.setBarracksTroopCount(Math.min(selectedTroops, maxSelectableTroops));

  host.drawPanel(parent, x, y, width, panelHeight);
  drawBarracksTraining(host, parent, state, translations, x, contentY, width, maxSelectableTroops);
  return y + panelHeight + 14;
}

function drawBarracksTraining(
  host: BuildingModalsHost,
  parent: Container,
  state: GameState,
  translations: TranslationPack,
  x: number,
  y: number,
  width: number,
  maxSelectableTroops: number,
): void {
  drawBarracksAvailabilityCard(host, parent, "people", translations.ui.availableWorkers, state.survivors.workers, x + 20, y, 156, 42);
  drawBarracksAvailabilityCard(host, parent, "scout", translations.ui.availableTroops, state.survivors.troops, x + 188, y, 156, 42);
  drawTroopCountStepper(
    host,
    parent,
    translations.ui.squadSize ?? translations.roles.troops,
    host.getBarracksTroopCount(),
    maxSelectableTroops,
    x + width - 208,
    y,
    188,
  );

  host.createModalButton(
    parent,
    translations.ui.workerToTroop,
    x + 20,
    y + 58,
    156,
    32,
    { action: "barracks-worker-to-troop", troopCount: host.getBarracksTroopCount() },
    state.survivors.workers < host.getBarracksTroopCount(),
  );
  host.createModalButton(
    parent,
    translations.ui.troopToWorker,
    x + 188,
    y + 58,
    156,
    32,
    { action: "barracks-troop-to-worker", troopCount: host.getBarracksTroopCount() },
    state.survivors.troops < host.getBarracksTroopCount(),
  );
}

function drawBarracksAvailabilityCard(
  host: BuildingModalsHost,
  parent: Container,
  iconId: string,
  label: string,
  value: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const card = new Container();
  card.x = x;
  card.y = y;
  parent.addChild(card);

  const box = new Graphics();
  box.rect(0, 0, width, height).fill({ color: 0x0c0f0d, alpha: 0.58 });
  card.addChild(box);
  host.drawIcon(card, iconId, 22, height / 2, 20);
  host.drawText(card, label, 48, 8, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" });
  host.drawText(card, `${value}`, 48, 26, { fill: 0xf5efdf, fontSize: 17, fontWeight: "900" });
}

function drawTroopCountStepper(
  host: BuildingModalsHost,
  parent: Container,
  label: string,
  value: number,
  maxValue: number,
  x: number,
  y: number,
  width: number,
): void {
  const stepper = new Container();
  stepper.x = x;
  stepper.y = y;
  parent.addChild(stepper);

  const box = new Graphics();
  box.rect(0, 0, width, 50).fill({ color: 0x0c0f0d, alpha: 0.58 });
  stepper.addChild(box);

  host.drawText(stepper, label, 12, 8, { fill: 0xaeb4b8, fontSize: 11, fontWeight: "800" });
  host.createLocalModalButton(stepper, "-", width - 108, 12, 30, 28, () => {
    host.setBarracksTroopCount(Math.max(1, host.getBarracksTroopCount() - 1));
    host.requestRender();
  }, value <= 1);
  host.drawCenteredText(stepper, `${value}`, width - 58, 26, { fill: 0xf1df9a, fontSize: 17, fontWeight: "900" });
  host.createLocalModalButton(stepper, "+", width - 38, 12, 30, 28, () => {
    host.setBarracksTroopCount(Math.min(maxValue, host.getBarracksTroopCount() + 1));
    host.requestRender();
  }, value >= maxValue);
}

function drawEffects(host: BuildingModalsHost, parent: Container, effects: EffectLine[], x: number, y: number, maxWidth: number): number {
  let offsetX = 0;
  let offsetY = 0;
  let maxOffsetX = 0;
  for (const effect of effects.slice(0, 4)) {
    const token = drawInfoToken(host, parent, {
      iconId: effect.iconId,
      text: effect.value,
      tooltip: effect.tooltip,
      missing: effect.negative,
      x: x + offsetX,
      y: y + offsetY,
    });

    if (offsetX > 0 && offsetX + token.width > maxWidth) {
      offsetX = 0;
      offsetY += 18;
      token.x = x;
      token.y = y + offsetY;
    }

    offsetX += token.width + 8;
    maxOffsetX = Math.max(maxOffsetX, offsetX);
  }
  return maxOffsetX;
}

function drawCostLine(
  host: BuildingModalsHost,
  parent: Container,
  bag: ResourceBag,
  availableResources: GameState["resources"],
  translations: TranslationPack,
  x: number,
  y: number,
): number {
  let offset = 0;
  for (const part of getCostLineParts(bag, availableResources, translations)) {
    const item = drawInfoToken(host, parent, {
      iconId: part.iconId,
      text: part.text,
      tooltip: part.tooltip,
      missing: part.missing,
      x: x + offset,
      y,
    });
    offset += item.width + 8;
  }
  return offset;
}

function drawWorkerRequirement(
  host: BuildingModalsHost,
  parent: Container,
  required: number,
  available: number,
  translations: TranslationPack,
  x: number,
  y: number,
): number {
  const missing = available < required;
  const token = drawInfoToken(host, parent, {
    iconId: "people",
    text: `${required}`,
    tooltip: `${translations.ui.constructionWorkers}: ${Math.floor(available)}/${required}`,
    missing,
    x,
    y,
  });
  return token.width;
}

function getMainBuildingRequirementLabel(translations: TranslationPack, requiredLevel: number): string {
  return formatTemplate(translations.ui.requiresMainBuildingLevelShort ?? "Main lvl {level}", { level: requiredLevel });
}

function getMainBuildingRequirementTooltip(translations: TranslationPack, requiredLevel: number): string {
  return formatTemplate(translations.ui.requiresMainBuildingLevel ?? "Requires main building level {level}.", { level: requiredLevel });
}

function getBuildActionDisabledTooltip(
  translations: TranslationPack,
  cost: ResourceBag,
  resources: GameState["resources"],
  requiredWorkers: number,
  availableWorkers: number,
  queueAvailable: boolean,
  mainBuildingUnlocked: boolean,
  requiredMainBuildingLevel: number,
): string {
  const reasons: string[] = [];
  if (!mainBuildingUnlocked) {
    reasons.push(getMainBuildingRequirementTooltip(translations, requiredMainBuildingLevel));
  }
  if (!queueAvailable) {
    reasons.push(translations.ui.queueFull);
  }
  if (availableWorkers < requiredWorkers) {
    reasons.push(translations.ui.notEnoughWorkers);
  }
  const missingResourceLabels = getMissingResourceLabels(cost, resources, translations);
  if (missingResourceLabels.length > 0) {
    reasons.push(`${translations.ui.notEnoughResources ?? "Not enough resources"}: ${missingResourceLabels.join(", ")}`);
  }
  return reasons.join("\n");
}

function getMissingResourceLabels(
  bag: ResourceBag,
  availableResources: GameState["resources"],
  translations: TranslationPack,
): string[] {
  const labels: string[] = [];
  for (const [resourceId, amount] of Object.entries(bag)) {
    if ((amount ?? 0) <= 0) {
      continue;
    }
    const typedResourceId = resourceId as ResourceId;
    const required = Math.ceil(amount ?? 0);
    const available = availableResources[typedResourceId] ?? 0;
    if (available < required) {
      labels.push(translations.resources[typedResourceId]);
    }
  }
  return labels;
}

function drawInfoToken(
  host: BuildingModalsHost,
  parent: Container,
  options: {
    iconId: string;
    text: string;
    tooltip: string;
    missing?: boolean;
    x: number;
    y: number;
  },
): Container {
  const token = new Container();
  token.x = options.x;
  token.y = options.y;
  parent.addChild(token);

  host.drawIcon(token, options.iconId, 8, 8, 14);
  const label = host.drawText(token, options.text, 20, 0, {
    fill: options.missing ? 0xff6f7d : 0xf1df9a,
    fontSize: 12,
    fontWeight: "900",
  });
  host.bindTooltip(token, options.tooltip);

  token.hitArea = new Rectangle(0, -2, label.width + 26, 20);
  return token;
}
